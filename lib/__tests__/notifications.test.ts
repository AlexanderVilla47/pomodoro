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
