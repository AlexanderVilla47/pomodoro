import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dashboard } from "../index";

vi.mock("gsap", () => ({
  default: { to: vi.fn((obj, { onUpdate }) => { if (onUpdate) onUpdate(); return {}; }) },
}));

const STATS = {
  today: { count: 3, total_seconds: 4500 },
  week: { count: 10, total_seconds: 18000 },
};

/** Responde a /api/stats y a /api/stats/efficiency según la URL. */
function stubFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () => (url.includes("/efficiency") ? { rows: [] } : STATS),
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => vi.restoreAllMocks());

describe("Dashboard", () => {
  it("llama a GET /api/stats al montar", async () => {
    const fetchMock = stubFetch();

    render(<Dashboard refreshTrigger={0} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/stats"));
    });
  });

  it("vuelve a fetchear cuando refreshTrigger cambia", async () => {
    const fetchMock = stubFetch();

    const { rerender } = render(<Dashboard refreshTrigger={0} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(<Dashboard refreshTrigger={1} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

describe("Dashboard — entrada a los informes", () => {
  it("muestra el boton de informes junto a las tarjetas", async () => {
    stubFetch();
    render(<Dashboard refreshTrigger={0} />);
    expect(screen.getByRole("button", { name: /informes/i })).toBeTruthy();
  });

  it("abre los informes al tocarlo", async () => {
    stubFetch();
    render(<Dashboard refreshTrigger={0} />);

    await userEvent.click(screen.getByRole("button", { name: /informes/i }));

    await waitFor(() => expect(screen.getByText(/informes de estudio/i)).toBeTruthy());
  });

  it("oculta las tarjetas mientras los informes estan abiertos", async () => {
    stubFetch();
    render(<Dashboard refreshTrigger={0} />);
    await waitFor(() => expect(screen.getByText("Hoy")).toBeTruthy());

    await userEvent.click(screen.getByRole("button", { name: /informes/i }));

    await waitFor(() => expect(screen.queryByText("Hoy")).toBeNull());
  });

  it("vuelve a las tarjetas con la flecha", async () => {
    stubFetch();
    render(<Dashboard refreshTrigger={0} />);
    await userEvent.click(screen.getByRole("button", { name: /informes/i }));
    await waitFor(() => screen.getByRole("button", { name: /volver/i }));

    await userEvent.click(screen.getByRole("button", { name: /volver/i }));

    await waitFor(() => expect(screen.getByText("Hoy")).toBeTruthy());
  });

  it("avisa al padre cuando la vista cambia", async () => {
    // HomeClient necesita saberlo para estirar el panel: en desktop el bloque
    // de stats esta capado en max-h-[45%], que no alcanza para los informes.
    stubFetch();
    const onViewChange = vi.fn();
    render(<Dashboard refreshTrigger={0} onViewChange={onViewChange} />);

    await userEvent.click(screen.getByRole("button", { name: /informes/i }));
    expect(onViewChange).toHaveBeenCalledWith("analysis");

    await waitFor(() => screen.getByRole("button", { name: /volver/i }));
    await userEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(onViewChange).toHaveBeenCalledWith("cards");
  });

  it("el boton no dice chunk", async () => {
    stubFetch();
    render(<Dashboard refreshTrigger={0} />);
    expect(document.body.textContent).not.toMatch(/chunk/i);
  });
});
