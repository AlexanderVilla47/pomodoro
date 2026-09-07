"use client";

import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/preferences";

/**
 * Las preferencias del usuario, siempre completas.
 *
 * Existe para que los componentes pregunten "¿estoy prendido?" y no "¿qué dice
 * la columna?". El día que una de estas decisiones dependa de dos cosas —el
 * flag Y que tenga al menos un amigo, por ejemplo— se cambia acá y no en los
 * quince lugares que la consultan.
 *
 * Se apoya en `useSettings` y no en el contexto directo a propósito: deja un
 * solo punto de entrada a la configuración, así quien mockea `useSettings` no
 * tiene que acordarse de mockear también esto.
 *
 * Mientras la configuración viaja, devuelve los defaults en vez de `null`: un
 * componente que tiene que decidir si se monta no puede quedarse esperando, y
 * los defaults son justamente el comportamiento correcto para ese instante.
 */
export function usePreferences(): Preferences {
  const { settings } = useSettings();
  return settings?.preferences ?? DEFAULT_PREFERENCES;
}
