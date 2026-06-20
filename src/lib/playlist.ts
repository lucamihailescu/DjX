import type { SpotifyApi, Track, Playlist } from "@spotify/web-api-ts-sdk";
import { getOllamaSettings } from "@/lib/settings";

export interface PlaylistIntent {
  name: string;
  description: string;
  queries: string[];
}

/** Ask the local Ollama proxy to turn a prompt into a structured intent. */
export async function fetchIntent(
  prompt: string,
  opts?: { refine?: string; current?: string[] },
): Promise<PlaylistIntent> {
  const { baseUrl, model } = getOllamaSettings();
  const res = await fetch("/api/playlist-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      refine: opts?.refine || undefined,
      current: opts?.current || undefined,
      baseUrl: baseUrl || undefined,
      model: model || undefined,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? "Failed to generate playlist intent.");
  }
  return data as PlaylistIntent;
}

/**
 * Resolve an intent's search queries to real, deduped tracks.
 * "Bangers" are approximated by Spotify popularity (the audio-features and
 * recommendations endpoints are deprecated for new apps).
 */
export async function resolveTracks(
  sdk: SpotifyApi,
  intent: PlaylistIntent,
  limit = 25,
): Promise<Track[]> {
  const perQuery = 8;
  const results = await Promise.allSettled(
    intent.queries.map((q) => sdk.search(q, ["track"], undefined, perQuery)),
  );

  const byId = new Map<string, Track>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const t of r.value.tracks?.items ?? []) {
      if (t?.id && !byId.has(t.id)) byId.set(t.id, t);
    }
  }

  return [...byId.values()]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, limit);
}

/**
 * Create the playlist on the user's account and add the chosen tracks.
 *
 * Uses `POST /me/playlists` directly via makeRequest. Spotify replaced the old
 * `POST /users/{user_id}/playlists` (which the SDK's `createPlaylist` still
 * calls) — the legacy path now returns 403 Forbidden even with a valid token
 * and the correct scopes. `/me/playlists` targets the authenticated user.
 */
export async function createPlaylist(
  sdk: SpotifyApi,
  name: string,
  description: string,
  tracks: Track[],
): Promise<{ id: string; url: string }> {
  const playlist = await sdk.makeRequest<Playlist>("POST", "me/playlists", {
    name,
    description,
    public: false,
  });

  const uris = tracks.map((t) => t.uri);
  // Add items via `POST /playlists/{id}/items` — Spotify renamed the path from
  // `/tracks`, and the SDK's addItemsToPlaylist still calls the old `/tracks`
  // path, which now returns 403. Max 100 URIs per call.
  for (let i = 0; i < uris.length; i += 100) {
    await sdk.makeRequest("POST", `playlists/${playlist.id}/items`, {
      uris: uris.slice(i, i + 100),
    });
  }

  return { id: playlist.id, url: playlist.external_urls?.spotify ?? "" };
}

/**
 * "Delete" a playlist. Spotify has no hard-delete endpoint — for a playlist you
 * own, unfollowing (`DELETE /playlists/{id}/followers`) removes it from your
 * library, which is what the official app's Delete does. Called via makeRequest
 * to avoid the SDK's stale-path issues.
 */
export async function deletePlaylist(sdk: SpotifyApi, playlistId: string) {
  await sdk.makeRequest("DELETE", `playlists/${playlistId}/followers`);
}
