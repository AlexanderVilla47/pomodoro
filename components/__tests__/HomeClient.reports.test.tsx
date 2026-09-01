import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Sólo Dashboard queda real: es el que trae el botón que abre los informes.
 * Todo lo demás son stubs — lo que se prueba acá es el layout del panel, no
 * el timer ni la música.
 */
function stub(testId: string) {
  return () => <div data-testid={testId} />;
}

vi.mock("@/context/TimerContext", () => ({
  TimerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/context/YouTubePlayerContext", () => ({
  YouTubePlayerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/MusicPanel", () => ({ MusicPanel: stub("music-panel") }));
vi.mock("@/components/PomodoroTimer", () => ({ PomodoroTimer: stub("timer") }));
vi.mock("@/components/Historial", () => ({ Historial: stub("historial") }));
vi.mock("@/components/Friends", () => ({ FriendsPanel: stub("friends") }));
vi.mock("@/components/Settings/SettingsPanel", () => ({ SettingsPanel: stub("settings") }));
vi.mock("@/components/Confetti", () => ({ Confetti: stub("confetti") }));
vi.mock("@/components/UserBadge", () => ({ UserBadge: stub("user-badge") }));
vi.mock("@/components/InstallButton", () => ({ InstallButton: stub("install") }));
vi.mock("@/components/JournalPrompt", () => ({ JournalPrompt: stub("journal") }));
vi.mock("@/components/JournalPrompt/JournalBridge", () => ({ JournalBridge: stub("bridge") }));
vi.mock("@/components/PresenceHeartbeat", () => ({ PresenceHeartbeat: stub("presence") }));
vi.mock("@/components/CheerPulse", () => ({ CheerPulse: stub("cheer") }));
vi.mock("@/components/LabelSelector", () => ({ LabelSelector: stub("labels") }));
// HomeClient hace `if (!settings) return null`, asi que sin settings no
// renderiza nada.
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      id: 1,
      work_duration: 1500,
      short_break_duration: 300,
      long_break_duration: 900,
      sessions_until_long_break: 4,
    },
    updateSettings: vi.fn(),
  }),
}));
vi.mock("@/hooks/useWorkLogger", () => ({
  useWorkLogger: () => ({ saveWorkLog: vi.fn() }),
}));
vi.mock("@/hooks/useOfflineSync", () => ({ useOfflineSync: () => ({ flush: vi.fn() }) }));
vi.mock("@/lib/notifications", () => ({
  requestNotificationPermission: vi.fn().mockResolvedValue("granted"),
}));
vi.mock("gsap", () => ({
  default: { to: vi.fn((obj, { onUpdate }) => { if (onUpdate) onUpdate(); return {}; }) },
}));

import { HomeClient } from "../HomeClient";
import { requestNotificationPermission } from "@/lib/notifications";

beforeEach(() => {
  // clearAllMocks y no restoreAllMocks: restore le borra la implementacion a
  // los vi.fn() de las factories de arriba y requestNotificationPermission
  // vuelve a devolver undefined, que revienta en el .catch de HomeClient.
  vi.clearAllMocks();
  vi.mocked(requestNotificationPermission).mockResolvedValue(true);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          url.includes("/efficiency")
            ? { rows: [] }
            : {
                today: { count: 0, total_seconds: 0, distraction_count: 0 },
                week: { count: 0, total_seconds: 0, distraction_count: 0 },
              },
      })
    )
  );
});

async function abrirInformes() {
  const botones = await screen.findAllByRole("button", { name: /informes/i });
  await userEvent.click(botones[0]);
}

describe("HomeClient — panel de informes", () => {
  it("el MusicPanel NO se desmonta al abrir los informes", async () => {
    // La trampa que este test cuida. El player de Spotify vive en un ref
    // adentro de useSpotifyPlayer, y el hook no tiene cleanup de unmount:
    // desmontar el panel deja el player huerfano — el audio sigue sonando
    // pero la app pierde el control — y al volver a montar, initSDK registra
    // un SEGUNDO dispositivo "Pomodoro". Por eso se esconde con CSS.
    render(<HomeClient />);
    const antes = screen.getAllByTestId("music-panel").length;
    expect(antes).toBeGreaterThan(0);

    await abrirInformes();

    await waitFor(() => screen.getByText(/informes de estudio/i));
    expect(screen.getAllByTestId("music-panel")).toHaveLength(antes);
  });

  it("saca la musica del layout con display:none, no con opacity", async () => {
    // En mobile alcanza con opacity porque los tabs son absolute inset-0
    // apilados. En desktop el MusicPanel esta en flujo flex normal: con
    // opacity seguiria ocupando su espacio y el panel de stats no podria
    // crecer.
    render(<HomeClient />);
    const musica = screen.getByTestId("desktop-music");
    expect(musica.className).not.toMatch(/\bhidden\b/);

    await abrirInformes();

    await waitFor(() => expect(musica.className).toMatch(/\bhidden\b/));
  });

  it("estira el bloque de stats cuando los informes estan abiertos", async () => {
    // Con max-h-[45%] quedan ~320px utiles y los informes necesitan ~480px.
    render(<HomeClient />);
    const stats = screen.getByTestId("desktop-stats");
    expect(stats.className).toMatch(/max-h-\[45%\]/);

    await abrirInformes();

    await waitFor(() => expect(stats.className).not.toMatch(/max-h-\[45%\]/));
  });

  it("devuelve la musica y el alto al cerrar los informes", async () => {
    render(<HomeClient />);
    const musica = screen.getByTestId("desktop-music");
    const stats = screen.getByTestId("desktop-stats");

    await abrirInformes();
    await waitFor(() => expect(musica.className).toMatch(/\bhidden\b/));

    const volver = await screen.findAllByRole("button", { name: /volver/i });
    await userEvent.click(volver[0]);

    await waitFor(() => expect(musica.className).not.toMatch(/\bhidden\b/));
    expect(stats.className).toMatch(/max-h-\[45%\]/);
  });

  it("en mobile esconde el historial para que los informes tengan todo el alto", async () => {
    render(<HomeClient />);
    const botones = await screen.findAllByRole("button", { name: /informes/i });
    // El segundo Dashboard es el de mobile.
    await userEvent.click(botones[1]);

    await waitFor(() => expect(screen.queryByTestId("historial")).toBeNull());
  });
});
