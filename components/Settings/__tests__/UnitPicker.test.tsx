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

// Elegir la unidad es elegir de una lista y nada mas. Escribirla a mano obligaba
// al usuario a conjugar un plural adentro de un panel de configuracion, que es
// pedirle que haga de gramatico para usar un timer.
describe("UnitPicker — sin texto libre", () => {
  it("no ofrece campos para escribir una unidad", () => {
    setup();
    expect(screen.queryByLabelText(/tu unidad/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/plural/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /usar/i })).not.toBeInTheDocument();
  });

  // Una unidad vieja escrita a mano sigue viva en la base y en el historial: la
  // lista simplemente no la marca, porque ya no se puede volver a elegir.
  it("no marca ningún preset si la unidad guardada no está en la lista", () => {
    setup({ value: { singular: "kata", plural: "katas" } });
    for (const preset of UNIT_PRESETS) {
      expect(screen.getByRole("button", { name: preset.plural })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    }
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
