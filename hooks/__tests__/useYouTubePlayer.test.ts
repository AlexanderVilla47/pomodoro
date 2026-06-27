import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";

function makeMockPlayer() {
  return {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    nextVideo: vi.fn(),
    previousVideo: vi.fn(),
    playVideoAt: vi.fn(),
    setVolume: vi.fn(),
    unMute: vi.fn(),
    getPlayerState: vi.fn().mockReturnValue(1),
    getCurrentTime: vi.fn().mockReturnValue(0),
    getDuration: vi.fn().mockReturnValue(0),
    getPlaylistIndex: vi.fn().mockReturnValue(0),
    seekTo: vi.fn(),
    loadPlaylist: vi.fn(),
    cuePlaylist: vi.fn(),
    destroy: vi.fn(),
  };
}

function installYTApi(player: ReturnType<typeof makeMockPlayer>) {
  (window as unknown as Record<string, unknown>).YT = {
    Player: vi.fn((_, opts) => {
      setTimeout(() => opts.events.onReady({ target: player }), 0);
      setTimeout(() => opts.events.onStateChange({ data: 1 }), 10);
      return player;
    }),
    PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as Record<string, unknown>).YT;
  document.body.innerHTML = '<div id="yt-player"></div>';
});

describe("useYouTubePlayer", () => {
  it("expone play, pause, next, prev, setVolume", () => {
    const { result } = renderHook(() => useYouTubePlayer());
    expect(typeof result.current.play).toBe("function");
    expect(typeof result.current.pause).toBe("function");
    expect(typeof result.current.next).toBe("function");
    expect(typeof result.current.prev).toBe("function");
    expect(typeof result.current.setVolume).toBe("function");
  });

  it("isReady es false antes de inicializar", () => {
    const { result } = renderHook(() => useYouTubePlayer());
    expect(result.current.isReady).toBe(false);
  });

  it("loadPlayer inicializa el player y pone isReady en true", async () => {
    const mockPlayer = makeMockPlayer();
    installYTApi(mockPlayer);

    const { result } = renderHook(() => useYouTubePlayer());

    await act(async () => {
      await result.current.loadPlayer("yt-player", ["vid1", "vid2"]);
    });

    expect(result.current.isReady).toBe(true);
  });

  it("setVolume clampea a 0-100", async () => {
    const mockPlayer = makeMockPlayer();
    installYTApi(mockPlayer);

    const { result } = renderHook(() => useYouTubePlayer());
    await act(async () => {
      await result.current.loadPlayer("yt-player", ["vid1"]);
    });

    act(() => result.current.setVolume(150));
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(100);

    act(() => result.current.setVolume(-10));
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(0);
  });
});
