import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/preferences";

/**
 * Todo se stubea menos el layout de HomeClient: lo que se prueba aca es QUE se
 * monta y que no, segun las preferencias. Ni el timer ni la musica importan.
 */
function stub(testId: string) {
  return () => <div data-testid={testId} />;
}

/**
 * El TimerProvider stubeado guarda su `onSessionLogged`.
 *
 * Sin esto, "al terminar un pomodoro no pasa nada" es un test vacio: el timer
 * esta mockeado, la sesion nunca termina y el test pasa sin haber ejercitado
 * una sola linea de lo que dice cuidar.
 */
let terminarSesion: ((clientId: string | null) => void) | null = null;

vi.mock("@/context/TimerContext", () => ({
  TimerProvider: ({
    children,
    onSessionLogged,
  }: {
    children: React.ReactNode;
    onSessionLogged: (clientId: string | null) => void;
  }) => {
    terminarSesion = onSessionLogged;
    return <>{children}</>;
  },
}));
vi.mock("@/context/YouTubePlayerContext", () => ({
  YouTubePlayerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/MusicPanel", () => ({ MusicPanel: stub("music-panel") }));
vi.mock("@/components/PomodoroTimer", () => ({ PomodoroTimer: stub("timer") }));
vi.mock("@/components/Historial", () => ({ Historial: stub("historial") }));
vi.mock("@/components/Friends", () => ({ FriendsPanel: stub("friends") }));
vi.mock("@/components/Dashboard", () => ({ Dashboard: stub("dashboard") }));
vi.mock("@/components/Settings/SettingsPanel", () => ({ SettingsPanel: stub("settings") }));
vi.mock("@/components/Confetti", () => ({ Confetti: stub("confetti") }));
vi.mock("@/components/UserBadge", () => ({ UserBadge: stub("user-badge") }));
vi.mock("@/components/InstallButton", () => ({ InstallButton: stub("install") }));
vi.mock("@/components/JournalPrompt", () => ({ JournalPrompt: stub("journal") }));
vi.mock("@/components/JournalPrompt/JournalBridge", () => ({ JournalBridge: stub("bridge") }));
vi.mock("@/components/PresenceHeartbeat", () => ({ PresenceHeartbeat: stub("presence") }));
vi.mock("@/components/CheerPulse", () => ({ CheerPulse: stub("cheer") }));
vi.mock("@/components/LabelSelector", () => ({ LabelSelector: stub("labels") }));

/**
 * Las preferencias entran por `useSettings` y no por un mock de
 * `usePreferences`: el hook las lee de ahi, asi que mockear el de mas arriba
 * prueba el camino real y no una version paralela.
 */
let preferencias: Preferences = DEFAULT_PREFERENCES;

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      id: 1,
      work_duration: 1500,
      short_break_duration: 300,
      long_break_duration: 900,
      sessions_until_long_break: 4,
      preferences: preferencias,
    },
    updateSettings: vi.fn(),
  }),
}));

const saveWorkLog = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/useWorkLogger", () => ({
  useWorkLogger: () => ({ saveWorkLog }),
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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // clearAllMocks y no restoreAllMocks: restore le borra la implementacion a
  // los vi.fn() de las factories de arriba.
  vi.clearAllMocks();
  preferencias = DEFAULT_PREFERENCES;
  terminarSesion = null;
  saveWorkLog.mockResolvedValue(undefined);
  vi.mocked(requestNotificationPermission).mockResolvedValue(true);
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      names: [],
      count: 0,
      rows: [],
      today: { count: 0, total_seconds: 0, distraction_count: 0 },
      week: { count: 0, total_seconds: 0, distraction_count: 0 },
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

