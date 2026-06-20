"use client";

import { useEffect, useState } from "react";
import {
  IconBrandYoutubeFilled,
  IconSearch,
  IconLoader2,
  IconPlayerPlayFilled,
} from "@tabler/icons-react";
import { searchYouTube, type YouTubeResult } from "@/lib/youtube";
import { useYouTube } from "./youtube-context";
import { cn } from "@/lib/utils";

export function YouTubePanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { current, play } = useYouTube();

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        setResults(await searchYouTube(q));
        setError(null);
      } catch (e) {
        setResults([]);
        setError(e instanceof Error ? e.message : "Search failed.");
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <IconBrandYoutubeFilled size={22} className="text-[#ff0033]" />
        <h2 className="text-xl font-bold tracking-tight">YouTube</h2>
      </div>
      <p className="mb-5 text-sm text-neutral-500">
        Search YouTube and play music videos — the player docks in the corner and
        keeps playing as you browse other tabs.
      </p>

      <div className="relative mb-8 max-w-xl">
        <IconSearch
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists, music videos…"
          className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-11 pr-11 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-[#ff0033]/50 focus:bg-white/[0.07]"
        />
        {loading && (
          <IconLoader2
            size={18}
            className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-neutral-500"
          />
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : query.trim() === "" ? (
        <p className="text-sm text-neutral-500">
          Start typing to search YouTube.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => {
            const active = current?.videoId === r.videoId;
            return (
              <button
                key={r.videoId}
                onClick={() => play(r)}
                className={cn(
                  "group flex gap-3 rounded-xl border p-2 text-left transition",
                  active
                    ? "border-[#ff0033]/50 bg-[#ff0033]/10"
                    : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]",
                )}
              >
                <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-white/5">
                  {r.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                    <IconPlayerPlayFilled size={26} className="text-white" />
                  </span>
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <div className="line-clamp-2 text-sm font-medium text-neutral-100">
                    {r.title}
                  </div>
                  <div className="mt-1 truncate text-xs text-neutral-400">
                    {active ? "Now playing" : r.channel}
                  </div>
                </div>
              </button>
            );
          })}
          {!loading && results.length === 0 && (
            <p className="text-sm text-neutral-500">No results.</p>
          )}
        </div>
      )}
    </div>
  );
}
