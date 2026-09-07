"use client";

import { useSettingsContext } from "@/context/SettingsContext";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/preferences";

/**
 * Las preferencias del usuario, siempre completas.
 *
 * Existe para que los componentes pregunten "¿estoy prendido?" y no "¿qué dice
 * la columna?". El día que una de estas decisiones dependa de dos cosas —el
 * flag Y que tenga al menos un amigo, por ejemplo— se cambia acá y no en los
 * quince lugares que la consultan.
 *
 * Mientras la configuración viaja, devuelve los defaults en vez de `null`: un
 * componente que tiene que decidir si se monta no puede quedarse esperando, y
 * los defaults son justamente el comportamiento correcto para ese instante.
 */
export function usePreferences(): Preferences {
  const { settings } = useSettingsContext();
  return settings?.preferences ?? DEFAULT_PREFERENCES;
}
