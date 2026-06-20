"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  PlaybackState,
  SpotifyApi,
  TrackItem,
} from "@spotify/web-api-ts-sdk";

interface SpotifyPlaybackValue {
  state: PlaybackState | null;
  queue: TrackItem[];
  refresh: () => Promise<void>;
}

const Ctx = createContext<SpotifyPlaybackValue | null>(null);

/**
 * Polls Spotify's `getPlaybackState` and shares the result. The PlaybackBar and
 * the Now Playing hero both subscribe so they show the same state without
 * doubling up on requests.
 */
export function SpotifyPlaybackProvider({
  sdk,
  children,
}: {
  sdk: SpotifyApi;
  children: ReactNode;
}) {
  const [state, setState] = useState<PlaybackState | null>(null);
  const [queue, setQueue] = useState<TrackItem[]>([]);

  const refresh = useCallback(async () => {
    // Fetch playback state and queue in parallel; tolerate either failing.
    const [playbackRes, queueRes] = await Promise.allSettled([
      sdk.player.getPlaybackState(),
      sdk.player.getUsersQueue(),
    ]);
    setState(
      playbackRes.status === "fulfilled" ? (playbackRes.value ?? null) : null,
    );
    setQueue(
      queueRes.status === "fulfilled" ? (queueRes.value?.queue ?? []) : [],
    );
  }, [sdk]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <Ctx.Provider value={{ state, queue, refresh }}>{children}</Ctx.Provider>
  );
}

export function useSpotifyPlayback() {
  const v = useContext(Ctx);
  if (!v)
    throw new Error(
      "useSpotifyPlayback must be used within SpotifyPlaybackProvider",
    );
  return v;
}
