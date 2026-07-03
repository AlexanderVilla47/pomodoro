import { describe, it, expect, vi } from "vitest";
import { sendCheer, getUnseenCheerCount, revealCheers } from "../cheers";

function makeSql(rows: unknown[] = []) {
  const tag = vi.fn((..._args: unknown[]) => Promise.resolve(rows)) as unknown;
  (tag as Record<string, unknown>).unsafe = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tag as any;
}

describe("sendCheer", () => {
  it("le pega a la DB para insertar el aliento", async () => {
    const sql = makeSql([]);
    await sendCheer(sql, "a", "b");
    expect(sql).toHaveBeenCalledOnce();
  });
});

describe("getUnseenCheerCount", () => {
  it("retorna el count de la fila", async () => {
    const sql = makeSql([{ count: 3 }]);
    const n = await getUnseenCheerCount(sql, "u1");
    expect(n).toBe(3);
  });

  it("retorna 0 cuando no hay filas", async () => {
    const sql = makeSql([]);
    const n = await getUnseenCheerCount(sql, "u1");
    expect(n).toBe(0);
  });
});

describe("revealCheers", () => {
  it("retorna los nombres y marca como visto (2 queries: SELECT + UPDATE)", async () => {
    const sql = makeSql([{ name: "Juan" }, { name: "Pedro" }]);
    const result = await revealCheers(sql, "u1");
    expect(result).toEqual({ names: ["Juan", "Pedro"], count: 2 });
    // SELECT + UPDATE
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("no ejecuta el UPDATE si no hay alientos sin ver", async () => {
    const sql = makeSql([]);
    const result = await revealCheers(sql, "u1");
    expect(result).toEqual({ names: [], count: 0 });
    // Solo el SELECT
    expect(sql).toHaveBeenCalledOnce();
  });
});
