import { SpotifyApi } from "@spotify/web-api-ts-sdk";

/**
 * Scopes requested from the user. Trimmed to what the UI actually uses:
 * profile, library/top reads, and playback read + control.
 */
export const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-modify-public",
  "playlist-modify-private",
  "user-library-read",
  "user-library-modify",
];

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";

function redirectUri() {
  if (process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
  }
  // Fall back to the current origin (e.g. http://127.0.0.1:3000) at runtime.
  return typeof window !== "undefined" ? window.location.origin : "";
}

let client: SpotifyApi | null = null;

/** Returns a singleton SDK instance configured for browser PKCE auth. */
export function getClient(): SpotifyApi {
  if (!CLIENT_ID) {
    throw new Error(
      "Missing NEXT_PUBLIC_SPOTIFY_CLIENT_ID. Copy .env.example to .env.local and add your Spotify app's Client ID.",
    );
  }
  if (!client) {
    client = SpotifyApi.withUserAuthorization(
      CLIENT_ID,
      redirectUri(),
      SPOTIFY_SCOPES,
    );
  }
  return client;
}

export function resetClient() {
  client = null;
}

export const hasClientId = () => Boolean(CLIENT_ID);
