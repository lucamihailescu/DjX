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

/**
 * Persistent YouTube player docked above the playback bar. Rendered once at the
 * Dashboard level so it stays mounted across tab switches — audio/video keep
 * playing while you browse, and the PlaybackBar can reflect what's playing.
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
  const [origin, setOrigin] = useState("");
  const [djSpeaking, setDjSpeaking] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Latest values for the DJ orchestration, which runs from a player event
  // callback (stale closures otherwise).
  const queueRef = useRef<YouTubeResult[]>([]);
  const currentRef = useRef<YouTubeResult | null>(null);
  const djRef = useRef(false);
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

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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

  // Drive the embedded player's volume via the IFrame API postMessage protocol
  // (requires enablejsapi=1). Commands sent before the player is ready are
  // ignored, so we also re-send on load.
  const command = useCallback((func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "https://www.youtube.com",
    );
  }, []);

  // Subscribe to the player's event stream. The embed only starts posting
  // onStateChange messages after it receives a "listening" handshake.
  const register = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening", channel: "widget" }),
      "https://www.youtube.com",
    );
  }, []);

  useEffect(() => {
    command("setVolume", [volume]);
  }, [volume, current?.videoId, command]);

  // Auto-advance the queue when a video ends (IFrame API state 0 = ENDED).
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== "https://www.youtube.com") return;
      let data: unknown = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const msg = data as { event?: string; info?: unknown };
      if (msg?.event === "onStateChange" && msg?.info === 0) advance();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [advance]);

  if (!current) return null;

  const src =
    `https://www.youtube.com/embed/${current.videoId}?autoplay=1&rel=0&playsinline=1&enablejsapi=1` +
    (origin
      ? `&origin=${encodeURIComponent(origin)}&widget_referrer=${encodeURIComponent(origin)}`
      : "");

  return (
    <div className="fixed bottom-24 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
      <div className="relative aspect-video w-full">
        <iframe
          key={current.videoId}
          ref={iframeRef}
          className="h-full w-full"
          src={src}
          title={current.title}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={() => {
            register();
            command("setVolume", [volume]);
          }}
        />
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
            djEnabled
              ? "text-[#1ed760]"
              : "text-neutral-400 hover:text-white"
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
            command("seekTo", [0, true]);
            command("playVideo");
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
