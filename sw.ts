import { defaultCache } from "@serwist/next/worker";
import { NetworkFirst, Serwist } from "serwist";
import { puedeCachearNavegacion } from "./lib/sw/navigationCache";

declare const self: Window &
  typeof globalThis & {
    __SW_MANIFEST: (string | { url: string; revision: string | null })[];
  };

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // VA PRIMERO, antes de defaultCache: el matcher catch-all de defaultCache
    // (`sameOrigin && !pathname.startsWith("/api/")`) agarraba las navegaciones
    // y las guardaba en el cache `others` por 24hs. Como `/` redirige a /login
    // cuando no hay sesion, ahi quedaba el login cacheado bajo la home, y
    // despues se lo servia a usuarios ya logueados sin consultar al server.
    //
    // Al matchear primero, las navegaciones dejan de pasar por `others`: las
    // entradas envenenadas que ya existen en los navegadores quedan huerfanas
    // y no se leen mas. El usuario afectado se cura solo al abrir la app.
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "navigations",
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              puedeCachearNavegacion(response) ? response : null,
          },
        ],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
