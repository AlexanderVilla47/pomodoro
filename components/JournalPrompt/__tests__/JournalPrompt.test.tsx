import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JournalPrompt } from "../index";

const mockSave = vi.fn();
const mockClose = vi.fn();
const mockSaved = vi.fn();

function setup(
  sessionClientId: string | null = "uuid-1",
  variant: "mobile" | "desktop" = "desktop"
) {
  return render(
    <JournalPrompt
      sessionClientId={sessionClientId}
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
  it("muestra el formulario cuando sessionClientId no es null", () => {
    setup();
    expect(screen.getByText("¿En qué trabajaste?")).toBeInTheDocument();
  });

  it("el botón Saltar llama onClose sin guardar", () => {
    setup();
    fireEvent.click(screen.getByText("Saltar"));
    expect(mockClose).toHaveBeenCalledOnce();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("Guardar llama saveWorkLog con sessionClientId, notes y topics, luego onSaved", async () => {
    setup("uuid-5");

    fireEvent.change(screen.getByPlaceholderText(/Descripción/i), {
      target: { value: "Estudié grafos" },
    });

    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith({
        sessionClientId: "uuid-5",
        notes: "Estudié grafos",
        topics: [],
        isTheory: false,
        chunks: null,
      });
      expect(mockSaved).toHaveBeenCalledOnce();
    });
  });

  it("Enter en el input de topics agrega un chip", () => {
    setup();
    const input = screen.getByPlaceholderText("Título: ej. Unidad 1, Sesión de trabajo...");
    fireEvent.change(input, { target: { value: "grafos" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("grafos")).toBeInTheDocument();
  });

  it("Backspace con draft vacío elimina el último chip", () => {
    setup();
    const input = screen.getByPlaceholderText("Título: ej. Unidad 1, Sesión de trabajo...");
    fireEvent.change(input, { target: { value: "tema1" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("tema1")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.queryByText("tema1")).not.toBeInTheDocument();
  });
});

describe("JournalPrompt — chunks de teoría", () => {
  const theoryCheckbox = () => screen.getByLabelText(/Estudié teoría por chunks/i);
  const plus = () => screen.getByLabelText("Sumar medio chunk");
  const minus = () => screen.getByLabelText("Restar medio chunk");

  it("el stepper está oculto mientras el checkbox esté destildado", () => {
    setup();
    expect(screen.queryByLabelText("Sumar medio chunk")).not.toBeInTheDocument();
  });

  it("al tildar el checkbox aparece el stepper arrancando en 1", () => {
    setup();
    fireEvent.click(theoryCheckbox());
    expect(screen.getByTestId("chunks-value")).toHaveTextContent("1");
  });

  it("el + suma de a medio chunk", () => {
    setup();
    fireEvent.click(theoryCheckbox());
    fireEvent.click(plus());
    expect(screen.getByTestId("chunks-value")).toHaveTextContent("1,5");
  });

  it("el − resta de a medio chunk y no baja de 0,5", () => {
    setup();
    fireEvent.click(theoryCheckbox());
    fireEvent.click(minus());
    expect(screen.getByTestId("chunks-value")).toHaveTextContent("0,5");
    fireEvent.click(minus());
    expect(screen.getByTestId("chunks-value")).toHaveTextContent("0,5");
  });

  it("guarda isTheory con la cantidad de chunks elegida", async () => {
    setup("uuid-7");
    fireEvent.click(theoryCheckbox());
    fireEvent.click(plus());
    fireEvent.click(plus());
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith({
        sessionClientId: "uuid-7",
        notes: null,
        topics: [],
        isTheory: true,
        chunks: 2,
      });
    });
  });

  it("destildar el checkbox descarta los chunks acumulados", async () => {
    setup("uuid-7");
    fireEvent.click(theoryCheckbox());
    fireEvent.click(plus());
    fireEvent.click(theoryCheckbox());
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ isTheory: false, chunks: null })
      );
    });
  });
});

