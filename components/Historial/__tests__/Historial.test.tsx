import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Historial } from "../index";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  // El ContributionGraph (vista calendario) pide /api/stats/heatmap al montar
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ days: [], years: [2026] }),
  });
});

describe("Historial", () => {
  it("muestra el calendario con el hint por defecto", async () => {
    render(<Historial refreshTrigger={0} />);
    expect(
      await screen.findByText(/Tocá una fecha para ver las sesiones/)
    ).toBeInTheDocument();
  });

  it("muestra el hint de doble tap cuando confirmTap está activo", async () => {
    render(<Historial refreshTrigger={0} confirmTap />);
    expect(
      await screen.findByText(/Tocá dos veces una fecha/)
    ).toBeInTheDocument();
  });
});
