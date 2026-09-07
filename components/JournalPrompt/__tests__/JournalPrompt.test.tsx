import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JournalPrompt } from "../index";

const mockSave = vi.fn();
const mockClose = vi.fn();
const mockSaved = vi.fn();
const mockUnitChange = vi.fn();

const BLOQUE = { singular: "bloque", plural: "bloques" };

function setup(
  sessionClientId: string | null = "uuid-1",
  opts: { variant?: "mobile" | "desktop"; unit?: { singular: string; plural: string } | null } = {}
) {
  return render(
    <JournalPrompt
      sessionClientId={sessionClientId}
      variant={opts.variant ?? "desktop"}
      unit={opts.unit ?? null}
      onUnitChange={mockUnitChange}
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

describe("JournalPrompt — sin unidad configurada", () => {
  it("no muestra ninguna casilla de medición", () => {
    // El caso del usuario nuevo. "bloque" es media página del apunte de una
    // persona: encontrárselo en pantalla sin haberlo elegido no significa nada.
    setup();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/bloque/i);
  });

  it("ofrece configurarla con una línea discreta", () => {
    setup();
    expect(screen.getByRole("button", { name: /medir mi avance/i })).toBeInTheDocument();
  });

  it("el selector se abre ADENTRO del modal, sin mandar a Configuración", async () => {
    // El momento en que a alguien se le ocurre medir su avance es justo cuando
    // terminó de trabajar. Mandarlo a otra pantalla ahí pierde la intención.
    setup();
    fireEvent.click(screen.getByRole("button", { name: /medir mi avance/i }));
    expect(screen.getByRole("button", { name: "cards" })).toBeInTheDocument();
  });

  it("elegir una unidad la reporta hacia arriba", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /medir mi avance/i }));
    fireEvent.click(screen.getByRole("button", { name: "cards" }));
    expect(mockUnitChange).toHaveBeenCalledWith({ singular: "card", plural: "cards" });
  });

  it("guarda sin unidad como una sesión que no midió nada", async () => {
    setup("uuid-9");
    fireEvent.click(screen.getByText("Guardar"));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ isTheory: false, chunks: null })
      )
    );
  });
});

describe("JournalPrompt — con unidad configurada", () => {
  const theoryCheckbox = () => screen.getByLabelText(/Medí el avance en bloques/i);
  const plus = () => screen.getByLabelText("Sumar medio bloque");
  const minus = () => screen.getByLabelText("Restar medio bloque");

  it("no dice chunk en ningún lado", () => {
    // La unidad se llama como el usuario la llamó. "chunk" es el nombre de la
    // columna y no tiene por qué salir nunca a la superficie.
    setup("uuid-1", { unit: BLOQUE });
    fireEvent.click(theoryCheckbox());
    expect(document.body.textContent).not.toMatch(/chunk/i);
    expect(document.body.innerHTML).not.toMatch(/chunk/i);
  });

  it("el checkbox va DEBAJO de las cajas de texto", () => {
    // Primero se escribe qué se hizo, después se declara cómo se mide. Al
    // revés, el primer campo del modal es una casilla que la mayoría de las
    // sesiones deja sin tildar.
    setup("uuid-1", { unit: BLOQUE });
    const textarea = screen.getByPlaceholderText(/Descripción/i);
    const checkbox = theoryCheckbox();
    const posicion = textarea.compareDocumentPosition(checkbox);
    expect(posicion & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("el stepper está oculto mientras el checkbox esté destildado", () => {
    setup("uuid-1", { unit: BLOQUE });
    expect(screen.queryByLabelText("Sumar medio bloque")).not.toBeInTheDocument();
  });

  it("al tildar el checkbox aparece el stepper arrancando en 1", () => {
    setup("uuid-1", { unit: BLOQUE });
    fireEvent.click(theoryCheckbox());
    expect(screen.getByTestId("unit-value")).toHaveTextContent("1");
  });

  it("el + suma de a medio bloque", () => {
    setup("uuid-1", { unit: BLOQUE });
    fireEvent.click(theoryCheckbox());
    fireEvent.click(plus());
    expect(screen.getByTestId("unit-value")).toHaveTextContent("1,5");
  });

  it("el − resta de a medio bloque y no baja de 0,5", () => {
    setup("uuid-1", { unit: BLOQUE });
    fireEvent.click(theoryCheckbox());
    fireEvent.click(minus());
    expect(screen.getByTestId("unit-value")).toHaveTextContent("0,5");
    fireEvent.click(minus());
    expect(screen.getByTestId("unit-value")).toHaveTextContent("0,5");
  });

  it("guarda isTheory con la cantidad de bloques elegida", async () => {
    setup("uuid-7", { unit: BLOQUE });
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

  it("destildar el checkbox descarta los bloques acumulados", async () => {
    setup("uuid-7", { unit: BLOQUE });
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


describe("JournalPrompt — el rótulo es el que eligió el usuario", () => {
  const CARD = { singular: "card", plural: "cards" };

  it("la casilla habla de su unidad, no de bloques ni de teoría", () => {
    setup("uuid-1", { unit: CARD });
    expect(screen.getByLabelText(/Medí el avance en cards/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/bloque|teoría/i);
  });

  it("el stepper usa singular y plural según la cantidad", () => {
    setup("uuid-1", { unit: CARD });
    fireEvent.click(screen.getByLabelText(/Medí el avance en cards/i));

    expect(screen.getByText("card")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Sumar medio card"));
    expect(screen.getByText("cards")).toBeInTheDocument();
  });

  it("los aria-label del stepper acompañan a la unidad", () => {
    setup("uuid-1", { unit: CARD });
    fireEvent.click(screen.getByLabelText(/Medí el avance en cards/i));
    expect(screen.getByLabelText("Sumar medio card")).toBeInTheDocument();
    expect(screen.getByLabelText("Restar medio card")).toBeInTheDocument();
  });
});
