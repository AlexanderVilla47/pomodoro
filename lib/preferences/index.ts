/**
 * Preferencias por usuario: qué features quiere y en qué unidad mide su avance.
 *
 * Todo acá es PURO — sin base, sin React, sin fetch. Es a propósito, y por el
 * mismo motivo que `lib/analytics/`: la capa de queries mockea el tag `sql`, así
 * que cualquier regla escrita en SQL o en un componente queda sin cobertura.
 *
 * Y hay una segunda razón, más importante: los defaults viven ACÁ y no en la
 * base. Un `DEFAULT true` en Postgres borra la diferencia entre "el usuario
 * eligió true" y "el usuario nunca eligió", y esa diferencia no se recupera
 * nunca más. Con la columna en `'{}'` y los defaults en código, se conserva.
 */

export interface Preferences {
  /**
   * Rótulo singular de la unidad de avance. `null` = sin configurar.
   *
   * NO tiene default. "bloque" es media página del apunte de una persona:
   * existe en su cocina, no en el mundo. Un usuario nuevo que lee "medí el
   * avance en bloques" no tiene forma de saber qué le están preguntando.
   */
  unitSingular: string | null;
  /** Plural. Se guarda aparte porque el español no se pluraliza a ciegas. */
  unitPlural: string | null;
  /** ¿Preguntar "¿en qué trabajaste?" al terminar cada pomodoro? */
  journal: boolean;
  /** Presencia + amigos + cheers. Es privacidad, no es gusto. */
  social: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  unitSingular: null,
  unitPlural: null,
  journal: true,
  social: true,
};

export const MAX_UNIT_LENGTH = 24;

/**
 * La lista guiada: un tap y listo, con las dos formas ya resueltas.
 *
 * Que traigan el plural escrito no es comodidad, es evitar `pluralizeEs` en el
 * camino más transitado: "card" pluralizado por regla da "cardes". El que elige
 * de la lista nunca ve un campo de plural ni una palabra rara.
 */
export const UNIT_PRESETS: ReadonlyArray<{ singular: string; plural: string }> = [
  { singular: "página", plural: "páginas" },
  { singular: "ejercicio", plural: "ejercicios" },
  { singular: "card", plural: "cards" },
  { singular: "problema", plural: "problemas" },
  { singular: "capítulo", plural: "capítulos" },
  { singular: "tema", plural: "temas" },
  { singular: "video", plural: "videos" },
  { singular: "práctico", plural: "prácticos" },
  { singular: "bloque", plural: "bloques" },
];

/**
 * Palabras que miden TIEMPO, no algo que se produzca.
 *
 * Con "horas" como unidad, min/hora da 60 para siempre: un número perfectamente
 * correcto y perfectamente inútil. La lista se guarda ya normalizada (sin
 * tildes, en minúscula) porque así se compara.
 */
export const BLOCKED_UNITS: readonly string[] = [
  "hora",
  "horas",
  "minuto",
  "minutos",
  "sesion",
  "sesiones",
  "pomodoro",
  "pomodoros",
  "dia",
  "dias",
  "semana",
  "semanas",
];

export type UnitValidation =
  | { ok: true }
  | { ok: false; reason: "empty" | "too-long" | "is-time" };

/** Sin tildes, sin mayúsculas y sin espacios: "Días" y "dias" son la misma palabra. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function validateUnit(raw: string): UnitValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_UNIT_LENGTH) return { ok: false, reason: "too-long" };
  if (BLOCKED_UNITS.includes(normalize(trimmed))) return { ok: false, reason: "is-time" };
  return { ok: true };
}

const VOWELS = "aeiouáéíóú";

/**
 * Plural del español, cubriendo lo que alguien tipea de verdad.
 *
 * No es perfecta y no puede serlo: los préstamos rompen la regla ("card" da
 * "cardes"). Por eso el plural se GUARDA y la UI lo muestra prellenado y
 * editable — la app admite que adivina, muestra su adivinanza y deja
 * corregirla. Aplicarla en silencio en el render sería peor: nadie la podría
 * arreglar nunca.
 */
export function pluralizeEs(singular: string): string {
  const word = singular.trim();
  if (word.length === 0) return word;

  const last = word[word.length - 1].toLowerCase();
  if (last === "s") return word;
  if (last === "z") return word.slice(0, -1) + "ces";
  if (VOWELS.includes(last)) return word + "s";
  return word + "es";
}

function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

/** Un string usable, o null. Nunca devuelve algo a medias. */
function cleanUnit(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return validateUnit(trimmed).ok ? trimmed : null;
}

function cleanBoolean(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

/**
 * JSONB crudo → objeto completo. Normaliza, no rechaza: una fila con basura
 * adentro tiene que resolver a algo usable.
 *
 * Corre en la capa de queries (`getSettings`), así que ningún componente ve
 * JSONB crudo ni tiene que decidir qué hacer con un campo faltante.
 */
export function resolvePreferences(raw: unknown): Preferences {
  if (!isPlainObject(raw)) return { ...DEFAULT_PREFERENCES };

  const unitSingular = cleanUnit(raw.unitSingular);

  // Un plural sin singular no identifica ninguna unidad: es un dato incompleto,
  // no media unidad. Y si el singular está y el plural no, se deriva en vez de
  // dejar a la UI eligiendo qué mostrar.
  const unitPlural =
    unitSingular === null ? null : cleanUnit(raw.unitPlural) ?? pluralizeEs(unitSingular);

  return {
    unitSingular,
    unitPlural,
    journal: cleanBoolean(raw.journal, DEFAULT_PREFERENCES.journal),
    social: cleanBoolean(raw.social, DEFAULT_PREFERENCES.social),
  };
}
