import type { SpotifyApi, Track, SavedTrack } from "@spotify/web-api-ts-sdk";

// Saved-tracks ("Liked Songs") helpers. Use the `?ids=` query form via
// makeRequest for unambiguous behavior across save/remove/contains.

/** Returns a boolean per id indicating whether it's in the user's library. */
export async function checkSaved(
  sdk: SpotifyApi,
  ids: string[],
): Promise<boolean[]> {
  if (ids.length === 0) return [];
  const res = await sdk.makeRequest<boolean[]>(
    "GET",
    `me/tracks/contains?ids=${ids.join(",")}`,
  );
  return Array.isArray(res) ? res : ids.map(() => false);
}

export async function saveTrack(sdk: SpotifyApi, id: string) {
  await sdk.makeRequest("PUT", `me/tracks?ids=${id}`);
}

export async function removeSavedTrack(sdk: SpotifyApi, id: string) {
  await sdk.makeRequest("DELETE", `me/tracks?ids=${id}`);
}

export async function getLikedTracks(
  sdk: SpotifyApi,
  limit = 24,
  offset = 0,
): Promise<{ tracks: Track[]; total: number }> {
  const res = await sdk.makeRequest<{ items: SavedTrack[]; total: number }>(
    "GET",
    `me/tracks?limit=${limit}&offset=${offset}`,
  );
  return {
    tracks: res?.items?.map((i) => i.track).filter(Boolean) ?? [],
    total: res?.total ?? 0,
  };
}
