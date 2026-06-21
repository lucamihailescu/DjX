"use client";

import { useEffect, useState } from "react";
import type { SpotifyApi, Track, Artist } from "@spotify/web-api-ts-sdk";
import { IconSearch, IconLoader2 } from "@tabler/icons-react";
import { MediaCard } from "./MediaCard";
import { useLibrary } from "@/hooks/useLibrary";
import { pickImage } from "@/lib/images";

export function SearchPanel({
  sdk,
  onPlay,
}: {
  sdk: SpotifyApi;
  // `uris` for tracks; `context` (e.g. an artist/playlist URI) for everything
  // else. Artist URIs must go through context — they're not valid in `uris`.
  onPlay: (uris?: string[], context?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const library = useLibrary(sdk);
  const { prime } = library;

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setTracks([]);
      setArtists([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        // Spotify caps search `limit` at 10 (sending more returns 400).
        const res = await sdk.search(q, ["track", "artist"], undefined, 10);
        const found = res.tracks?.items ?? [];
        setTracks(found);
        setArtists(res.artists?.items ?? []);
        prime(found.map((t) => t.id));
      } catch {
        setTracks([]);
        setArtists([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, sdk, prime]);

  return (
    <div>
      <div className="relative mb-8 max-w-xl">
        <IconSearch
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
        />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tracks and artists…"
          className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-11 pr-11 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-[#1db954]/60 focus:bg-white/[0.07]"
        />
        {loading && (
          <IconLoader2
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-neutral-500"
          />
        )}
      </div>

      {query.trim() === "" ? (
        <p className="text-sm text-neutral-500">
          Start typing to search Spotify&apos;s catalog.
        </p>
      ) : (
        <div className="space-y-10">
          {artists.length > 0 && (
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Artists
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {artists.map((a) => (
                  <MediaCard
                    key={a.id}
                    image={pickImage(a.images)}
                    title={a.name}
                    subtitle={`${a.followers?.total?.toLocaleString() ?? 0} followers`}
                    href={a.external_urls?.spotify}
                    round
                    onPlay={() => onPlay(undefined, a.uri)}
                  />
                ))}
              </div>
            </section>
          )}

          {tracks.length > 0 && (
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Tracks
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {tracks.map((t) => (
                  <MediaCard
                    key={t.id}
                    image={pickImage(t.album.images)}
                    title={t.name}
                    subtitle={t.artists.map((a) => a.name).join(", ")}
                    href={t.external_urls?.spotify}
                    onPlay={() => onPlay([t.uri])}
                    saved={!!library.saved[t.id]}
                    onToggleSave={() => library.toggle(t.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {!loading && tracks.length === 0 && artists.length === 0 && (
            <p className="text-sm text-neutral-500">No results found.</p>
          )}
        </div>
      )}
    </div>
  );
}
