import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Lectura de sesion del lado del servidor: Server Components y route handlers.
 *
 * `disableRefresh` no es un detalle de performance, es lo que mantiene viva la
 * cookie. El refresh de better-auth hace dos cosas juntas: extiende la fila en
 * la base y reemite la cookie con un Max-Age nuevo. Aca la segunda mitad se
 * pierde — un Server Component no puede escribir cookies, y estas rutas llaman
 * a `auth.api` directo en vez de pasar por el handler HTTP, asi que el
 * Set-Cookie no viaja en ninguna respuesta.
 *
 * Si el refresh se gasta aca, se gasta para todos: `/api/auth/get-session`
 * (useSession), que es el unico camino donde la cookie si llega al navegador,
 * llega despues y ya no encuentra nada que renovar. Leyendo sin refrescar, esa
 * ventana queda intacta para quien puede aprovecharla.
 */
export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  });
}
