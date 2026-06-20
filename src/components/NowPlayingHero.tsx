"use client";

import { useEffect, useState } from "react";
import type { SpotifyApi } from "@spotify/web-api-ts-sdk";
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerSkipForwardFilled,
  IconPlayerSkipBackFilled,
  IconExternalLink,
  IconHeart,
  IconHeartFilled,
} from "@tabler/icons-react";
import { useSpotifyPlayback } from "./spotify-playback-context";
import { pickImage } from "@/lib/images";
import { msToTime } from "@/lib/utils";

interface HeroProps {
  sdk: SpotifyApi;
  /** Map of track id → saved-in-library. Optional. */
  savedMap?: Record<string, boolean>;
  onToggleSave?: (id: string) => void;
  /** Optional: batch-check the now-playing track's saved state. */
  primeSaved?: (ids: string[]) => void;
}

/**
 * Hero card surfacing the currently-playing Spotify track when one is active.
 * Renders nothing if nothing's playing — so the Overview is unchanged when
 * idle, but uses the empty space at the top when there is something to show.
 */
export function NowPlayingHero({
  sdk,
  savedMap,
  onToggleSave,
  primeSaved,
}: HeroProps) {
  const { state, refresh } = useSpotifyPlayback();
  const [busy, setBusy] = useState(false);

  const item = state?.item;
  const isTrack = item && "album" in item;
  const trackId = isTrack ? item.id : undefined;

  // Prime saved-state for the now-playing track when it changes.
  useEffect(() => {
    if (trackId) primeSaved?.([trackId]);
  }, [trackId, primeSaved]);

  if (!isTrack) return null;

  const saved = !!savedMap?.[item.id];

  const deviceId = state?.device?.id;
  const art = pickImage(item.album.images, "large");
  const progress =
    state?.progress_ms != null
      ? Math.min(100, (state.progress_ms / item.duration_ms) * 100)
      : 0;

  const guard = async (fn: () => Promise<void>) => {
    if (!deviceId) return;
    setBusy(true);
    try {
      await fn();
      setTimeout(refresh, 350);
    } finally {
      setBusy(false);
    }
  };

  const togglePlay = () =>
    guard(async () => {
      if (state?.is_playing) await sdk.player.pausePlayback(deviceId!);
      else await sdk.player.startResumePlayback(deviceId!);
    });
  const next = () => guard(() => sdk.player.skipToNext(deviceId!));
  const prev = () => guard(() => sdk.player.skipToPrevious(deviceId!));

  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl border border-white/10">
      {/* Blurred album-art backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 scale-110 bg-cover bg-center blur-3xl saturate-150"
        style={{ backgroundImage: art ? `url(${art})` : undefined }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/80"
      />

      <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-end md:gap-8 md:p-8">
        {/* Album art */}
        {art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={art}
            alt=""
            className="h-44 w-44 shrink-0 rounded-2xl object-cover shadow-2xl md:h-56 md:w-56"
          />
        )}

        {/* Text + controls */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1ed760]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1ed760] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1ed760]" />
            </span>
            {state?.is_playing ? "Now playing" : "Paused"}
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            {item.name}
          </h2>
          <p className="mt-1 truncate text-base text-neutral-200 md:text-lg">
            {item.artists.map((a) => a.name).join(", ")}
          </p>
          <p className="truncate text-sm text-neutral-400">{item.album.name}</p>

          {/* Progress */}
          <div className="mt-5 flex items-center gap-3 text-xs tabular-nums text-neutral-400">
            <span>{msToTime(state?.progress_ms ?? 0)}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full bg-gradient-to-r from-[#1db954] to-[#1ed760] transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span>{msToTime(item.duration_ms)}</span>
          </div>

          {/* Controls */}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={prev}
              disabled={busy || !deviceId}
              className="rounded-full p-2 text-neutral-200 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Previous"
            >
              <IconPlayerSkipBackFilled size={22} />
            </button>
            <button
              onClick={togglePlay}
              disabled={busy || !deviceId}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-30"
              aria-label={state?.is_playing ? "Pause" : "Play"}
            >
              {state?.is_playing ? (
                <IconPlayerPauseFilled size={26} />
              ) : (
                <IconPlayerPlayFilled size={26} />
              )}
            </button>
            <button
              onClick={next}
              disabled={busy || !deviceId}
              className="rounded-full p-2 text-neutral-200 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Next"
            >
              <IconPlayerSkipForwardFilled size={22} />
            </button>

            {onToggleSave && (
              <button
                onClick={() => onToggleSave(item.id)}
                aria-label={saved ? "Unlike" : "Like"}
                className={
                  "ml-2 rounded-full p-2 transition hover:bg-white/10 " +
                  (saved
                    ? "text-[#1ed760]"
                    : "text-neutral-300 hover:text-white")
                }
              >
                {saved ? (
                  <IconHeartFilled size={20} />
                ) : (
                  <IconHeart size={20} />
                )}
              </button>
            )}

            {item.external_urls?.spotify && (
              <a
                href={item.external_urls.spotify}
                target="_blank"
                rel="noreferrer"
                className="ml-auto flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
              >
                <IconExternalLink size={14} /> Open
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
