"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconX, IconExternalLink } from "@tabler/icons-react";
import { useYouTube } from "./youtube-context";

/**
 * Persistent YouTube player docked above the playback bar. Rendered once at the
 * Dashboard level so it stays mounted across tab switches — audio/video keep
 * playing while you browse, and the PlaybackBar can reflect what's playing.
 */
export function YouTubeMiniPlayer() {
  const { current, stop, volume } = useYouTube();
  const [origin, setOrigin] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Drive the embedded player's volume via the IFrame API postMessage protocol
  // (requires enablejsapi=1). Commands sent before the player is ready are
  // ignored, so we also re-send on load.
  const command = useCallback((func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "https://www.youtube.com",
    );
  }, []);

  useEffect(() => {
    command("setVolume", [volume]);
  }, [volume, current?.videoId, command]);

  if (!current) return null;

  const src =
    `https://www.youtube.com/embed/${current.videoId}?autoplay=1&rel=0&playsinline=1&enablejsapi=1` +
    (origin
      ? `&origin=${encodeURIComponent(origin)}&widget_referrer=${encodeURIComponent(origin)}`
      : "");

  return (
    <div className="fixed bottom-24 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
      <div className="aspect-video w-full">
        <iframe
          key={current.videoId}
          ref={iframeRef}
          className="h-full w-full"
          src={src}
          title={current.title}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={() => command("setVolume", [volume])}
        />
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-neutral-100">
            {current.title}
          </div>
          <div className="truncate text-[11px] text-neutral-400">
            {current.channel}
          </div>
        </div>
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
          onClick={stop}
          className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Close player"
        >
          <IconX size={16} />
        </button>
      </div>
    </div>
  );
}
