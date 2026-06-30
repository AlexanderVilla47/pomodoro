import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Historial } from "../index";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const emptyResponse = { logs: [], nextCursor: null, hasMore: false };

const fakeLog = {
  id: 1,
  session_id: 2,
  notes: "Estudié BFS",
  topics: ["BFS", "grafos"],
  created_at: new Date().toISOString(),
  session_type: "work",
  started_at: new Date().toISOString(),
  actual_duration: 1500,
  label_id: 3,
  label_name: "Algoritmos",
  label_color: "#FF5733",
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("Historial", () => {
  it("muestra empty state cuando no hay logs", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => emptyResponse });
    render(<Historial refreshTrigger={0} />);
    await waitFor(() => {
      expect(screen.getByText(/Todavía no anotaste nada/)).toBeInTheDocument();
    });
  });

  it("renderiza un log con notes, label y topics", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ logs: [fakeLog], nextCursor: null, hasMore: false }),
    });
    render(<Historial refreshTrigger={0} />);
    await waitFor(() => {
      expect(screen.getByText("Estudié BFS")).toBeInTheDocument();
      expect(screen.getByText("Algoritmos")).toBeInTheDocument();
      expect(screen.getByText("BFS")).toBeInTheDocument();
      expect(screen.getByText("grafos")).toBeInTheDocument();
    });
  });

  it("muestra 'Cargar más' cuando hasMore=true y lo oculta en false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logs: [fakeLog], nextCursor: "cursor-1", hasMore: true }),
    });
    render(<Historial refreshTrigger={0} />);
    await waitFor(() => {
      expect(screen.getByText("Cargar más")).toBeInTheDocument();
    });
  });

  it("appenda items al hacer click en 'Cargar más'", async () => {
    const log2 = { ...fakeLog, id: 2, notes: "Segunda sesión" };
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logs: [fakeLog], nextCursor: "cursor-1", hasMore: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logs: [log2], nextCursor: null, hasMore: false }),
      });

    render(<Historial refreshTrigger={0} />);
    await waitFor(() => screen.getByText("Cargar más"));

    fireEvent.click(screen.getByText("Cargar más"));

    await waitFor(() => {
      expect(screen.getByText("Estudié BFS")).toBeInTheDocument();
      expect(screen.getByText("Segunda sesión")).toBeInTheDocument();
      expect(screen.queryByText("Cargar más")).not.toBeInTheDocument();
    });
  });

  it("refetchea cuando refreshTrigger cambia", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => emptyResponse });
    const { rerender } = render(<Historial refreshTrigger={0} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    rerender(<Historial refreshTrigger={1} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
