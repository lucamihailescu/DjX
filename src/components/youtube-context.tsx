"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { YouTubeResult } from "@/lib/youtube";
import { loadHistory, saveHistory } from "@/lib/history";

interface YouTubeContextValue {
  current: YouTubeResult | null;
  history: YouTubeResult[];
  queue: YouTubeResult[]; // upcoming videos, not including `current`
  played: YouTubeResult[]; // videos played earlier in this queue run (for `previous`)
  volume: number; // 0–100, applied to the embedded player
  setVolume: (v: number) => void;
  djEnabled: boolean; // AI DJ spoken intros between queued tracks
  setDjEnabled: (v: boolean) => void;
  play: (r: YouTubeResult) => void; // play one video, clearing any queue
  playQueue: (items: YouTubeResult[]) => void; // play the first, queue the rest
  next: () => void; // advance to the next queued video (called on video end)
  previous: () => void; // step back to the previously played queue video
  stop: () => void;
}

const YouTubeContext = createContext<YouTubeContextValue | null>(null);

const HISTORY_KEY = "djx.youtube.history";
const HISTORY_MAX = 24;
const DJ_KEY = "djx.youtube.dj";

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
  const [queue, setQueue] = useState<YouTubeResult[]>([]);
  const [played, setPlayed] = useState<YouTubeResult[]>([]);
  const [volume, setVolume] = useState(100);
  const [djEnabled, setDjEnabledState] = useState(false);
  // Mirror current/queue/played in refs so `next()` and `previous()` (fired from
  // a player event) always read the latest values without being re-created on
  // every change.
  const currentRef = useRef<YouTubeResult | null>(null);
  const queueRef = useRef<YouTubeResult[]>([]);
  const playedRef = useRef<YouTubeResult[]>([]);

  const setDjEnabled = useCallback((v: boolean) => {
    setDjEnabledState(v);
    try {
      window.localStorage.setItem(DJ_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  // Load the local cache instantly, then reconcile with the server copy.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
      setDjEnabledState(window.localStorage.getItem(DJ_KEY) === "1");
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

  // Set the current video and record it in history. Does NOT touch the queue —
  // callers decide whether this is a one-off (`play`) or a queue step.
  const start = useCallback(
    (r: YouTubeResult) => {
      currentRef.current = r;
      setCurrent(r);
      setHistory((prev) => {
        const updated = [
          r,
          ...prev.filter((x) => x.videoId !== r.videoId),
        ].slice(0, HISTORY_MAX);
        try {
          window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        getToken?.().then((t) => {
          if (t) saveHistory(t, updated);
        });
        return updated;
      });
    },
    [getToken],
  );

  const setQueueSynced = useCallback((items: YouTubeResult[]) => {
    queueRef.current = items;
    setQueue(items);
  }, []);

  const setPlayedSynced = useCallback((items: YouTubeResult[]) => {
    playedRef.current = items;
    setPlayed(items);
  }, []);

  const play = useCallback(
    (r: YouTubeResult) => {
      setQueueSynced([]);
      setPlayedSynced([]);
      start(r);
    },
    [setQueueSynced, setPlayedSynced, start],
  );

  const playQueue = useCallback(
    (items: YouTubeResult[]) => {
      if (items.length === 0) return;
      const [first, ...rest] = items;
      setQueueSynced(rest);
      setPlayedSynced([]);
      start(first);
    },
    [setQueueSynced, setPlayedSynced, start],
  );

  const next = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) return;
    const cur = currentRef.current;
    if (cur) setPlayedSynced([...playedRef.current, cur]);
    const [head, ...rest] = q;
    setQueueSynced(rest);
    start(head);
  }, [setQueueSynced, setPlayedSynced, start]);

  const previous = useCallback(() => {
    const p = playedRef.current;
    if (p.length === 0) return;
    const prev = p[p.length - 1];
    setPlayedSynced(p.slice(0, -1));
    // Push the current video back to the front of the queue so it isn't lost.
    const cur = currentRef.current;
    if (cur) setQueueSynced([cur, ...queueRef.current]);
    start(prev);
  }, [setQueueSynced, setPlayedSynced, start]);

  const stop = useCallback(() => {
    setQueueSynced([]);
    setPlayedSynced([]);
    currentRef.current = null;
    setCurrent(null);
  }, [setQueueSynced, setPlayedSynced]);

  return (
    <YouTubeContext.Provider
      value={{
        current,
        history,
        queue,
        played,
        volume,
        setVolume,
        djEnabled,
        setDjEnabled,
        play,
        playQueue,
        next,
        previous,
        stop,
      }}
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
