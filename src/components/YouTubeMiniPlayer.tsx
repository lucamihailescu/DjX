"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconX,
  IconExternalLink,
  IconPlayerTrackNextFilled,
  IconPlayerTrackPrevFilled,
  IconRepeat,
  IconMicrophone,
  IconMicrophoneFilled,
} from "@tabler/icons-react";
import { useYouTube } from "./youtube-context";
import type { YouTubeResult } from "@/lib/youtube";
import { fetchDjLine, synthesizeSpeech } from "@/lib/dj";

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

// Load the official IFrame Player API once and resolve when YT.Player exists.
let apiReadyPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiReadyPromise) return apiReadyPromise;
  apiReadyPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector(`script[src="${IFRAME_API_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = IFRAME_API_SRC;
      document.body.appendChild(s);
    }
  });
  return apiReadyPromise;
}

/**
 * Persistent YouTube player docked above the playback bar. Rendered once at the
 * Dashboard level so it stays mounted across tab switches. Uses the official
 * IFrame Player API so the ENDED event reliably drives queue auto-advance (the
 * old raw-postMessage handshake did not deliver onStateChange consistently).
 */
export function YouTubeMiniPlayer() {
  const {
    current,
    queue,
    played,
    next,
    previous,
    stop,
    volume,
    djEnabled,
    setDjEnabled,
  } = useYouTube();
  const [djSpeaking, setDjSpeaking] = useState(false);

  // The host div React owns; the API replaces an imperative child of it with the
  // iframe, so React never manages the YT-controlled node directly.
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const playerReadyRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);

  // Latest values for callbacks that run outside React's render (player events).
  const queueRef = useRef<YouTubeResult[]>([]);
  const currentRef = useRef<YouTubeResult | null>(null);
  const djRef = useRef(false);
  const volumeRef = useRef(volume);
  const advanceRef = useRef<() => void>(() => {});
  const djAudioRef = useRef<HTMLAudioElement | null>(null);
  const djResolveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    djRef.current = djEnabled;
  }, [djEnabled]);

  // Stop any in-flight DJ intro (on manual skip / close).
  const cancelDj = useCallback(() => {
    djAudioRef.current?.pause();
    djAudioRef.current = null;
    djResolveRef.current?.();
    djResolveRef.current = null;
    setDjSpeaking(false);
  }, []);

  // Speak a short intro for the upcoming track, then resolve. Best-effort: any
  // failure (no key, quota, offline) just resolves so playback continues.
  const playIntro = useCallback(
    async (track: YouTubeResult, prev: YouTubeResult | null) => {
      setDjSpeaking(true);
      try {
        const line = await fetchDjLine(track, prev);
        if (!line) return;
        const blob = await synthesizeSpeech(line);
        const url = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          djResolveRef.current = resolve;
          const audio = new Audio(url);
          djAudioRef.current = audio;
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
        URL.revokeObjectURL(url);
      } catch {
        /* skip the intro on any error */
      } finally {
        djAudioRef.current = null;
        djResolveRef.current = null;
        setDjSpeaking(false);
      }
    },
    [],
  );

  // Auto-advance: optionally speak a DJ intro in the gap, then start the next.
  const advance = useCallback(async () => {
    const upcoming = queueRef.current[0];
    if (djRef.current && upcoming) {
      await playIntro(upcoming, currentRef.current);
    }
    next();
  }, [next, playIntro]);
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  const skipNext = useCallback(() => {
    cancelDj();
    next();
  }, [cancelDj, next]);
  const skipPrev = useCallback(() => {
    cancelDj();
    previous();
  }, [cancelDj, previous]);
  const closePlayer = useCallback(() => {
    cancelDj();
    stop();
  }, [cancelDj, stop]);

  const hasCurrent = !!current;

  // Create the player when a video first appears; destroy it when playback
  // stops or the component unmounts.
  useEffect(() => {
    if (!hasCurrent) return;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || playerRef.current || !hostRef.current || !window.YT) {
        return;
      }
      const mount = document.createElement("div");
      mount.className = "h-full w-full";
      hostRef.current.appendChild(mount);
      const startId = currentRef.current?.videoId;
      playerRef.current = new window.YT.Player(mount, {
        videoId: startId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            playerReadyRef.current = true;
            loadedVideoIdRef.current = startId ?? null;
            e.target.setVolume(volumeRef.current);
          },
          onStateChange: (e) => {
            if (e.data === window.YT?.PlayerState.ENDED) advanceRef.current();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      playerReadyRef.current = false;
      loadedVideoIdRef.current = null;
    };
  }, [hasCurrent]);

  // Load a new video when the current track changes (player already created).
  useEffect(() => {
    const id = current?.videoId;
    if (!id || !playerReadyRef.current || !playerRef.current) return;
    if (loadedVideoIdRef.current === id) return;
    loadedVideoIdRef.current = id;
    playerRef.current.loadVideoById(id);
  }, [current?.videoId]);

  // Keep the embedded player's volume in sync.
  useEffect(() => {
    volumeRef.current = volume;
    if (playerReadyRef.current) playerRef.current?.setVolume(volume);
  }, [volume]);

  if (!current) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
      <div className="relative aspect-video w-full">
        <div ref={hostRef} className="h-full w-full" />
        {djSpeaking && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 text-sm font-medium text-white">
            <IconMicrophoneFilled size={18} className="animate-pulse text-[#1ed760]" />
            DJ is talking…
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-neutral-100">
            {current.title}
          </div>
          <div className="truncate text-[11px] text-neutral-400">
            {queue.length > 0
              ? `${current.channel} · ${queue.length} up next`
              : current.channel}
          </div>
        </div>
        <button
          onClick={() => setDjEnabled(!djEnabled)}
          className={`rounded-full p-1.5 transition hover:bg-white/10 ${
            djEnabled ? "text-[#1ed760]" : "text-neutral-400 hover:text-white"
          }`}
          aria-label={djEnabled ? "Turn AI DJ off" : "Turn AI DJ on"}
          title="AI DJ — spoken intros between queued tracks"
        >
          {djEnabled ? (
            <IconMicrophoneFilled size={15} />
          ) : (
            <IconMicrophone size={15} />
          )}
        </button>
        <button
          onClick={skipPrev}
          disabled={played.length === 0}
          className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Previous in queue"
        >
          <IconPlayerTrackPrevFilled size={15} />
        </button>
        <button
          onClick={() => {
            playerRef.current?.seekTo(0, true);
            playerRef.current?.playVideo();
          }}
          className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Replay"
        >
          <IconRepeat size={15} />
        </button>
        <button
          onClick={skipNext}
          disabled={queue.length === 0}
          className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Next in queue"
        >
          <IconPlayerTrackNextFilled size={15} />
        </button>
        <a
          href={`https://www.youtube.com/watch?v=${current.videoId}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Open on YouTube"
        >
          <IconExternalLink size={15} />
        </a>
        <button
          onClick={closePlayer}
          className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Close player"
        >
          <IconX size={16} />
        </button>
      </div>
    </div>
  );
}
