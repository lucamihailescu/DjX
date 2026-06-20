"use client";

import { useCallback, useEffect, useState } from "react";
import type { SpotifyApi, UserProfile } from "@spotify/web-api-ts-sdk";
import { getClient, resetClient, hasClientId } from "@/lib/spotify";

type Status = "loading" | "anonymous" | "authenticated" | "error";

interface SpotifyState {
  status: Status;
  sdk: SpotifyApi | null;
  profile: UserProfile | null;
  error: string | null;
}

/**
 * Memoized so the PKCE code exchange runs exactly once. React Strict Mode
 * fires effects twice in dev; the auth code and verifier are single-use, so a
 * second `authenticate()` would fail with "No verifier found in cache". By
 * caching the promise at module scope, both effect runs await the same result.
 */
let initPromise: Promise<SpotifyState> | null = null;

const LOADING: SpotifyState = {
  status: "loading",
  sdk: null,
  profile: null,
  error: null,
};

/**
 * `localhost` and `127.0.0.1` are SEPARATE origins for localStorage. The PKCE
 * verifier is stored under whatever origin login starts on, but Spotify's
 * redirect URI must be `127.0.0.1` (it rejects `localhost`). If the user opens
 * the app on `localhost` (e.g. the link Next prints in the terminal), the
 * verifier lands in localhost's storage while the callback arrives on
 * 127.0.0.1 → "No verifier found in cache". Force the canonical host so login
 * always begins on the same origin the callback returns to.
 */
function canonicalizeHost(): boolean {
  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "[::1]") {
    const url = new URL(window.location.href);
    url.hostname = "127.0.0.1";
    window.location.replace(url.toString());
    return true;
  }
  return false;
}

async function initSpotify(): Promise<SpotifyState> {
  // Navigating away — keep the spinner up until the new origin loads.
  if (canonicalizeHost()) return LOADING;

  if (!hasClientId()) {
    return {
      status: "error",
      sdk: null,
      profile: null,
      error:
        "No Spotify Client ID configured. Add NEXT_PUBLIC_SPOTIFY_CLIENT_ID to .env.local.",
    };
  }

  const sdk = getClient();
  const params = new URLSearchParams(window.location.search);

  try {
    // If we just came back from Spotify, finish the PKCE code exchange.
    // Otherwise read any cached token WITHOUT triggering a redirect.
    if (params.has("code")) {
      try {
        // authenticate() reads ?code= from the URL to do the exchange, so the
        // params must still be present here. The module-level memo (initPromise)
        // already prevents Strict Mode's double-fire from replaying the code.
        await sdk.authenticate();
      } finally {
        // ALWAYS strip the callback params — on success to prevent replay, and
        // on FAILURE so a dead code (e.g. a lost verifier) can't wedge every
        // future load and the Connect button by re-throwing on the same code.
        window.history.replaceState({}, "", window.location.pathname);
      }
    }

    const token = await sdk.getAccessToken();
    if (!token?.access_token) {
      return { status: "anonymous", sdk, profile: null, error: null };
    }

    const profile = await sdk.currentUser.profile();
    return {
      status: "authenticated",
      sdk,
      profile,
      error: null,
    };
  } catch (e) {
    // Reset so the user can retry login cleanly after a failed exchange.
    initPromise = null;
    return {
      status: "error",
      sdk,
      profile: null,
      error: e instanceof Error ? e.message : "Authentication failed.",
    };
  }
}

export function useSpotify() {
  const [state, setState] = useState<SpotifyState>({
    status: "loading",
    sdk: null,
    profile: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    if (!initPromise) initPromise = initSpotify();
    initPromise.then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async () => {
    try {
      // This redirects the browser to Spotify's consent screen.
      await getClient().authenticate();
    } catch (e) {
      setState((s) => ({
        ...s,
        status: "error",
        error: e instanceof Error ? e.message : "Login failed.",
      }));
    }
  }, []);

  const logout = useCallback(() => {
    state.sdk?.logOut();
    resetClient();
    initPromise = null;
    setState({
      status: "anonymous",
      sdk: null,
      profile: null,
      error: null,
    });
  }, [state.sdk]);

  /**
   * Force a fresh authorization. Clears the cached token first so the SDK
   * re-requests consent with the CURRENT scope set — needed after new scopes
   * are added, since an unexpired cached token is otherwise reused as-is.
   */
  const reconnect = useCallback(async () => {
    state.sdk?.logOut();
    resetClient();
    initPromise = null;
    try {
      await getClient().authenticate();
    } catch (e) {
      setState((s) => ({
        ...s,
        status: "error",
        error: e instanceof Error ? e.message : "Reconnect failed.",
      }));
    }
  }, [state.sdk]);

  return { ...state, login, logout, reconnect };
}
