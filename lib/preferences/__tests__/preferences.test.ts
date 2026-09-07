import { describe, it, expect } from "vitest";
import {
  DEFAULT_PREFERENCES,
  MAX_UNIT_LENGTH,
  UNIT_PRESETS,
  pluralizeEs,
  resolvePreferences,
  validateUnit,
} from "../index";

describe("DEFAULT_PREFERENCES", () => {
  it("no trae ninguna unidad configurada", () => {
    // El corazón del 005: "bloque" es media página del apunte de una persona.
    // Un usuario nuevo no tiene por qué encontrarse esa palabra en pantalla.
    expect(DEFAULT_PREFERENCES.unitSingular).toBeNull();
    expect(DEFAULT_PREFERENCES.unitPlural).toBeNull();
  });

  it("deja el journal y lo social prendidos, que es el comportamiento de hoy", () => {
    expect(DEFAULT_PREFERENCES.journal).toBe(true);
    expect(DEFAULT_PREFERENCES.social).toBe(true);
  });
});

describe("resolvePreferences", () => {
  it("con la columna en {} devuelve los defaults", () => {
    expect(resolvePreferences({})).toEqual(DEFAULT_PREFERENCES);
  });

  it.each([null, undefined, "texto", 42, [], true])(
    "con basura (%s) devuelve los defaults en vez de romper",
    (raw) => {
      expect(resolvePreferences(raw)).toEqual(DEFAULT_PREFERENCES);
    }
  );

  it("respeta un valor parcial y completa el resto", () => {
    const prefs = resolvePreferences({ journal: false });
    expect(prefs.journal).toBe(false);
    expect(prefs.social).toBe(true);
    expect(prefs.unitSingular).toBeNull();
  });

  it("conserva la unidad configurada", () => {
    const prefs = resolvePreferences({ unitSingular: "card", unitPlural: "cards" });
    expect(prefs.unitSingular).toBe("card");
    expect(prefs.unitPlural).toBe("cards");
  });

  it("deriva el plural cuando falta", () => {
    // Una fila puede tener sólo el singular (escritura vieja, o un patch parcial).
    // Devolver el plural en null dejaría a la UI eligiendo qué mostrar.
    expect(resolvePreferences({ unitSingular: "página" }).unitPlural).toBe("páginas");
  });

  it("descarta un plural sin singular", () => {
    // Un plural solo no identifica ninguna unidad: es un dato incompleto, no media unidad.
    const prefs = resolvePreferences({ unitPlural: "cards" });
    expect(prefs.unitSingular).toBeNull();
    expect(prefs.unitPlural).toBeNull();
  });

  it("recorta los espacios de la unidad", () => {
    expect(resolvePreferences({ unitSingular: "  kata  " }).unitSingular).toBe("kata");
  });

  it("cae a null si la unidad queda vacía tras recortar", () => {
    expect(resolvePreferences({ unitSingular: "   " }).unitSingular).toBeNull();
  });

  it("cae a null si la unidad pasa el largo máximo", () => {
    const larga = "a".repeat(MAX_UNIT_LENGTH + 1);
    expect(resolvePreferences({ unitSingular: larga }).unitSingular).toBeNull();
  });

  it("descarta una unidad bloqueada que ya estaba guardada", () => {
    // La validación de la API puede haber cambiado, o la fila puede venir de
    // otro lado. El resolver es la última línea: min/hora = 60 no se muestra.
    expect(resolvePreferences({ unitSingular: "horas" }).unitSingular).toBeNull();
  });

  it("ignora un valor no booleano y usa el default", () => {
    expect(resolvePreferences({ journal: "sí" }).journal).toBe(true);
    expect(resolvePreferences({ social: 0 }).social).toBe(true);
  });

  it("ignora una unidad que no es string", () => {
    expect(resolvePreferences({ unitSingular: 42 }).unitSingular).toBeNull();
  });
});

describe("validateUnit", () => {
  it.each(["kata", "página", "commit", "ejercicio"])("acepta %s", (unidad) => {
    expect(validateUnit(unidad)).toEqual({ ok: true });
  });

  it("rechaza vacío", () => {
    expect(validateUnit("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("rechaza lo que pasa el largo máximo", () => {
    expect(validateUnit("a".repeat(MAX_UNIT_LENGTH + 1))).toEqual({
      ok: false,
      reason: "too-long",
    });
  });

  it.each(["hora", "horas", "sesión", "pomodoros", "día", "semanas"])(
    "rechaza %s porque es tiempo, no algo que se produzca",
    (unidad) => {
      // Con "horas" como unidad, min/hora da 60 para siempre: correcto y basura.
      expect(validateUnit(unidad)).toEqual({ ok: false, reason: "is-time" });
    }
  );

  it.each(["Días", "SESIONES", "  Horas  ", "dias", "sesion"])(
    "rechaza %s: compara sin tildes, sin mayúsculas y sin espacios",
    (unidad) => {
      expect(validateUnit(unidad)).toEqual({ ok: false, reason: "is-time" });
    }
  );
});

describe("UNIT_PRESETS", () => {
  it("todos pasan su propia validación", () => {
    for (const preset of UNIT_PRESETS) {
      expect(validateUnit(preset.singular), preset.singular).toEqual({ ok: true });
    }
  });

  it("traen el plural ya resuelto, para no depender de pluralizeEs en la UI", () => {
    for (const preset of UNIT_PRESETS) {
      expect(preset.plural.length, preset.singular).toBeGreaterThan(0);
      expect(preset.plural).not.toBe(preset.singular);
    }
  });
});

describe("pluralizeEs", () => {
  it.each([
    ["bloque", "bloques"],
    ["página", "páginas"],
    ["ejercicio", "ejercicios"],
  ])("%s → %s (termina en vocal, suma s)", (singular, plural) => {
    expect(pluralizeEs(singular)).toBe(plural);
  });

  it.each([
    ["nivel", "niveles"],
    ["unidad", "unidades"],
  ])("%s → %s (termina en consonante, suma es)", (singular, plural) => {
    expect(pluralizeEs(singular)).toBe(plural);
  });

  it("lápiz → lápices (la z pasa a ces)", () => {
    expect(pluralizeEs("lápiz")).toBe("lápices");
  });

  it("tesis → tesis (termina en s, no cambia)", () => {
    expect(pluralizeEs("tesis")).toBe("tesis");
  });
});
