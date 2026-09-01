import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * El sistema de planes se apoya en que un agente escriba el plan y otro lo
 * tome. Eso sólo funciona si el estado es confiable, y el estado vive en dos
 * lugares por necesidad: el índice (para leerlo de un vistazo) y el encabezado
 * de cada plan (para no tener que abrir dos archivos).
 *
 * Dos lugares es duplicación, y la duplicación diverge. Estos tests son lo que
 * la mantiene sincronizada: si alguien marca un plan completado en un solo
 * lado, CI se pone en rojo antes del merge.
 */

const raizRepo = path.resolve(__dirname, "../../..");
const dirPlanes = path.join(raizRepo, "docs", "planes");

const indice = readFileSync(path.join(dirPlanes, "README.md"), "utf8");
const claudeMd = readFileSync(path.join(raizRepo, "CLAUDE.md"), "utf8");

/** Los únicos tres estados que un plan puede declarar. */
const MARCADORES = "⬜|🔨|✅";

/** `| [002](002-client-id.md) | Título | ⬜ Pendiente |` */
const FILA_INDICE = new RegExp(
  `^\\|\\s*\\[(\\d{3})\\]\\(([^)]+)\\)\\s*\\|[^|]*\\|\\s*(${MARCADORES})`,
);

/** `**Estado:** ⬜ Pendiente` — al principio del plan, con prosa opcional después */
const ESTADO_PLAN = new RegExp(`^\\*\\*Estado:\\*\\*\\s*(${MARCADORES})`, "m");

type FilaIndice = { numero: string; archivo: string; marcador: string };

function filasDelIndice(): FilaIndice[] {
  return indice
    .split("\n")
    .map((linea) => linea.match(FILA_INDICE))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ numero: m[1], archivo: m[2], marcador: m[3] }));
}

function archivosDePlan(): string[] {
  return readdirSync(dirPlanes)
    .filter((nombre) => /^\d{3}-.+\.md$/.test(nombre))
    .sort();
}

function estadoDelPlan(archivo: string): string | null {
  const contenido = readFileSync(path.join(dirPlanes, archivo), "utf8");
  return contenido.match(ESTADO_PLAN)?.[1] ?? null;
}

describe("índice de planes", () => {
  it("tiene al menos un plan que auditar", () => {
    // Si esto falla, los demás tests pasarían en vacío y no garantizarían nada.
    expect(archivosDePlan().length).toBeGreaterThan(0);
    expect(filasDelIndice().length).toBeGreaterThan(0);
  });

  it("lista todos los planes del directorio", () => {
    const enElIndice = filasDelIndice().map((f) => f.archivo).sort();
    expect(enElIndice).toEqual(archivosDePlan());
  });

  it("no lista planes que no existen", () => {
    const existentes = archivosDePlan();
    for (const fila of filasDelIndice()) {
      expect(
        existentes,
        `el índice apunta a ${fila.archivo}, que no existe`,
      ).toContain(fila.archivo);
    }
  });

  it("numera cada fila igual que el archivo al que apunta", () => {
    for (const fila of filasDelIndice()) {
      expect(
        fila.archivo.startsWith(fila.numero),
        `la fila ${fila.numero} apunta a ${fila.archivo}`,
      ).toBe(true);
    }
  });
});

describe("estado de cada plan", () => {
  it("está declarado en el encabezado del plan", () => {
    for (const archivo of archivosDePlan()) {
      expect(
        estadoDelPlan(archivo),
        `${archivo} no declara "**Estado:** ⬜|🔨|✅" en su encabezado`,
      ).not.toBeNull();
    }
  });

  it("coincide con el estado del índice", () => {
    // Ésta es la garantía central: marcar un plan completado en un solo lado
    // pone CI en rojo. Sin esto, un agente nuevo puede arrancar a implementar
    // algo que ya está hecho.
    for (const fila of filasDelIndice()) {
      expect(
        estadoDelPlan(fila.archivo),
        `${fila.archivo}: el índice dice ${fila.marcador} y el plan dice otra cosa`,
      ).toBe(fila.marcador);
    }
  });
});

describe("CLAUDE.md como puerta de entrada", () => {
  it("apunta al índice", () => {
    // CLAUDE.md se carga solo en cada sesión: es lo único que un agente lee sin
    // que nadie se lo pida. Si pierde este link, el sistema entero es invisible.
    expect(claudeMd).toContain("docs/planes/README.md");
  });

  it("no enlaza planes individuales", () => {
    // Enlazar un plan desde acá es reconstruir el índice en un segundo lugar.
    // El índice es la única fuente de verdad: CLAUDE.md apunta a él y nada más.
    const enlacesAPlanes = claudeMd.match(/docs\/planes\/\d{3}-[^)\s]+/g) ?? [];
    expect(
      enlacesAPlanes,
      "CLAUDE.md enlaza planes individuales; debe enlazar sólo el índice",
    ).toEqual([]);
  });

  it("no repite el estado de ningún plan", () => {
    // Cinturón además de tirantes: aunque la tabla se rearme sin links, una
    // línea que mencione un plan y su marcador vuelve a duplicar el estado.
    const marcador = new RegExp(MARCADORES);
    const mencionaPlan = /\b\d{3}\b|docs\/planes/;
    const duplicadas = claudeMd
      .split("\n")
      .filter((linea) => marcador.test(linea) && mencionaPlan.test(linea));
    expect(
      duplicadas,
      "estas líneas de CLAUDE.md repiten el estado de un plan",
    ).toEqual([]);
  });
});
