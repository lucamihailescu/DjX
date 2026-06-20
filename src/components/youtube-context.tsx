"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { YouTubeResult } from "@/lib/youtube";
import { loadHistory, saveHistory } from "@/lib/history";

interface YouTubeContextValue {
  current: YouTubeResult | null;
  history: YouTubeResult[];
  volume: number; // 0–100, applied to the embedded player
  setVolume: (v: number) => void;
  play: (r: YouTubeResult) => void;
  stop: () => void;
}

const YouTubeContext = createContext<YouTubeContextValue | null>(null);

const HISTORY_KEY = "djx.youtube.history";
const HISTORY_MAX = 24;

export function YouTubeProvider({
  children,
  getToken,
}: {
  children: ReactNode;
  // Resolves the current Spotify access token so history can sync per-account.
  getToken?: () => Promise<string | null>;
}) {
  const [current, setCurrent] = useState<YouTubeResult | null>(null);
  const [history, setHistory] = useState<YouTubeResult[]>([]);
  const [volume, setVolume] = useState(100);

  // Load the local cache instantly, then reconcile with the server copy.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    (async () => {
      const token = await getToken?.();
      if (!token) return;
      const server = await loadHistory(token);
      if (server) {
        setHistory(server);
        try {
          window.localStorage.setItem(HISTORY_KEY, JSON.stringify(server));
        } catch {
          /* ignore */
        }
      }
    })();
  }, [getToken]);

  const play = (r: YouTubeResult) => {
    setCurrent(r);
    setHistory((prev) => {
      const next = [r, ...prev.filter((x) => x.videoId !== r.videoId)].slice(
        0,
        HISTORY_MAX,
      );
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      getToken?.().then((t) => {
        if (t) saveHistory(t, next);
      });
      return next;
    });
  };

  return (
    <YouTubeContext.Provider
      value={{ current, history, volume, setVolume, play, stop: () => setCurrent(null) }}
    >
      {children}
    </YouTubeContext.Provider>
  );
}

export function useYouTube() {
  const ctx = useContext(YouTubeContext);
  if (!ctx) throw new Error("useYouTube must be used within YouTubeProvider");
  return ctx;
}
