import { describe, it, expect, vi } from "vitest";
import { getStudyEfficiencyByDay } from "../stats";

function makeSql(rows: unknown[] = []) {
  const tag = vi.fn((..._args: unknown[]) => Promise.resolve(rows)) as unknown;
  (tag as Record<string, unknown>).unsafe = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tag as any;
}

/** Valores interpolados en el tagged template (el arg 0 son los strings). */
function boundValues(sql: { mock: { calls: unknown[][] } }): unknown[] {
  return sql.mock.calls[0].slice(1);
}

/**
 * El SQL con los valores reemplazados por `?`.
 *
 * Es lo unico que se puede afirmar de una query en esta capa: el tag `sql` esta
 * mockeado y nunca corre contra un Postgres real. Sirve para lo estructural —
 * de que tabla arranca el FROM, por que columna filtra el WHERE — que es
 * justamente donde este PR podia romperse en silencio.
 */
function sqlText(sql: { mock: { calls: unknown[][] } }): string {
  return (sql.mock.calls[0][0] as string[]).join(" ? ");
}

/**
 * El WHERE de la query — no el de un `FILTER (WHERE ...)`.
 *
 * Se ancla al arranque de linea a proposito: los FILTER van inline dentro de
 * los SUM, asi que buscar el primer "WHERE" del texto devolveria uno de ellos
 * y el test pasaria mirando el fragmento equivocado.
 */
function whereClause(sql: { mock: { calls: unknown[][] } }): string {
  const text = sqlText(sql);
  const inicio = text.search(/\n\s*WHERE\b/);
  if (inicio === -1) return "";
  return text.slice(inicio).split(/\n\s*GROUP BY\b/)[0];
}

const opts = { from: "2026-08-01", to: "2026-08-31", tz: -180 };

describe("getStudyEfficiencyByDay", () => {
  it("convierte a number los NUMERIC que postgres.js devuelve como string", async () => {
    // postgres.js mapea NUMERIC a string para no perder precisión. Sumar sin
    // convertir concatena en vez de sumar y falla en silencio: "2.5" + "1.5"
    // da "2.51.5", que despues es NaN.
    const sql = makeSql([
      {
        day: "2026-08-17",
        label_id: 1,
        label_name: "RRHH",
        label_color: "#5ABFA8",
        total_seconds: 3600,
        total_chunks: "4.5",
        sessions: 2,
        distractions: 3,
      },
    ]);
    const [row] = await getStudyEfficiencyByDay(sql, "user-1", opts);
    expect(row.total_chunks).toBe(4.5);
    expect(typeof row.total_chunks).toBe("number");
  });

  it("convierte tambien los agregados que vienen como string", async () => {
    const sql = makeSql([
      {
        day: "2026-08-17",
        label_id: null,
        label_name: null,
        label_color: null,
        total_seconds: "3600",
        total_chunks: "2",
        sessions: "1",
        distractions: "5",
      },
    ]);
    const [row] = await getStudyEfficiencyByDay(sql, "user-1", opts);
    expect(row.total_seconds).toBe(3600);
    expect(row.sessions).toBe(1);
    expect(row.distractions).toBe(5);
  });

  it("un total_chunks nulo cuenta como 0 y no como NaN", async () => {
    const sql = makeSql([
      {
        day: "2026-08-17",
        label_id: null,
        label_name: null,
        label_color: null,
        total_seconds: 3600,
        total_chunks: null,
        sessions: 1,
        distractions: 0,
      },
    ]);
    const [row] = await getStudyEfficiencyByDay(sql, "user-1", opts);
    expect(row.total_chunks).toBe(0);
  });

  it("preserva la materia tal cual viene", async () => {
    const sql = makeSql([
      {
        day: "2026-08-17",
        label_id: 7,
        label_name: "Derecho",
        label_color: "#f0f",
        total_seconds: 1800,
        total_chunks: "2",
        sessions: 1,
        distractions: 0,
      },
    ]);
    const [row] = await getStudyEfficiencyByDay(sql, "user-1", opts);
    expect(row).toMatchObject({ label_id: 7, label_name: "Derecho", label_color: "#f0f" });
  });

  it("filtra por usuario, rango y offset horario", async () => {
    const sql = makeSql([]);
    await getStudyEfficiencyByDay(sql, "user-1", opts);
    const values = boundValues(sql);
    expect(values).toContain("user-1");
    expect(values).toContain("2026-08-01");
    expect(values).toContain("2026-08-31");
    expect(values).toContain(-180);
  });

  it("sin resultados devuelve una lista vacia", async () => {
    const sql = makeSql([]);
    await expect(getStudyEfficiencyByDay(sql, "user-1", opts)).resolves.toEqual([]);
  });
});

describe("getStudyEfficiencyByDay — las sesiones sin unidades tambien cuentan", () => {
  it("arranca en sessions y ata los work logs, no al reves", async () => {
    // El bug que motivo el plan: arrancando en work_logs, una sesion sin log
    // (o con is_theory en false) no existia para el informe. Quien nunca
    // cargaba una unidad veia el panel vacio para siempre.
    const sql = makeSql([]);
    await getStudyEfficiencyByDay(sql, "user-1", opts);
    const text = sqlText(sql);
    expect(text).toMatch(/FROM\s+sessions\s+s/);
    expect(text).toMatch(/LEFT\s+JOIN\s+work_logs\s+w/);
    expect(text).not.toMatch(/FROM\s+work_logs/);
  });

  it("filtra por el usuario de la sesion y no por el del work log", async () => {
    // Con LEFT JOIN, un `w.user_id = ?` en el WHERE descarta las filas donde
    // el join no encontro nada: anula el LEFT y vuelve al bug anterior, pero
    // ahora sin que se note en el FROM.
    const sql = makeSql([]);
    await getStudyEfficiencyByDay(sql, "user-1", opts);
    const where = whereClause(sql);
    expect(where).toMatch(/s\.user_id/);
    expect(where).not.toMatch(/w\.user_id/);
  });

  it("no compuerta el WHERE con is_theory ni con chunks", async () => {
    // Esas dos condiciones siguen existiendo, pero como FILTER de los SUM:
    // deciden que suma unit_seconds, no que sesiones entran al informe.
    const sql = makeSql([]);
    await getStudyEfficiencyByDay(sql, "user-1", opts);
    expect(whereClause(sql)).not.toMatch(/is_theory|chunks/);
    expect(sqlText(sql)).toMatch(/FILTER\s*\(\s*WHERE\s+w\.is_theory/);
  });

  it("trae el tiempo con unidades aparte del tiempo total", async () => {
    const sql = makeSql([
      {
        day: "2026-08-17",
        label_id: null,
        label_name: null,
        label_color: null,
        total_seconds: 7200,
        unit_seconds: 3600,
        total_chunks: "2",
        sessions: 3,
        distractions: 1,
      },
    ]);
    const [row] = await getStudyEfficiencyByDay(sql, "user-1", opts);
    expect(row.total_seconds).toBe(7200);
    expect(row.unit_seconds).toBe(3600);
  });

  it("una sesion sin work_log llega con el tiempo entero y cero unidades", async () => {
    const sql = makeSql([
      {
        day: "2026-08-17",
        label_id: null,
        label_name: null,
        label_color: null,
        total_seconds: 1500,
        unit_seconds: null,
        total_chunks: null,
        sessions: 1,
        distractions: 2,
      },
    ]);
    const [row] = await getStudyEfficiencyByDay(sql, "user-1", opts);
    expect(row).toMatchObject({ total_seconds: 1500, unit_seconds: 0, total_chunks: 0 });
  });
});
