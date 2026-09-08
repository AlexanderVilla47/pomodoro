/**
 * Decide si una respuesta de navegacion puede guardarse en el cache del
 * service worker.
 *
 * La respuesta de `/` NO es la misma para todos: depende de la sesion. Sin
 * sesion, app/page.tsx hace `redirect("/login")`, y el fetch del service
 * worker sigue ese redirect y termina con el HTML del login — pero guardado
 * bajo la clave de la home. A partir de ahi el usuario vuelve logueado y el
 * service worker le contesta el login desde el cache, sin que el pedido salga
 * de la maquina: `getSession()` no llega a correr nunca.
 *
 * `redirected` marca exactamente ese caso, y es lo unico que distingue una
 * home legitima de un login disfrazado de home.
 */
export function puedeCachearNavegacion(
  response: Pick<Response, "status" | "redirected">,
): boolean {
  return response.status === 200 && !response.redirected;
}
