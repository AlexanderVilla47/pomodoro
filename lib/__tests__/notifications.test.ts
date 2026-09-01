import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestNotificationPermission, notifySessionComplete } from "../notifications";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("requestNotificationPermission", () => {
  it("retorna false si Notification no está disponible", async () => {
    const original = (window as unknown as Record<string, unknown>).Notification;
    delete (window as unknown as Record<string, unknown>).Notification;
    const result = await requestNotificationPermission();
    expect(result).toBe(false);
    (window as unknown as Record<string, unknown>).Notification = original;
  });

  it("retorna true si el permiso ya es 'granted'", async () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "granted", requestPermission: vi.fn() },
      configurable: true,
      writable: true,
    });
    expect(await requestNotificationPermission()).toBe(true);
  });

  it("retorna false si el permiso es 'denied'", async () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "denied", requestPermission: vi.fn() },
      configurable: true,
      writable: true,
    });
    expect(await requestNotificationPermission()).toBe(false);
  });

  it("llama a requestPermission y retorna true si se concede", async () => {
    const requestMock = vi.fn().mockResolvedValue("granted");
    Object.defineProperty(window, "Notification", {
      value: { permission: "default", requestPermission: requestMock },
      configurable: true,
      writable: true,
    });
    expect(await requestNotificationPermission()).toBe(true);
    expect(requestMock).toHaveBeenCalled();
  });
});

describe("notifySessionComplete", () => {
  it("dispara una Notification cuando el permiso es granted", () => {
    const NotifMock = vi.fn();
    Object.defineProperty(window, "Notification", {
      value: Object.assign(NotifMock, { permission: "granted" }),
      configurable: true,
      writable: true,
    });
    notifySessionComplete("work", false);
    expect(NotifMock).toHaveBeenCalledWith(
      expect.stringContaining("completada"),
      expect.any(Object)
    );
  });

  it("NO dispara Notification cuando el permiso no es granted", () => {
    const NotifMock = vi.fn();
    Object.defineProperty(window, "Notification", {
      value: Object.assign(NotifMock, { permission: "default" }),
      configurable: true,
      writable: true,
    });
    notifySessionComplete("work", false);
    expect(NotifMock).not.toHaveBeenCalled();
  });

  it("reproduce Audio cuando soundEnabled=true", () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("Audio", vi.fn(() => ({ play: playMock })));
    Object.defineProperty(window, "Notification", {
      value: Object.assign(vi.fn(), { permission: "granted" }),
      configurable: true,
      writable: true,
    });
    notifySessionComplete("short_break", true);
    expect(playMock).toHaveBeenCalled();
  });

  it("no reproduce Audio cuando soundEnabled=false", () => {
    const playMock = vi.fn();
    vi.stubGlobal("Audio", vi.fn(() => ({ play: playMock })));
    Object.defineProperty(window, "Notification", {
      value: Object.assign(vi.fn(), { permission: "granted" }),
      configurable: true,
      writable: true,
    });
    notifySessionComplete("work", false);
    expect(playMock).not.toHaveBeenCalled();
  });
});

describe("notifySessionComplete — tablets y celulares", () => {
  function stubAudio() {
    const playMock = vi.fn().mockResolvedValue(undefined);
    const pauseMock = vi.fn();
    const instances: Record<string, unknown>[] = [];
    const AudioMock = vi.fn(() => {
      const el = { play: playMock, pause: pauseMock, muted: false, currentTime: 0 };
      instances.push(el);
      return el;
    });
    vi.stubGlobal("Audio", AudioMock);
    return { playMock, pauseMock, AudioMock, instances };
  }

  function stubNotificationThrowing() {
    // Android Chrome: el constructor existe y el permiso puede ser "granted",
    // pero invocarlo tira "Illegal constructor" — sólo se permite vía
    // ServiceWorkerRegistration.showNotification().
    const NotifMock = vi.fn(() => {
      throw new TypeError("Failed to construct 'Notification': Illegal constructor.");
    });
    Object.defineProperty(window, "Notification", {
      value: Object.assign(NotifMock, { permission: "granted" }),
      configurable: true,
      writable: true,
    });
    return NotifMock;
  }

  it("el sonido suena igual aunque new Notification() tire (Android)", () => {
    const { playMock } = stubAudio();
    stubNotificationThrowing();

    notifySessionComplete("work", true);

    expect(playMock).toHaveBeenCalled();
  });

  it("no propaga la excepción del constructor de Notification", () => {
    stubAudio();
    stubNotificationThrowing();

    expect(() => notifySessionComplete("short_break", true)).not.toThrow();
  });

  it("unlockChime deja un elemento listo y notifySessionComplete lo reusa", async () => {
    vi.resetModules();
    const { playMock, AudioMock } = stubAudio();
    Object.defineProperty(window, "Notification", {
      value: Object.assign(vi.fn(), { permission: "default" }),
      configurable: true,
      writable: true,
    });

    const mod = await import("../notifications");
    mod.unlockChime();
    await Promise.resolve();

    expect(AudioMock).toHaveBeenCalledTimes(1);
    playMock.mockClear();

    // El elemento desbloqueado por el gesto se reusa: crear uno nuevo desde el
    // setTimeout lo dejaría bloqueado otra vez por la política de autoplay.
    mod.notifySessionComplete("work", true);
    expect(AudioMock).toHaveBeenCalledTimes(1);
    expect(playMock).toHaveBeenCalled();
  });

  it("sin unlock previo igual intenta reproducir (desktop)", async () => {
    vi.resetModules();
    const { playMock } = stubAudio();
    Object.defineProperty(window, "Notification", {
      value: Object.assign(vi.fn(), { permission: "default" }),
      configurable: true,
      writable: true,
    });

    const mod = await import("../notifications");
    mod.notifySessionComplete("work", true);

    expect(playMock).toHaveBeenCalled();
  });
});
