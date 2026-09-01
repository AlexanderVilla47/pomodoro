import { describe, it, expect, vi } from "vitest";
import { insertSession, getSessionIdByClientId } from "../sessions";

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

/** El SQL literal, sin las interpolaciones. */
function statement(sql: { mock: { calls: unknown[][] } }): string {
  return (sql.mock.calls[0][0] as string[]).join(" ");
}

const base = {
  type: "work" as const,
  started_at: "2026-01-01T10:00:00Z",
  ended_at: "2026-01-01T10:25:00Z",
  planned_duration: 1500,
  actual_duration: 1500,
  completed: true,
};

describe("insertSession", () => {
  it("retorna el id de la fila insertada", async () => {
    const sql = makeSql([{ id: 42 }]);
    expect(await insertSession(sql, "user-1", base)).toBe(42);
  });

  it("manda el client_id que generó el cliente", async () => {
    const sql = makeSql([{ id: 1 }]);
    await insertSession(sql, "user-1", { ...base, client_id: "uuid-abc" });
    expect(boundValues(sql)).toContain("uuid-abc");
  });

  // Un item encolado antes de este deploy no trae client_id. Se inserta igual
  // con NULL: el índice único es parcial, así que las filas sin id de cliente
  // no compiten entre sí.
  it("manda null si el payload no trae client_id", async () => {
    const sql = makeSql([{ id: 1 }]);
    await insertSession(sql, "user-1", base);
    expect(boundValues(sql)).toContain(null);
  });

  // El corazón del arreglo de duplicados: si la respuesta del primer INSERT se
  // perdió, el cliente reintenta con el MISMO client_id y el upsert tiene que
  // devolver el id que ya existe en vez de insertar una segunda fila.
  it("resuelve el reintento con un upsert sobre client_id", async () => {
    const sql = makeSql([{ id: 7 }]);
    await insertSession(sql, "user-1", { ...base, client_id: "uuid-abc" });
    expect(statement(sql)).toMatch(/ON CONFLICT\s*\(\s*client_id\s*\)/i);
  });

  // El índice es PARCIAL (WHERE client_id IS NOT NULL). Postgres sólo lo infiere
  // como conflict target si el predicado viaja en el ON CONFLICT; sin esto el
  // INSERT falla en runtime con "no unique or exclusion constraint matching".
  it("repite el predicado del índice parcial en el conflict target", async () => {
    const sql = makeSql([{ id: 7 }]);
    await insertSession(sql, "user-1", { ...base, client_id: "uuid-abc" });
    expect(statement(sql)).toMatch(/ON CONFLICT[\s\S]*client_id IS NOT NULL/i);
  });

  // DO NOTHING no devuelve fila y el cliente se quedaría sin id.
  it("usa DO UPDATE y no DO NOTHING, para que RETURNING traiga el id", async () => {
    const sql = makeSql([{ id: 7 }]);
    await insertSession(sql, "user-1", { ...base, client_id: "uuid-abc" });
    expect(statement(sql)).toMatch(/DO UPDATE/i);
    expect(statement(sql)).not.toMatch(/DO NOTHING/i);
  });
});

describe("getSessionIdByClientId", () => {
  it("retorna el id cuando la sesión ya llegó al servidor", async () => {
    const sql = makeSql([{ id: 13 }]);
    expect(await getSessionIdByClientId(sql, "user-1", "uuid-abc")).toBe(13);
  });

  it("retorna null cuando todavía no existe", async () => {
    const sql = makeSql([]);
    expect(await getSessionIdByClientId(sql, "user-1", "uuid-abc")).toBeNull();
  });

  // Sin el filtro por usuario, un client_id ajeno resolvería a la sesión de otro
  // y le colgaría un work_log encima.
  it("filtra por usuario además de por client_id", async () => {
    const sql = makeSql([{ id: 13 }]);
    await getSessionIdByClientId(sql, "user-1", "uuid-abc");
    expect(boundValues(sql)).toEqual(expect.arrayContaining(["user-1", "uuid-abc"]));
  });
});
