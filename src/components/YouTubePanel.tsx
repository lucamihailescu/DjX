"use client";

import { useEffect, useState } from "react";
import {
  IconBrandYoutubeFilled,
  IconSearch,
  IconLoader2,
  IconPlayerPlayFilled,
  IconSparkles,
  IconListNumbers,
} from "@tabler/icons-react";
import {
  searchYouTube,
  resolveYouTube,
  type YouTubeResult,
} from "@/lib/youtube";
import { fetchIntent } from "@/lib/playlist";
import { useYouTube } from "./youtube-context";
import { cn } from "@/lib/utils";

type Tab = "search" | "ai";

const AI_EXAMPLES = [
  "EDM bangers for a late-night drive",
  "90s hip-hop classics",
  "Lo-fi beats to focus to",
  "Acoustic singer-songwriter, rainy day",
];

export function YouTubePanel() {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { current, play, playQueue } = useYouTube();

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

  // --- AI queue generation ---
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiTracks, setAiTracks] = useState<YouTubeResult[]>([]);
  const [aiName, setAiName] = useState("");
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);

  async function generate(p?: string) {
    const text = (p ?? aiPrompt).trim();
    if (!text || aiBusy) return;
    setAiPrompt(text);
    setAiBusy(true);
    setAiError(null);
    setAiTracks([]);
    try {
      const intent = await fetchIntent(text, { target: "youtube" });
      const videos = await resolveYouTube(intent.queries);
      if (videos.length === 0) {
        throw new Error(
          "No playable videos matched. Try a more specific request.",
        );
      }
      setAiName(intent.name);
      setAiTracks(videos);
      setRefineText("");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Couldn't build the queue.");
    } finally {
      setAiBusy(false);
    }
  }

  async function refine() {
    const instruction = refineText.trim();
    if (!instruction || refining || aiBusy) return;
    setRefining(true);
    setAiError(null);
    try {
      const labels = aiTracks.map((t) => t.title);
      const intent = await fetchIntent(aiPrompt, {
        target: "youtube",
        refine: instruction,
        current: labels,
      });
      const videos = await resolveYouTube(intent.queries);
      if (videos.length === 0) {
        throw new Error("That change returned no videos — try rephrasing.");
      }
      setAiName(intent.name);
      setAiTracks(videos);
      setRefineText("");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Couldn't refine the queue.");
    } finally {
      setRefining(false);
    }
  }

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

      <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
        <TabButton active={tab === "search"} onClick={() => setTab("search")}>
          <IconSearch size={15} /> Search
        </TabButton>
        <TabButton active={tab === "ai"} onClick={() => setTab("ai")}>
          <IconSparkles size={15} /> AI queue
        </TabButton>
      </div>

      {tab === "search" && (
        <>
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
              {results.map((r) => (
                <VideoCard
                  key={r.videoId}
                  r={r}
                  active={current?.videoId === r.videoId}
                  onClick={() => play(r)}
                />
              ))}
              {!loading && results.length === 0 && (
                <p className="text-sm text-neutral-500">No results.</p>
              )}
            </div>
          )}
        </>
      )}

      {tab === "ai" && (
        <>
          <div className="mb-6 max-w-xl rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-300">
              <IconSparkles size={18} className="text-[#ff0033]" />
              Describe a vibe — your local Ollama builds a YouTube queue
            </div>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
              }}
              rows={2}
              placeholder="e.g. EDM bangers for a late-night drive"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-base text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-[#ff0033]/50"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {AI_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => generate(ex)}
                  disabled={aiBusy}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 transition hover:border-white/20 hover:text-white disabled:opacity-40"
                >
                  {ex}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="text-xs text-neutral-500">⌘/Ctrl + Enter</span>
              <button
                onClick={() => generate()}
                disabled={aiBusy || !aiPrompt.trim()}
                className="flex items-center gap-2 rounded-full bg-[#ff0033] px-5 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.03] disabled:opacity-40 disabled:hover:scale-100"
              >
                {aiBusy ? (
                  <>
                    <IconLoader2 size={18} className="animate-spin" /> Building…
                  </>
                ) : (
                  <>
                    <IconSparkles size={18} /> Generate queue
                  </>
                )}
              </button>
            </div>
          </div>

          {aiError && (
            <p className="mb-6 max-w-xl rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {aiError}
            </p>
          )}

          {aiTracks.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-neutral-300">
                <IconListNumbers size={16} className="text-neutral-500" />
                <span className="font-medium text-neutral-100">{aiName}</span>
                <span className="text-neutral-500">· {aiTracks.length} videos</span>
              </div>
              <button
                onClick={() => playQueue(aiTracks)}
                className="flex items-center gap-2 rounded-full bg-[#ff0033] px-5 py-2 text-sm font-semibold text-white transition hover:scale-105"
              >
                <IconPlayerPlayFilled size={16} /> Play queue
              </button>
            </div>
          )}

          {aiTracks.length > 0 && (
            <div className="mb-5 max-w-xl rounded-xl border border-[#ff0033]/20 bg-[#ff0033]/[0.06] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#ff5277]">
                <IconSparkles size={14} /> Refine with AI
              </div>
              <div className="flex gap-2">
                <input
                  value={refineText}
                  onChange={(e) => setRefineText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") refine();
                  }}
                  disabled={refining}
                  placeholder="e.g. more upbeat, drop the slow ones, add 2000s hits"
                  className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-[#ff0033]/50 disabled:opacity-50"
                />
                <button
                  onClick={refine}
                  disabled={refining || !refineText.trim()}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#ff0033] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
                >
                  {refining ? (
                    <IconLoader2 size={16} className="animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </button>
              </div>
            </div>
          )}

          {aiTracks.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {aiTracks.map((r) => (
                <VideoCard
                  key={r.videoId}
                  r={r}
                  active={current?.videoId === r.videoId}
                  onClick={() => play(r)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition",
        active ? "bg-white text-black" : "text-neutral-300 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function VideoCard({
  r,
  active,
  onClick,
}: {
  r: YouTubeResult;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
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
}
