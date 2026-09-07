import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudyReports } from "../StudyReports";
import type { EfficiencyRow } from "@/lib/analytics/efficiency";

function row(partial: Partial<EfficiencyRow> & { day: string }): EfficiencyRow {
  const base = {
    label_id: null,
    label_name: null,
    label_color: null,
    total_seconds: 0,
    total_chunks: 0,
    sessions: 0,
    distractions: 0,
    ...partial,
  };
  // Por defecto todo el tiempo de la fila produjo unidades, que es como venian
  // TODAS mientras la query filtraba por `chunks > 0`. Las filas sin unidades
  // -- el caso que este PR abre -- quedan en 0 solas.
  return { unit_seconds: base.total_chunks > 0 ? base.total_seconds : 0, ...base };
}

/**
 * Dos semanas consecutivas (arrancan domingo) en las que todo mejoró:
 * min/bloque 15 -> 10, bloques/día 4 -> 6, distracciones/hora 2 -> 1.
 */
const DOS_SEMANAS = [
  row({ day: "2026-08-17", total_seconds: 3600, total_chunks: 4, sessions: 2, distractions: 2 }),
  row({ day: "2026-08-24", total_seconds: 3600, total_chunks: 6, sessions: 2, distractions: 1 }),
];

function stubRows(rows: EfficiencyRow[]) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rows }) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const BLOQUE = { singular: "bloque", plural: "bloques" };

function valueOf(testId: string): string {
  return screen.getByTestId(testId).textContent ?? "";
}

beforeEach(() => vi.restoreAllMocks());

