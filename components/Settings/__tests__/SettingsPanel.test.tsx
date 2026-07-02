import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPanel } from "../SettingsPanel";

const DEFAULT_SETTINGS = {
  id: 1,
  work_duration: 1500,
  short_break_duration: 300,
  long_break_duration: 900,
  long_break_interval: 4,
  notification_sound_enabled: true,
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
