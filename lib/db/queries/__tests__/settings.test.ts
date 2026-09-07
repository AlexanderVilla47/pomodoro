import { describe, it, expect, vi } from "vitest";
import { getSettings, upsertSettings } from "../settings";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";

const BASE_ROW = {
  id: 1,
  work_duration: 1500,
  short_break_duration: 300,
  long_break_duration: 900,
  long_break_interval: 4,
  notification_sound_enabled: 1,
  preferences: {},
};

function makeSql(row: Record<string, unknown> = BASE_ROW) {
  const tag = vi.fn((..._args: unknown[]) => Promise.resolve([row])) as unknown;
  (tag as Record<string, unknown>).unsafe = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tag as any;
}

/** Valores interpolados en la llamada `n` (el arg 0 son los strings del template). */
function boundValues(sql: { mock: { calls: unknown[][] } }, n: number): unknown[] {
  return sql.mock.calls[n].slice(1);
}

/**
 * `getSettings` gasta dos llamadas (el INSERT idempotente y el SELECT), así que
 * el UPDATE de `upsertSettings` es siempre la tercera.
 */
const UPDATE_CALL = 2;

/** Las preferencias viajan a la base como texto JSON con cast explícito a jsonb. */
function preferencesSentTo(sql: { mock: { calls: unknown[][] } }, n: number) {
  const json = boundValues(sql, n).find(
    (v) => typeof v === "string" && v.trim().startsWith("{")
  );
  return JSON.parse(json as string);
}

describe("getSettings", () => {
  it("resuelve las preferencias con la columna en {}", async () => {
    const settings = await getSettings(makeSql(), "user-1");
    expect(settings.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it("devuelve las preferencias guardadas, ya resueltas", async () => {
    const sql = makeSql({
      ...BASE_ROW,
      preferences: { unitSingular: "card", unitPlural: "cards", journal: false },
    });
    const settings = await getSettings(sql, "user-1");
    expect(settings.preferences).toEqual({
      unitSingular: "card",
      unitPlural: "cards",
      journal: false,
      social: true,
    });
  });

  it("no le pasa JSONB crudo a nadie: una columna en null resuelve a los defaults", async () => {
    // Ningún componente ve la forma de la columna. Si la fila viene rara, la
    // capa de queries la traduce igual que ya hace con notification_sound.
    const sql = makeSql({ ...BASE_ROW, preferences: null });
    const settings = await getSettings(sql, "user-1");
    expect(settings.preferences).toEqual(DEFAULT_PREFERENCES);
  });
});

describe("upsertSettings", () => {
  it("MERGEA las preferencias en vez de reemplazarlas", async () => {
    // Si esto reemplazara, apagar el journal te borraría la unidad configurada.
    const sql = makeSql({
      ...BASE_ROW,
      preferences: { unitSingular: "página", unitPlural: "páginas" },
    });

    await upsertSettings(sql, "user-1", { preferences: { journal: false } });

    expect(preferencesSentTo(sql, UPDATE_CALL)).toEqual({
      unitSingular: "página",
      unitPlural: "páginas",
      journal: false,
      social: true,
    });
  });

  it("deja las preferencias intactas cuando el patch no las toca", async () => {
    const sql = makeSql({
      ...BASE_ROW,
      preferences: { unitSingular: "kata", unitPlural: "katas" },
    });

    await upsertSettings(sql, "user-1", { work_duration: 1800 });

    expect(preferencesSentTo(sql, UPDATE_CALL)).toMatchObject({
      unitSingular: "kata",
      unitPlural: "katas",
    });
  });

  it("devuelve las preferencias ya mergeadas y resueltas", async () => {
    const sql = makeSql({
      ...BASE_ROW,
      preferences: { unitSingular: "kata", unitPlural: "katas" },
    });

    const updated = await upsertSettings(sql, "user-1", {
      preferences: { social: false },
    });

    expect(updated.preferences).toEqual({
      unitSingular: "kata",
      unitPlural: "katas",
      journal: true,
      social: false,
    });
  });

  it("sigue guardando los campos del temporizador", async () => {
    const sql = makeSql();
    await upsertSettings(sql, "user-1", { work_duration: 1800 });
    expect(boundValues(sql, UPDATE_CALL)).toContain(1800);
  });
});
