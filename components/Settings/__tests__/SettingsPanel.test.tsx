import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPanel } from "../SettingsPanel";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";

const DEFAULT_SETTINGS = {
  id: 1,
  work_duration: 1500,
  short_break_duration: 300,
  long_break_duration: 900,
  long_break_interval: 4,
  notification_sound_enabled: true,
  preferences: DEFAULT_PREFERENCES,
};

describe("SettingsPanel", () => {
  it("renderiza los 5 campos de configuración", () => {
    const { container } = render(
      <SettingsPanel settings={DEFAULT_SETTINGS} onSave={vi.fn()} />
    );
    expect(container.querySelectorAll("input").length).toBeGreaterThanOrEqual(5);
  });

  it("llama onSave con los valores actualizados al enviar", async () => {
    const onSave = vi.fn();
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onSave={onSave} />);

    const workInput = screen.getByLabelText(/enfoque/i);
    await userEvent.clear(workInput);
    await userEvent.type(workInput, "30");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ work_duration: 1800 })
    ));
  });

  it("muestra error si work_duration < 1", async () => {
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onSave={vi.fn()} />);
    const workInput = screen.getByLabelText(/enfoque/i);
    await userEvent.clear(workInput);
    await userEvent.type(workInput, "0");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
  });
});

describe("SettingsPanel — unidad de avance", () => {
  const conUnidad = {
    ...DEFAULT_SETTINGS,
    preferences: { ...DEFAULT_PREFERENCES, unitSingular: "página", unitPlural: "páginas" },
  };

  it("ofrece el selector de unidad", () => {
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "cards" })).toBeInTheDocument();
  });

  it("guarda la unidad elegida junto al resto de la configuración", async () => {
    const onSave = vi.fn();
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "cards" }));
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({
            unitSingular: "card",
            unitPlural: "cards",
          }),
        })
      )
    );
  });

  it("avisa que el historial se mezcla al cambiar de unidad", async () => {
    // Los chunks viejos eran páginas y los nuevos van a ser cards: el promedio
    // los suma sin distinguirlos. Avisa, no impide — la decisión es del usuario.
    render(<SettingsPanel settings={conUnidad} onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "cards" }));
    expect(screen.getByRole("status")).toHaveTextContent(/páginas/i);
  });

  it("no avisa nada cuando antes no había unidad", async () => {
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "cards" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("deja dejar de medir, y eso saca la casilla del journal", async () => {
    const onSave = vi.fn();
    render(<SettingsPanel settings={conUnidad} onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: /no medir/i }));
    await userEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({ unitSingular: null, unitPlural: null }),
        })
      )
    );
  });
});
