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
});

describe("getWorkLogs", () => {
  it("clampea el limit entre 1 y 50", async () => {
    const sql = makeSql([]);
    await getWorkLogs(sql, "u", { limit: 200 });
    expect(sql).toHaveBeenCalled();
  });

  it("retorna los rows del resultado", async () => {
    const fakeRow = {
      id: 1, session_id: 2, notes: "n", topics: ["t"],
      created_at: "2026-01-01T00:00:00Z", session_type: "work",
      started_at: "2026-01-01T00:00:00Z", actual_duration: 1500,
      label_id: null, label_name: null, label_color: null,
    };
    const sql = makeSql([fakeRow]);
    const rows = await getWorkLogs(sql, "u", { limit: 20 });
    expect(rows).toEqual([fakeRow]);
  });
});
