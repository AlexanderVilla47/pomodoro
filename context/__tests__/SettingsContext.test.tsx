import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsProvider } from "../SettingsContext";
import { useSettings } from "@/hooks/useSettings";

const DEFAULT_SETTINGS = {
  id: 1,
  work_duration: 1500,
  short_break_duration: 300,
  long_break_duration: 900,
  long_break_interval: 4,
  notification_sound_enabled: true,
};

function TestConsumer() {
  const { settings, updateSettings } = useSettings();
  if (!settings) return <div>loading</div>;
  return (
    <div>
      <span data-testid="work">{settings.work_duration}</span>
      <button onClick={() => updateSettings({ work_duration: 1800 })}>update</button>
    </div>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsProvider", () => {
  it("carga y expone la configuración del servidor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => DEFAULT_SETTINGS,
      })
    );

    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId("work").textContent).toBe("1500"));
  });

  it("llama a PUT /api/settings al invocar updateSettings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => DEFAULT_SETTINGS })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...DEFAULT_SETTINGS, work_duration: 1800 }),
      });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    await waitFor(() => screen.getByTestId("work"));

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "update" }));
    });

    await waitFor(() => expect(screen.getByTestId("work").textContent).toBe("1800"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const putCall = fetchMock.mock.calls[1];
    expect(putCall[0]).toBe("/api/settings");
    expect(putCall[1]?.method).toBe("PUT");
  });

  it("muestra loading mientras carga", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {}))
    );

    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>
    );

    expect(screen.getByText("loading")).toBeDefined();
  });
});