describe("StudyReports", () => {
  it("pide las metricas al endpoint de eficiencia", async () => {
    const fetchMock = stubRows([]);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/stats/efficiency"))
    );
  });

  it("muestra las seis metricas del periodo actual", async () => {
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    // Nivel 1 — sale de las sesiones
    await waitFor(() => expect(valueOf("metric-hours")).toContain("1"));
    expect(valueOf("metric-worked-days")).toContain("1");
    expect(valueOf("metric-distractions-per-hour")).toContain("1");
    // Nivel 2 — necesita unidades
    expect(valueOf("metric-minutes-per-block")).toContain("10");
    expect(valueOf("metric-blocks-per-day")).toContain("6");
    expect(valueOf("metric-study-days")).toContain("1");
  });

  it("nunca dice chunk: ese es el nombre de la columna", async () => {
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() => screen.getByTestId("metric-minutes-per-block"));
    expect(document.body.textContent).toMatch(/bloque/i);
    expect(document.body.textContent).not.toMatch(/chunk/i);
  });

  it("un min/bloque que BAJA se marca como mejora", async () => {
    // La trampa que este test cuida: min/bloque y bloques/dia mejoran en
    // direcciones opuestas. Un "verde si sube" pintaria de verde un
    // min/bloque que empeoro.
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() =>
      expect(screen.getByTestId("trend-minutes-per-block")).toHaveAttribute("data-trend", "better")
    );
  });

  it("un bloques/dia que SUBE se marca como mejora", async () => {
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() =>
      expect(screen.getByTestId("trend-blocks-per-day")).toHaveAttribute("data-trend", "better")
    );
  });

  it("menos distracciones por hora es mejora", async () => {
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() =>
      expect(screen.getByTestId("trend-distractions-per-hour")).toHaveAttribute(
        "data-trend",
        "better"
      )
    );
  });

  it("sin periodo anterior no inventa una comparacion", async () => {
    stubRows([DOS_SEMANAS[1]]);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() => screen.getByTestId("metric-minutes-per-block"));
    expect(screen.queryByTestId("trend-minutes-per-block")).toBeNull();
  });

  it("cortes/hora bajo el piso de muestra queda en guion, sin mostrar el 120", async () => {
    // El piso sigue vivo en la logica: lo que se saco es el texto que lo
    // explicaba, no la proteccion. Una sesion de 1 minuto con 2 cortes daria
    // 120 cortes/hora.
    stubRows([
      row({ day: "2026-08-24", total_seconds: 60, total_chunks: 1, sessions: 1, distractions: 2 }),
    ]);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() => expect(valueOf("metric-distractions-per-hour")).toContain("—"));
    expect(document.body.textContent).not.toMatch(/120/);
  });

  it("no cuelga leyendas explicativas en el panel", async () => {
    // Decision del usuario: tres parrafos grises apilados son un muro de
    // texto. Los numeros se explican solos o no se explican.
    stubRows([DOS_SEMANAS[1]]);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() => screen.getByTestId("metric-minutes-per-block"));
    expect(screen.queryByTestId("no-previous-period")).toBeNull();
    expect(screen.queryByTestId("rate-floor-hint")).toBeNull();
    expect(document.body.textContent).not.toMatch(/porcion/i);
  });

  it("cambia de semana a mes y recalcula", async () => {
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() => expect(valueOf("metric-minutes-per-block")).toContain("10"));

    await userEvent.click(screen.getByRole("button", { name: /mes/i }));

    // Las dos semanas caen en el mismo mes: 7200s / 10 bloques = 12 min/bloque
    // y 2 dias de estudio.
    await waitFor(() => expect(valueOf("metric-minutes-per-block")).toContain("12"));
    expect(valueOf("metric-study-days")).toContain("2");
  });

  it("filtra por materia al apagar un chip", async () => {
    stubRows([
      row({
        day: "2026-08-24",
        label_id: 1,
        label_name: "RRHH",
        total_seconds: 3600,
        total_chunks: 2,
        sessions: 1,
      }),
      row({
        day: "2026-08-24",
        label_id: 2,
        label_name: "Derecho",
        total_seconds: 3600,
        total_chunks: 6,
        sessions: 1,
      }),
    ]);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    // Las dos juntas: 7200s / 8 bloques = 15 min/bloque
    await waitFor(() => expect(valueOf("metric-minutes-per-block")).toContain("15"));

    await userEvent.click(screen.getByRole("button", { name: /RRHH/i }));

    // Solo Derecho: 3600s / 6 bloques = 10 min/bloque
    await waitFor(() => expect(valueOf("metric-minutes-per-block")).toContain("10"));
  });

  it("lista las materias del periodo, de la mas costosa a la menos", async () => {
    stubRows([
      row({ day: "2026-08-24", label_id: 1, label_name: "RRHH", total_seconds: 3600, total_chunks: 2 }),
      row({ day: "2026-08-24", label_id: 2, label_name: "Derecho", total_seconds: 3600, total_chunks: 6 }),
    ]);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() => screen.getByTestId("label-breakdown"));
    const nombres = screen
      .getAllByTestId(/^label-row-/)
      .map((el) => el.getAttribute("data-label-name"));
    expect(nombres).toEqual(["RRHH", "Derecho"]);
  });

  it("el vacio ya no culpa a las unidades: solo queda si no hubo ni una sesion", async () => {
    stubRows([]);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() => screen.getByTestId("reports-empty"));
    const texto = screen.getByTestId("reports-empty").textContent ?? "";
    // Decir "cargaste bloques" seria mentir: desde que el informe arranca en
    // las sesiones, lo unico que deja el panel vacio es no haber trabajado.
    expect(texto).not.toMatch(/bloques/i);
    expect(texto).not.toMatch(/teor[íi]a/i);
    expect(texto).toMatch(/pomodoro/i);
  });

  it("si el fetch falla lo dice en vez de mostrar ceros", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);
    await waitFor(() => screen.getByTestId("reports-error"));
  });

  it("el boton de volver avisa al padre", async () => {
    stubRows(DOS_SEMANAS);
    const onBack = vi.fn();
    render(<StudyReports onBack={onBack} unit={BLOQUE} />);
    await userEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe("StudyReports — el rótulo es la unidad del usuario", () => {
  const CARD = { singular: "card", plural: "cards" };

  it("las métricas hablan en la unidad configurada", async () => {
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} unit={CARD} />);

    // Aparece dos veces: como métrica del período y como título de la serie.
    await waitFor(() => expect(screen.getAllByText("min/card").length).toBeGreaterThan(0));
    expect(screen.getAllByText("cards/día").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/bloque/i);
  });

  it("el desglose por materia también", async () => {
    stubRows([
      row({ day: "2026-08-17", total_seconds: 3600, total_chunks: 4, sessions: 2, label_id: 1, label_name: "Derecho" }),
    ]);
    render(<StudyReports onBack={vi.fn()} unit={CARD} />);

    await waitFor(() => expect(screen.getByTestId("label-breakdown")).toBeInTheDocument());
    expect(screen.getAllByText("min/card").length).toBeGreaterThan(0);
  });

  it("sin unidad configurada cae a un rótulo genérico en vez de romper", async () => {
    // Pasa si alguien cargó datos y después dejó de medir: los chunks viejos
    // siguen ahí y hay que rotularlos con algo que nunca sea incorrecto.
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} unit={null} />);

    await waitFor(() => expect(screen.getAllByText("min/unidad").length).toBeGreaterThan(0));
    expect(screen.getAllByText("unidades/día").length).toBeGreaterThan(0);
  });
});

