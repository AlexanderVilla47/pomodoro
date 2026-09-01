/**
 * Métricas de eficiencia de estudio.
 *
 * Todo el cálculo vive acá y no en SQL a propósito: los tests de la capa de
 * queries mockean el tag `sql`, así que cualquier fórmula escrita en SQL sería
 * matemática sin cobertura. SQL agrega crudo (sumas), estas funciones dividen.
 */

/**
 * Minutos por chunk de una sesión (o de un agregado: pasarle las sumas de
 * segundos y de chunks da el promedio ponderado, que es lo correcto —
 * promediar promedios deja que una sesión corta distorsione el resultado).
 *
 * Devuelve null cuando la división no tiene sentido, en vez de Infinity o NaN:
 * una sesión sin chunks cargados no es "infinitamente lenta", es un dato que no
 * existe y tiene que quedar afuera del análisis.
 */
export function minutesPerChunk(seconds: number, chunks: number): number | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (!Number.isFinite(chunks) || chunks <= 0) return null;
  return Math.round((seconds / 60 / chunks) * 10) / 10;
}
