import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnitPicker } from "../UnitPicker";
import { UNIT_PRESETS } from "@/lib/preferences";

const onChange = vi.fn();

beforeEach(() => vi.clearAllMocks());

function setup(props: Partial<React.ComponentProps<typeof UnitPicker>> = {}) {
  return render(<UnitPicker value={null} onChange={onChange} {...props} />);
}

describe("UnitPicker — la lista guiada", () => {
  it("ofrece los nueve presets", () => {
    setup();
    for (const preset of UNIT_PRESETS) {
      expect(screen.getByRole("button", { name: preset.plural })).toBeInTheDocument();
    }
  });

  it("elegir un preset guarda singular y plural de una", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "cards" }));
    expect(onChange).toHaveBeenCalledWith({ singular: "card", plural: "cards" });
  });

  it("marca el preset activo", () => {
    setup({ value: { singular: "card", plural: "cards" } });
    expect(screen.getByRole("button", { name: "cards" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});

describe("UnitPicker — texto libre", () => {
  it("prellena el plural mientras nadie lo edite", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/tu unidad/i), "ejercicio");
    expect(screen.getByLabelText(/plural/i)).toHaveValue("ejercicios");
  });

  it("deja de seguir al singular una vez que se edita el plural a mano", async () => {
    // "card" pluralizado por regla da "cardes": el usuario lo corrige una vez y
    // la app no se lo puede volver a pisar.
    setup();
    await userEvent.type(screen.getByLabelText(/tu unidad/i), "card");
    await userEvent.clear(screen.getByLabelText(/plural/i));
    await userEvent.type(screen.getByLabelText(/plural/i), "cards");
    await userEvent.type(screen.getByLabelText(/tu unidad/i), "s");

    expect(screen.getByLabelText(/plural/i)).toHaveValue("cards");
  });

  it("guarda la unidad escrita a mano", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/tu unidad/i), "kata");
    await userEvent.click(screen.getByRole("button", { name: /usar/i }));
    expect(onChange).toHaveBeenCalledWith({ singular: "kata", plural: "katas" });
  });

  it("rechaza una unidad de tiempo y explica por qué", async () => {
    // Con "horas" como unidad, min/hora da 60 para siempre: correcto y basura.
    setup();
    await userEvent.type(screen.getByLabelText(/tu unidad/i), "horas");
    await userEvent.click(screen.getByRole("button", { name: /usar/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/ya mide tu tiempo/i);
  });

  it("rechaza una unidad vacía", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /usar/i }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("arranca con la unidad actual cuando no es un preset, para poder editarla", () => {
    setup({ value: { singular: "kata", plural: "katas" } });
    expect(screen.getByLabelText(/tu unidad/i)).toHaveValue("kata");
  });
});

describe("UnitPicker — dejar de medir", () => {
  it("no ofrece la opción por defecto", () => {
    setup({ value: { singular: "card", plural: "cards" } });
    expect(screen.queryByRole("button", { name: /no medir/i })).not.toBeInTheDocument();
  });

  it("con allowClear manda null", async () => {
    setup({ value: { singular: "card", plural: "cards" }, allowClear: true });
    await userEvent.click(screen.getByRole("button", { name: /no medir/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
