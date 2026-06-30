import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JournalPrompt } from "../index";

const mockSave = vi.fn();
const mockClose = vi.fn();
const mockSaved = vi.fn();

function setup(sessionId: number | null = 1, variant: "mobile" | "desktop" = "desktop") {
  return render(
    <JournalPrompt
      sessionId={sessionId}
      variant={variant}
      onClose={mockClose}
      onSaved={mockSaved}
      saveWorkLog={mockSave}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSave.mockResolvedValue(undefined);
});

describe("JournalPrompt", () => {
  it("muestra el formulario cuando sessionId no es null", () => {
    setup(1);
    expect(screen.getByText("¿En qué trabajaste?")).toBeInTheDocument();
  });

  it("el botón Saltar llama onClose sin guardar", () => {
    setup(1);
    fireEvent.click(screen.getByText("Saltar"));
    expect(mockClose).toHaveBeenCalledOnce();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("Guardar llama saveWorkLog con sessionId, notes y topics, luego onSaved", async () => {
    setup(5);

    fireEvent.change(screen.getByPlaceholderText(/Ej:/), {
      target: { value: "Estudié grafos" },
    });

    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith({
        sessionId: 5,
        notes: "Estudié grafos",
        topics: [],
      });
      expect(mockSaved).toHaveBeenCalledOnce();
    });
  });

  it("Enter en el input de topics agrega un chip", () => {
    setup(1);
    const input = screen.getByPlaceholderText("BFS, grafos, hooks...");
    fireEvent.change(input, { target: { value: "grafos" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("grafos")).toBeInTheDocument();
  });

  it("Backspace con draft vacío elimina el último chip", () => {
    setup(1);
    const input = screen.getByPlaceholderText("BFS, grafos, hooks...");
    fireEvent.change(input, { target: { value: "tema1" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("tema1")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.queryByText("tema1")).not.toBeInTheDocument();
  });
});