function urlsPedidas(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

describe("HomeClient — journal apagado", () => {
  beforeEach(() => {
    preferencias = { ...DEFAULT_PREFERENCES, journal: false };
  });

  it("no monta el prompt ni el bridge", () => {
    render(<HomeClient />);
    expect(screen.queryByTestId("journal")).toBeNull();
    expect(screen.queryByTestId("bridge")).toBeNull();
  });

  it("al terminar un pomodoro no aparece ninguna pregunta", async () => {
    render(<HomeClient />);
    await act(async () => terminarSesion?.("sesion-1"));
    expect(screen.queryByTestId("journal")).toBeNull();
  });
});

describe("HomeClient — journal prendido (el default)", () => {
  it("monta el prompt y el bridge", () => {
    render(<HomeClient />);
    expect(screen.getAllByTestId("journal").length).toBeGreaterThan(0);
    expect(screen.getByTestId("bridge")).toBeInTheDocument();
  });

  it("sigue preguntando al terminar un pomodoro", async () => {
    // El contrapeso del test de arriba: sin este, apagar el journal para
    // SIEMPRE pasaria los dos.
    render(<HomeClient />);
    const antes = screen.getAllByTestId("journal").length;
    await act(async () => terminarSesion?.("sesion-1"));
    expect(screen.getAllByTestId("journal").length).toBeGreaterThan(antes);
  });
});

describe("HomeClient — social apagado", () => {
  beforeEach(() => {
    preferencias = { ...DEFAULT_PREFERENCES, social: false };
  });

  it("no monta la presencia ni el pulso de alientos", () => {
    render(<HomeClient />);
    expect(screen.queryByTestId("presence")).toBeNull();
    expect(screen.queryByTestId("cheer")).toBeNull();
  });

  it("al terminar un pomodoro no pide el reveal de alientos", async () => {
    // Es el unico fetch social que no vive adentro de un componente: se
    // dispara desde handleSessionComplete, asi que no montar nada no alcanza
    // para apagarlo.
    render(<HomeClient />);
    await act(async () => terminarSesion?.("sesion-1"));
    expect(urlsPedidas().some((u) => u.includes("/api/cheers"))).toBe(false);
  });

  it("saca el tab de Amigos de los dos layouts", () => {
    render(<HomeClient />);
    expect(screen.queryByRole("button", { name: /amigos/i })).toBeNull();
    expect(screen.queryByTestId("friends")).toBeNull();
  });
});

describe("HomeClient — social prendido (el default)", () => {
  it("monta la presencia y el pulso, y ofrece el tab", () => {
    render(<HomeClient />);
    expect(screen.getByTestId("presence")).toBeInTheDocument();
    expect(screen.getByTestId("cheer")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /amigos/i }).length).toBeGreaterThan(0);
  });

  it("sigue pidiendo el reveal al terminar un pomodoro", async () => {
    render(<HomeClient />);
    await act(async () => terminarSesion?.("sesion-1"));
    expect(urlsPedidas().some((u) => u.includes("/api/cheers/reveal"))).toBe(true);
  });
});

describe("HomeClient — apagar lo social con el tab de Amigos abierto", () => {
  it("en desktop cae a Estadisticas en vez de dejar el panel en blanco", async () => {
    const { rerender } = render(<HomeClient />);
    // El primero es el de desktop: ese layout va antes en el DOM.
    await userEvent.click(screen.getAllByRole("button", { name: /amigos/i })[0]);
    // Con el tab en Amigos, el panel derecho de desktop deja de mostrar el
    // Dashboard y solo queda el de mobile.
    await waitFor(() => expect(screen.getAllByTestId("dashboard")).toHaveLength(1));

    preferencias = { ...DEFAULT_PREFERENCES, social: false };
    rerender(<HomeClient />);

    expect(screen.queryByTestId("friends")).toBeNull();
    expect(screen.getAllByTestId("dashboard")).toHaveLength(2);
  });

  it("en mobile cae al temporizador", async () => {
    const { rerender } = render(<HomeClient />);
    await userEvent.click(screen.getAllByRole("button", { name: /amigos/i })[1]);

    preferencias = { ...DEFAULT_PREFERENCES, social: false };
    rerender(<HomeClient />);

    // Los tabs de mobile son absolute inset-0 apilados y se apagan con
    // opacity: "quedar en blanco" seria exactamente que ninguno quede visible.
    expect(screen.queryByTestId("friends")).toBeNull();
    expect(screen.getAllByTestId("timer").length).toBeGreaterThan(0);
  });
});
