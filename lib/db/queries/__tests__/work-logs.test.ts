import { describe, it, expect, vi } from "vitest";
import { insertWorkLog, getWorkLogs, DuplicateWorkLogError } from "../work-logs";

function makeSql(rows: unknown[] = [], throwCode?: string) {
  const tag = vi.fn((..._args: unknown[]) => {
    if (throwCode) {
      const err = Object.assign(new Error("db error"), { code: throwCode });
      return Promise.reject(err);
    }
    return Promise.resolve(rows);
  }) as unknown;
  (tag as Record<string, unknown>).unsafe = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tag as any;
}

/** Valores interpolados en el tagged template (el arg 0 son los strings). */
function boundValues(sql: { mock: { calls: unknown[][] } }): unknown[] {
  return sql.mock.calls[0].slice(1);
}

describe("insertWorkLog", () => {
  it("retorna el id en caso exitoso", async () => {
    const sql = makeSql([{ id: 42 }]);
    const id = await insertWorkLog(sql, "user-1", {
      session_id: 10,
      notes: "algo",
      topics: ["BFS"],
    });
    expect(id).toBe(42);
  });

  it("lanza DuplicateWorkLogError en unique_violation (23505)", async () => {
    const sql = makeSql([], "23505");
    await expect(
      insertWorkLog(sql, "user-1", { session_id: 10, topics: [] })
    ).rejects.toBeInstanceOf(DuplicateWorkLogError);
  });

  it("propaga otros errores sin wrappear", async () => {
    const sql = makeSql([], "42000");
    await expect(
      insertWorkLog(sql, "user-1", { session_id: 10, topics: [] })
    ).rejects.toMatchObject({ code: "42000" });
  });

  it("manda is_theory y chunks cuando la sesión fue de teoría", async () => {
    const sql = makeSql([{ id: 1 }]);
    await insertWorkLog(sql, "user-1", {
      session_id: 10,
      topics: [],
      is_theory: true,
      chunks: 2.5,
    });
    const values = boundValues(sql);
    expect(values).toContain(true);
    expect(values).toContain(2.5);
  });

  it("por defecto guarda is_theory en false y chunks en null", async () => {
    const sql = makeSql([{ id: 1 }]);
    await insertWorkLog(sql, "user-1", { session_id: 10, topics: [] });
    const values = boundValues(sql);
    expect(values).toContain(false);
    expect(values).toContain(null);
  });
});

describe("getWorkLogs", () => {
  const fakeRow = {
    id: 1, session_id: 2, notes: "n", topics: ["t"],
    created_at: "2026-01-01T00:00:00Z", session_type: "work",
    started_at: "2026-01-01T00:00:00Z", actual_duration: 1500,
    distraction_count: 0,
    is_theory: false, chunks: null,
    label_id: null, label_name: null, label_color: null,
  };

  it("clampea el limit entre 1 y 50", async () => {
    const sql = makeSql([]);
    await getWorkLogs(sql, "u", { limit: 200 });
    expect(sql).toHaveBeenCalled();
  });

  it("retorna los rows del resultado", async () => {
    const sql = makeSql([fakeRow]);
    const rows = await getWorkLogs(sql, "u", { limit: 20 });
    expect(rows).toEqual([fakeRow]);
  });

  it("convierte chunks de string a number (postgres.js devuelve NUMERIC como string)", async () => {
    const sql = makeSql([{ ...fakeRow, is_theory: true, chunks: "2.50" }]);
    const rows = await getWorkLogs(sql, "u", { limit: 20 });
    expect(rows[0].chunks).toBe(2.5);
  });

  it("deja chunks en null cuando la sesión no fue de teoría", async () => {
    const sql = makeSql([{ ...fakeRow, chunks: null }]);
    const rows = await getWorkLogs(sql, "u", { limit: 20 });
    expect(rows[0].chunks).toBeNull();
  });
});

