import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudyReports } from "../StudyReports";
import type { EfficiencyRow } from "@/lib/analytics/efficiency";

function row(partial: Partial<EfficiencyRow> & { day: string }): EfficiencyRow {
  return {
    label_id: null,
    label_name: null,
    label_color: null,
    total_seconds: 0,
    total_chunks: 0,
    sessions: 0,
    distractions: 0,
    ...partial,
  };
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

function valueOf(testId: string): string {
  return screen.getByTestId(testId).textContent ?? "";
}

beforeEach(() => vi.restoreAllMocks());

describe("StudyReports", () => {
  it("pide las metricas al endpoint de eficiencia", async () => {
    const fetchMock = stubRows([]);
    render(<StudyReports onBack={vi.fn()} />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/stats/efficiency"))
    );
  });

  it("muestra las cuatro metricas del periodo actual", async () => {
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} />);
    await waitFor(() => expect(valueOf("metric-minutes-per-block")).toContain("10"));
    expect(valueOf("metric-blocks-per-day")).toContain("6");
    expect(valueOf("metric-study-days")).toContain("1");
    expect(valueOf("metric-distractions-per-hour")).toContain("1");
  });

  it("usa la palabra bloque y no chunk", async () => {
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} />);
    await waitFor(() => screen.getByTestId("metric-minutes-per-block"));
    expect(document.body.textContent).toMatch(/bloque/i);
    expect(document.body.textContent).not.toMatch(/chunk/i);
  });

  it("un min/bloque que BAJA se marca como mejora", async () => {
    // La trampa que este test cuida: min/bloque y bloques/dia mejoran en
    // direcciones opuestas. Un "verde si sube" pintaria de verde un
    // min/bloque que empeoro.
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId("trend-minutes-per-block")).toHaveAttribute("data-trend", "better")
    );
  });

  it("un bloques/dia que SUBE se marca como mejora", async () => {
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId("trend-blocks-per-day")).toHaveAttribute("data-trend", "better")
    );
  });

  it("menos distracciones por hora es mejora", async () => {
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId("trend-distractions-per-hour")).toHaveAttribute(
        "data-trend",
        "better"
      )
    );
  });

  it("sin periodo anterior no inventa una comparacion", async () => {
    stubRows([DOS_SEMANAS[1]]);
    render(<StudyReports onBack={vi.fn()} />);
    await waitFor(() => screen.getByTestId("metric-minutes-per-block"));
    expect(screen.queryByTestId("trend-minutes-per-block")).toBeNull();
  });

  it("cambia de semana a mes y recalcula", async () => {
    stubRows(DOS_SEMANAS);
    render(<StudyReports onBack={vi.fn()} />);
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
    render(<StudyReports onBack={vi.fn()} />);
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
    render(<StudyReports onBack={vi.fn()} />);
    await waitFor(() => screen.getByTestId("label-breakdown"));
    const nombres = screen
      .getAllByTestId(/^label-row-/)
      .map((el) => el.getAttribute("data-label-name"));
    expect(nombres).toEqual(["RRHH", "Derecho"]);
  });

  it("sin datos explica que solo cuentan las sesiones de teoria", async () => {
    stubRows([]);
    render(<StudyReports onBack={vi.fn()} />);
    await waitFor(() => screen.getByTestId("reports-empty"));
    // El empty state tiene que decir POR QUE esta vacio: si no, un usuario que
    // estudio toda la semana sin tildar teoria cree que la app se rompio.
    expect(screen.getByTestId("reports-empty").textContent).toMatch(/teor[íi]a/i);
  });

  it("si el fetch falla lo dice en vez de mostrar ceros", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    render(<StudyReports onBack={vi.fn()} />);
    await waitFor(() => screen.getByTestId("reports-error"));
  });

  it("el boton de volver avisa al padre", async () => {
    stubRows(DOS_SEMANAS);
    const onBack = vi.fn();
    render(<StudyReports onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
