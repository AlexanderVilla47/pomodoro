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