describe("StudyReports — dos niveles: lo universal y lo que necesita unidades", () => {
  /** Dos semanas de trabajo real sin una sola unidad cargada. */
  const SIN_UNIDADES = [
    row({ day: "2026-08-17", total_seconds: 3600, sessions: 2, distractions: 2 }),
    row({ day: "2026-08-24", total_seconds: 3600, sessions: 2, distractions: 1 }),
  ];

  const METRICAS_DE_RITMO = ["minutes-per-block", "blocks-per-day", "study-days"];

  it("sin unidades muestra horas, dias trabajados y cortes", async () => {
    // El bug que motivo el plan 005, del lado de la UI: quien nunca cargo una
    // unidad veia el empty state para siempre. Ahora ve su mes.
    stubRows(SIN_UNIDADES);
    render(<StudyReports onBack={vi.fn()} unit={null} />);

    await waitFor(() => expect(valueOf("metric-hours")).toContain("1"));
    expect(valueOf("metric-worked-days")).toContain("1");
    expect(valueOf("metric-distractions-per-hour")).toContain("1");
    expect(screen.queryByTestId("reports-empty")).toBeNull();
  });

  it("sin unidades no muestra las metricas de ritmo", async () => {
    // No es que valgan cero: no existen. Un "0 min/unidad" seria un numero
    // inventado sobre un dato que nadie cargo.
    stubRows(SIN_UNIDADES);
    render(<StudyReports onBack={vi.fn()} unit={null} />);

    await waitFor(() => screen.getByTestId("metric-hours"));
    for (const id of METRICAS_DE_RITMO) {
      expect(screen.queryByTestId(`metric-${id}`)).toBeNull();
    }
  });

  it("sin unidades tampoco dibuja las series ni el desglose por materia", async () => {
    // Las dos series son de min/unidad y unidades/dia, y el desglose muestra
    // min/unidad: sin unidades serian tres cajas vacias.
    stubRows(SIN_UNIDADES);
    render(<StudyReports onBack={vi.fn()} unit={null} />);

    await waitFor(() => screen.getByTestId("metric-hours"));
    expect(screen.queryByTestId("series-minutesPerBlock")).toBeNull();
    expect(screen.queryByTestId("series-blocksPerDay")).toBeNull();
    expect(screen.queryByTestId("label-breakdown")).toBeNull();
  });

  it("sin unidades no explica su ausencia: muestra menos cosas y listo", async () => {
    // El 004 ya cerro esta discusion: las leyendas grises se sacaron por muro
    // de texto. Que el panel muestre menos ES la respuesta.
    stubRows(SIN_UNIDADES);
    render(<StudyReports onBack={vi.fn()} unit={null} />);

    await waitFor(() => screen.getByTestId("metric-hours"));
    expect(document.body.textContent).not.toMatch(/todav[íi]a no cargaste/i);
    expect(document.body.textContent).not.toMatch(/config[uú]r/i);
  });

  it("con la primera unidad cargada aparecen las seis, sin prender nada", async () => {
    // Una metrica no se prende: se calcula o no se calcula. Alcanza con que
    // haya con que calcularla.
    stubRows([
      SIN_UNIDADES[0],
      row({
        day: "2026-08-24",
        total_seconds: 3600,
        unit_seconds: 1800,
        total_chunks: 3,
        sessions: 2,
        distractions: 1,
      }),
    ]);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);

    await waitFor(() => screen.getByTestId("metric-minutes-per-block"));
    for (const id of METRICAS_DE_RITMO) {
      expect(screen.getByTestId(`metric-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("metric-hours")).toBeInTheDocument();
    expect(screen.getByTestId("metric-worked-days")).toBeInTheDocument();
  });

  it("las horas cuentan el tiempo sin unidades y min/unidad no", async () => {
    // La trampa del PR, verificada de punta a punta: 2 horas trabajadas, de
    // las cuales media produjo 3 unidades. Las horas dicen 2; min/unidad
    // divide 1800s por 3 y da 10, no 40.
    stubRows([
      row({
        day: "2026-08-24",
        total_seconds: 7200,
        unit_seconds: 1800,
        total_chunks: 3,
        sessions: 4,
        distractions: 2,
      }),
    ]);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);

    await waitFor(() => expect(valueOf("metric-hours")).toContain("2"));
    expect(valueOf("metric-minutes-per-block")).toContain("10");
  });

  it("dias trabajados y dias con avance son metricas distintas", async () => {
    // Tres dias sentado, uno solo con unidades. Si los dos rotulos dieran el
    // mismo numero, uno de los dos estaria mal calculado.
    stubRows([
      row({ day: "2026-08-24", total_seconds: 3600, total_chunks: 4, sessions: 2 }),
      row({ day: "2026-08-25", total_seconds: 3600, sessions: 2 }),
      row({ day: "2026-08-26", total_seconds: 3600, sessions: 2 }),
    ]);
    render(<StudyReports onBack={vi.fn()} unit={BLOQUE} />);

    await waitFor(() => expect(valueOf("metric-worked-days")).toContain("3"));
    expect(valueOf("metric-study-days")).toContain("1");
  });

  it("sin ninguna sesion sigue habiendo empty state", async () => {
    stubRows([]);
    render(<StudyReports onBack={vi.fn()} unit={null} />);
    await waitFor(() => screen.getByTestId("reports-empty"));
    expect(screen.queryByTestId("metric-hours")).toBeNull();
  });
});
