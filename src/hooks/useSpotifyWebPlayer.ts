"use client";

import { useEffect, useRef, useState } from "react";
import type { SpotifyApi } from "@spotify/web-api-ts-sdk";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

export type WebPlayerStatus = "loading" | "ready" | "unavailable";

export interface SpotifyWebPlayer {
  deviceId: string | null; // the in-browser device, once registered
  status: WebPlayerStatus;
  error: string | null;
  player: Spotify.Player | null;
}

/**
 * Loads the Spotify Web Playback SDK and registers this browser tab as a
 * playback device ("DjX Web Player"). Returns the device id once ready so
 * playback can target it. Premium-only and requires the `streaming` scope — on
 * failure it resolves to "unavailable" and callers fall back to remote devices.
 */
export function useSpotifyWebPlayer(sdk: SpotifyApi): SpotifyWebPlayer {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [status, setStatus] = useState<WebPlayerStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<Spotify.Player | null>(null);

  useEffect(() => {
    let cancelled = false;

    function init() {
      if (cancelled || !window.Spotify) return;
      const player = new window.Spotify.Player({
        name: "DjX Web Player",
        getOAuthToken: (cb) => {
          sdk.getAccessToken().then((t) => {
            if (t?.access_token) cb(t.access_token);
          });
        },
        volume: 0.8,
      });
      playerRef.current = player;

      player.addListener("ready", ({ device_id }) => {
        if (cancelled) return;
        setDeviceId(device_id);
        setStatus("ready");
      });
      player.addListener("not_ready", () => {
        if (!cancelled) setDeviceId(null);
      });
      const fail = (msg: string) => {
        if (cancelled) return;
        setError(msg);
        setStatus("unavailable");
      };
      player.addListener("initialization_error", ({ message }) => fail(message));
      player.addListener("authentication_error", ({ message }) => fail(message));
      player.addListener("account_error", () =>
        fail("Spotify Premium is required for in-browser playback."),
      );

      player.connect();
    }

    if (window.Spotify) {
      init();
    } else {
      // The SDK invokes this global once it has loaded. Chain any existing
      // handler so we don't clobber another consumer.
      const prev = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = () => {
        prev?.();
        init();
      };
      if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
        const s = document.createElement("script");
        s.src = SDK_SRC;
        s.async = true;
        document.body.appendChild(s);
      }
    }

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [sdk]);

  return { deviceId, status, error, player: playerRef.current };
}
