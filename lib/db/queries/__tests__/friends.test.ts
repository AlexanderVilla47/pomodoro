import { describe, it, expect, vi } from "vitest";
import { searchUsers, findUserById } from "../friends";

function makeSql(rows: unknown[] = []) {
  const tag = vi.fn((..._args: unknown[]) => Promise.resolve(rows)) as unknown;
  (tag as Record<string, unknown>).unsafe = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tag as any;
}

describe("searchUsers", () => {
  it("retorna lista vacía si el query queda vacío tras trim", async () => {
    const sql = makeSql([{ id: "u2", name: "Juan", image: null, relation: "none" }]);
    const rows = await searchUsers(sql, "   ", "u1");
    expect(rows).toEqual([]);
    // No debe pegarle a la DB con un query vacío
    expect(sql).not.toHaveBeenCalled();
  });

  it("mapea los rows a la forma pública con relation", async () => {
    const sql = makeSql([
      { id: "u2", name: "Juan Pérez", image: "http://img", relation: "none" },
      { id: "u3", name: "Juan Gómez", image: null, relation: "friend" },
    ]);
    const rows = await searchUsers(sql, "juan", "u1");
    expect(rows).toEqual([
      { id: "u2", name: "Juan Pérez", image: "http://img", relation: "none" },
      { id: "u3", name: "Juan Gómez", image: null, relation: "friend" },
    ]);
    expect(sql).toHaveBeenCalled();
  });

  it("le pega a la DB tanto para nombre como para email", async () => {
    const sqlName = makeSql([]);
    await searchUsers(sqlName, "juan", "u1");
    expect(sqlName).toHaveBeenCalled();

    const sqlEmail = makeSql([]);
    await searchUsers(sqlEmail, "juan@mail.com", "u1");
    expect(sqlEmail).toHaveBeenCalled();
  });
});

describe("findUserById", () => {
  it("retorna el usuario si existe", async () => {
    const sql = makeSql([{ id: "u2", name: "Juan", image: null }]);
    const user = await findUserById(sql, "u2");
    expect(user).toEqual({ id: "u2", name: "Juan", image: null });
  });

  it("retorna null si no existe", async () => {
    const sql = makeSql([]);
    const user = await findUserById(sql, "nope");
    expect(user).toBeNull();
  });
});
