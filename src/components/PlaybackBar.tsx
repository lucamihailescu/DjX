"use client";

import { useEffect, useRef, useState } from "react";
import type { SpotifyApi, Device } from "@spotify/web-api-ts-sdk";
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerSkipForwardFilled,
  IconPlayerSkipBackFilled,
  IconDeviceSpeaker,
  IconDevices,
  IconDeviceMobile,
  IconDeviceLaptop,
  IconVolume,
  IconVolume3,
  IconCheck,
  IconBrandYoutubeFilled,
  IconWaveSine,
} from "@tabler/icons-react";
import { pickImage } from "@/lib/images";
import { msToTime, cn } from "@/lib/utils";
import { useYouTube } from "./youtube-context";
import { useSpotifyPlayback } from "./spotify-playback-context";
import { Visualizer } from "./Visualizer";

export function PlaybackBar({ sdk }: { sdk: SpotifyApi }) {
  const { state, queue, refresh } = useSpotifyPlayback();
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [volume, setVolume] = useState(50);
  const [vizOpen, setVizOpen] = useState(false);
  const draggingVolume = useRef(false);

  const noDevice = !state;

  // Keep the local volume slider in sync with the device's reported volume,
  // but don't fight the user mid-drag.
  useEffect(() => {
    if (state?.device?.volume_percent != null && !draggingVolume.current) {
      setVolume(state.device.volume_percent);
    }
  }, [state?.device?.volume_percent]);

  const deviceId = state?.device?.id;

  const guard = async (fn: () => Promise<void>, delay = 350) => {
    if (!deviceId) return;
    setBusy(true);
    try {
      await fn();
      setTimeout(refresh, delay);
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

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state?.item || !deviceId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const positionMs = Math.floor(fraction * state.item.duration_ms);
    guard(() => sdk.player.seekToPosition(positionMs, deviceId));
  };

  const commitVolume = (v: number) => {
    if (!deviceId) return;
    sdk.player.setPlaybackVolume(v, deviceId).catch(() => {});
  };

  const openDevices = async () => {
    setDevicesOpen((o) => !o);
    if (!devicesOpen) {
      try {
        const { devices } = await sdk.player.getAvailableDevices();
        setDevices(devices);
      } catch {
        setDevices([]);
      }
    }
  };

  const transferTo = async (id: string) => {
    setDevicesOpen(false);
    try {
      await sdk.player.transferPlayback([id], state?.is_playing ?? false);
      setTimeout(refresh, 500);
    } catch {
      /* ignore */
    }
  };

  // Reflect YouTube when a video is loaded and Spotify isn't actively playing.
  const { current: yt, volume: ytVolume, setVolume: setYtVolume } = useYouTube();
  const youtubeMode = !!yt && !state?.is_playing;

  const item = state?.item;
  const isTrack = item && "album" in item;

  // Since the Now Playing hero shows the current Spotify track, the bar shows
  // what's coming UP next from the queue when one's available. Falls back to
  // the current track when the queue is empty or nothing is playing.
  const nextItem = queue[0];
  const nextIsTrack = !!nextItem && "album" in nextItem;
  const showUpNext = !youtubeMode && isTrack && nextIsTrack;

  const art = youtubeMode
    ? yt!.thumbnail
    : showUpNext
      ? pickImage(nextItem!.album.images, "small")
      : isTrack
        ? pickImage(item.album.images, "small")
        : undefined;
  const title = youtubeMode
    ? yt!.title
    : showUpNext
      ? nextItem!.name
      : (item?.name ?? "Nothing playing");
  const subtitle = youtubeMode
    ? yt!.channel
    : showUpNext
      ? nextItem!.artists.map((a) => a.name).join(", ")
      : isTrack
        ? item.artists.map((a) => a.name).join(", ")
        : noDevice
          ? "Open Spotify on any device to enable remote control"
          : "—";

  const progress =
    state?.item && state.progress_ms != null
      ? Math.min(100, (state.progress_ms / state.item.duration_ms) * 100)
      : 0;

  const isPlaying = youtubeMode || !!state?.is_playing;

  return (
    <>
    <Visualizer
      open={vizOpen}
      onClose={() => setVizOpen(false)}
      title={title}
      subtitle={subtitle}
      image={art}
      playing={isPlaying}
    />
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/70 backdrop-blur-xl">
      {/* Seekable progress bar */}
      <div
        onClick={seek}
        className={cn(
          "group/seek h-[6px] w-full bg-white/10",
          state?.item && deviceId ? "cursor-pointer" : "cursor-default",
        )}
      >
        <div
          className="relative h-full bg-gradient-to-r from-[#1db954] to-[#1ed760] transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        >
          <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition group-hover/seek:opacity-100" />
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={art}
              alt=""
              className="h-12 w-12 shrink-0 rounded-md object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white/5 text-neutral-500">
              <IconDeviceSpeaker size={20} />
            </div>
          )}
          <div className="min-w-0">
            {showUpNext && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Up next
              </div>
            )}
            <div className="flex items-center gap-1.5">
              {youtubeMode && (
                <IconBrandYoutubeFilled
                  size={15}
                  className="shrink-0 text-[#ff0033]"
                />
              )}
              <span className="truncate text-sm font-medium text-neutral-100">
                {title}
              </span>
            </div>
            <div className="truncate text-xs text-neutral-400">{subtitle}</div>
          </div>
        </div>

        {youtubeMode ? (
          <span className="flex items-center gap-1.5 rounded-full bg-[#ff0033]/15 px-3 py-1 text-xs font-medium text-[#ff5277]">
            <IconBrandYoutubeFilled size={14} /> Playing on YouTube
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={busy || noDevice}
              className="rounded-full p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Previous"
            >
              <IconPlayerSkipBackFilled size={18} />
            </button>
            <button
              onClick={togglePlay}
              disabled={busy || noDevice}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-30"
              aria-label={state?.is_playing ? "Pause" : "Play"}
            >
              {state?.is_playing ? (
                <IconPlayerPauseFilled size={20} />
              ) : (
                <IconPlayerPlayFilled size={20} />
              )}
            </button>
            <button
              onClick={next}
              disabled={busy || noDevice}
              className="rounded-full p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Next"
            >
              <IconPlayerSkipForwardFilled size={18} />
            </button>
          </div>
        )}

        <div className="flex flex-1 items-center justify-end gap-3">
          <button
            onClick={() => setVizOpen(true)}
            className="rounded-full p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Open visualizer"
            title="Visualizer"
          >
            <IconWaveSine size={18} />
          </button>

          {youtubeMode ? (
            /* YouTube volume — drives the embedded player via the IFrame API */
            <div className="flex items-center gap-1.5">
              {ytVolume === 0 ? (
                <IconVolume3 size={18} className="text-neutral-400" />
              ) : (
                <IconVolume size={18} className="text-neutral-400" />
              )}
              <input
                type="range"
                min={0}
                max={100}
                value={ytVolume}
                onChange={(e) => setYtVolume(Number(e.target.value))}
                className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-white/20 accent-[#ff0033]"
                aria-label="YouTube volume"
              />
            </div>
          ) : (
            <>
              <span className="hidden text-right text-xs tabular-nums text-neutral-400 sm:block">
                {state?.item && state.progress_ms != null
                  ? `${msToTime(state.progress_ms)} / ${msToTime(state.item.duration_ms)}`
                  : ""}
              </span>

              {/* Volume */}
              <div className="hidden items-center gap-1.5 md:flex">
                {volume === 0 ? (
                  <IconVolume3 size={18} className="text-neutral-400" />
                ) : (
                  <IconVolume size={18} className="text-neutral-400" />
                )}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  disabled={noDevice}
                  onChange={(e) => {
                    draggingVolume.current = true;
                    setVolume(Number(e.target.value));
                  }}
                  onMouseUp={(e) => {
                    draggingVolume.current = false;
                    commitVolume(Number((e.target as HTMLInputElement).value));
                  }}
                  onTouchEnd={(e) => {
                    draggingVolume.current = false;
                    commitVolume(Number((e.target as HTMLInputElement).value));
                  }}
                  className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/20 accent-[#1db954] disabled:opacity-40"
                  aria-label="Volume"
                />
              </div>

              {/* Device picker */}
              <div className="relative">
            <button
              onClick={openDevices}
              className={cn(
                "rounded-full p-2 transition hover:bg-white/10",
                devicesOpen ? "text-[#1ed760]" : "text-neutral-300 hover:text-white",
              )}
              aria-label="Devices"
            >
              <IconDevices size={18} />
            </button>

            {devicesOpen && (
              <div className="absolute bottom-12 right-0 w-64 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/95 shadow-2xl backdrop-blur-xl">
                <div className="border-b border-white/5 px-3 py-2 text-xs font-semibold text-neutral-400">
                  Connect to a device
                </div>
                {devices.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-neutral-500">
                    No devices found. Open Spotify on a phone, computer, or
                    speaker.
                  </div>
                ) : (
                  devices.map((d) => (
                    <button
                      key={d.id ?? d.name}
                      onClick={() => d.id && transferTo(d.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/5"
                    >
                      <span
                        className={cn(
                          d.is_active ? "text-[#1ed760]" : "text-neutral-400",
                        )}
                      >
                        {/computer|laptop/i.test(d.type) ? (
                          <IconDeviceLaptop size={18} />
                        ) : /smartphone|phone|tablet/i.test(d.type) ? (
                          <IconDeviceMobile size={18} />
                        ) : (
                          <IconDeviceSpeaker size={18} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-neutral-100">
                          {d.name}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">
                          {d.type}
                        </span>
                      </span>
                      {d.is_active && (
                        <IconCheck size={16} className="text-[#1ed760]" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
