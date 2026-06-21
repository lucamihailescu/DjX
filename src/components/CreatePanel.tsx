"use client";

import { useState } from "react";
import type { SpotifyApi, Track } from "@spotify/web-api-ts-sdk";
import { motion, AnimatePresence } from "motion/react";
import {
  IconSparkles,
  IconLoader2,
  IconBrandSpotify,
  IconX,
  IconExternalLink,
  IconRefresh,
  IconPlayerPlayFilled,
  IconWorld,
  IconUserHeart,
} from "@tabler/icons-react";
import {
  fetchIntent,
  resolveTracks,
  createPlaylist,
  buildLibraryPool,
  curatePlaylist,
  type PlaylistIntent,
} from "@/lib/playlist";
import { pickImage } from "@/lib/images";
import { cn, msToTime } from "@/lib/utils";

type Mode = "discover" | "personalized";

const EXAMPLES: Record<Mode, string[]> = {
  discover: [
    "EDM bangers for a late-night drive",
    "90s hip-hop classics",
    "Lo-fi beats to focus to",
    "High-energy gym techno",
  ],
  personalized: [
    "chill evening wind-down",
    "upbeat focus session",
    "nostalgic throwbacks",
    "high-energy workout",
  ],
};

type Stage = "idle" | "generating" | "preview" | "saving" | "done";

export function CreatePanel({
  sdk,
  onReconnect,
  onPlay,
}: {
  sdk: SpotifyApi;
  onReconnect: () => void;
  onPlay: (uris?: string[], context?: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("discover");
  const [pool, setPool] = useState<Track[] | null>(null);
  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<PlaylistIntent | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [result, setResult] = useState<{ url: string; id: string } | null>(null);
  // Set only when an actual save returns 403 — the signal that the token lacks
  // playlist-write (a stale grant). The endpoint itself is now correct
  // (POST /me/playlists), so a 403 here genuinely points at scope/consent.
  const [scopeBlocked, setScopeBlocked] = useState(false);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const showReauth = scopeBlocked;

  async function generate(p?: string) {
    const text = (p ?? prompt).trim();
    if (!text) return;
    setPrompt(text);
    setError(null);
    setResult(null);
    setStage("generating");
    try {
      if (mode === "personalized") {
        let p = pool;
        if (!p) {
          p = await buildLibraryPool(sdk);
          setPool(p);
        }
        if (p.length === 0) {
          throw new Error(
            "Your library looks empty. Play and save some tracks, or use Discover mode.",
          );
        }
        const cur = await curatePlaylist(text, p);
        if (cur.tracks.length === 0) {
          throw new Error("No tracks matched that mood from your library.");
        }
        setIntent({ name: cur.name, description: cur.description, queries: [] });
        setName(cur.name);
        setDescription(cur.description);
        setTracks(cur.tracks);
      } else {
        const got = await fetchIntent(text);
        const resolved = await resolveTracks(sdk, got);
        if (resolved.length === 0) {
          throw new Error(
            "No tracks matched. Try a more specific or popular genre.",
          );
        }
        setIntent(got);
        setName(got.name);
        setDescription(got.description);
        setTracks(resolved);
      }
      setStage("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("idle");
    }
  }

  async function save() {
    if (!name.trim() || tracks.length === 0) return;
    setStage("saving");
    setError(null);
    try {
      const res = await createPlaylist(
        sdk,
        name.trim(),
        description.trim(),
        tracks,
      );
      setResult({ url: res.url, id: res.id });
      setStage("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // With the endpoint corrected, a 403 means the token lacks playlist-write.
      if (/403|forbidden|oauth/i.test(msg)) {
        setScopeBlocked(true);
        setError(null);
      } else {
        setError(msg || "Couldn't save the playlist to Spotify.");
      }
      setStage("preview");
    }
  }

  async function refine() {
    const instruction = refineText.trim();
    if (!instruction || refining) return;
    setRefining(true);
    setError(null);
    try {
      if (mode === "personalized" && pool) {
        const cur = await curatePlaylist(
          `${prompt}. Adjustment: ${instruction}`,
          pool,
        );
        if (cur.tracks.length === 0) {
          throw new Error("That change returned no tracks — try rephrasing.");
        }
        setIntent({ name: cur.name, description: cur.description, queries: [] });
        setName(cur.name);
        setDescription(cur.description);
        setTracks(cur.tracks);
      } else {
        const labels = tracks.map(
          (t) => `${t.name} — ${t.artists.map((a) => a.name).join(", ")}`,
        );
        const got = await fetchIntent(prompt, {
          refine: instruction,
          current: labels,
        });
        const resolved = await resolveTracks(sdk, got);
        if (resolved.length === 0) {
          throw new Error("That change returned no tracks — try rephrasing.");
        }
        setIntent(got);
        setName(got.name);
        setDescription(got.description);
        setTracks(resolved);
      }
      setRefineText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't refine the playlist.");
    } finally {
      setRefining(false);
    }
  }

  function reset() {
    setStage("idle");
    setIntent(null);
    setTracks([]);
    setResult(null);
    setError(null);
    setRefineText("");
  }

  const busy = stage === "generating" || stage === "saving" || refining;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Mode toggle */}
      <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
        <ModeButton
          active={mode === "discover"}
          onClick={() => setMode("discover")}
          disabled={busy}
        >
          <IconWorld size={15} /> Discover
        </ModeButton>
        <ModeButton
          active={mode === "personalized"}
          onClick={() => setMode("personalized")}
          disabled={busy}
        >
          <IconUserHeart size={15} /> From your library
        </ModeButton>
      </div>

      {/* Prompt box */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-300">
          <IconSparkles size={18} className="text-[#1ed760]" />
          {mode === "personalized"
            ? "Describe a mood — Ollama curates it from your own top tracks, likes & recent plays"
            : "Describe a playlist and let your local Ollama build it from Spotify's catalog"}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
          }}
          rows={2}
          placeholder={
            mode === "personalized"
              ? "e.g. chill evening wind-down"
              : "e.g. EDM bangers for a late-night drive"
          }
          className="w-full resize-none rounded-xl border border-white/10 bg-black/40 p-4 text-base text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-[#1db954]/60"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES[mode].map((ex) => (
            <button
              key={ex}
              onClick={() => generate(ex)}
              disabled={busy}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 transition hover:border-white/20 hover:text-white disabled:opacity-40"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <span className="text-xs text-neutral-500">⌘/Ctrl + Enter</span>
          <button
            onClick={() => generate()}
            disabled={busy || !prompt.trim()}
            className="flex items-center gap-2 rounded-full bg-[#1db954] px-5 py-2.5 text-sm font-semibold text-black transition hover:scale-[1.03] hover:bg-[#1ed760] disabled:opacity-40 disabled:hover:scale-100"
          >
            {stage === "generating" ? (
              <>
                <IconLoader2 size={18} className="animate-spin" /> Curating…
              </>
            ) : (
              <>
                <IconSparkles size={18} /> Generate
              </>
            )}
          </button>
        </div>
      </div>

      {showReauth && (
        <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 sm:flex-row sm:items-center">
          <span>
            Spotify denied playlist write (403). Try reconnecting to refresh your
            session&apos;s permission.
          </span>
          <button
            onClick={onReconnect}
            className="shrink-0 rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300"
          >
            Reconnect Spotify
          </button>
        </div>
      )}

      {error && !showReauth && (
        <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <AnimatePresence mode="wait">
        {/* Success */}
        {stage === "done" && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 rounded-2xl border border-[#1db954]/30 bg-[#1db954]/10 p-6 text-center"
          >
            <IconBrandSpotify size={36} className="mx-auto text-[#1ed760]" />
            <h3 className="mt-3 text-lg font-bold text-neutral-100">
              “{name}” is on your Spotify
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              {tracks.length} tracks added.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => onPlay(undefined, `spotify:playlist:${result.id}`)}
                className="flex items-center gap-2 rounded-full bg-[#1db954] px-5 py-2 text-sm font-semibold text-black transition hover:scale-105 hover:bg-[#1ed760]"
              >
                <IconPlayerPlayFilled size={16} /> Play now
              </button>
              {result.url && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:scale-105"
                >
                  <IconExternalLink size={16} /> Open in Spotify
                </a>
              )}
              <button
                onClick={reset}
                className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/10"
              >
                <IconRefresh size={16} /> Make another
              </button>
            </div>
          </motion.div>
        )}

        {/* Preview */}
        {(stage === "preview" || stage === "saving") && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6"
          >
            <div className="mb-5 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-lg font-bold text-neutral-100 outline-none focus:border-[#1db954]/60"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                placeholder="Description (optional)"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-neutral-300 outline-none focus:border-[#1db954]/60"
              />
            </div>

            {/* Iterative AI refinement */}
            <div className="mb-4 rounded-xl border border-[#1ed760]/20 bg-[#1db954]/[0.06] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#1ed760]">
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
                  placeholder="e.g. more upbeat, drop the sad ones, add 90s hits"
                  className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-[#1db954]/60 disabled:opacity-50"
                />
                <button
                  onClick={refine}
                  disabled={refining || !refineText.trim()}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1db954] px-4 text-sm font-semibold text-black transition hover:bg-[#1ed760] disabled:opacity-40"
                >
                  {refining ? (
                    <IconLoader2 size={16} className="animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </button>
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-neutral-400">
                {tracks.length} tracks
              </span>
              <button
                onClick={() => intent && generate(prompt)}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs text-neutral-400 transition hover:text-white disabled:opacity-40"
              >
                <IconRefresh size={14} /> Regenerate
              </button>
            </div>

            <div className="max-h-[360px] divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/5">
              {tracks.map((t, i) => (
                <div
                  key={t.id}
                  className="group flex items-center gap-3 px-3 py-2 transition hover:bg-white/[0.04]"
                >
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                    {i + 1}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pickImage(t.album.images)}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-neutral-100">
                      {t.name}
                    </div>
                    <div className="truncate text-xs text-neutral-400">
                      {t.artists.map((a) => a.name).join(", ")}
                    </div>
                  </div>
                  <span className="hidden shrink-0 text-xs tabular-nums text-neutral-500 sm:block">
                    {msToTime(t.duration_ms)}
                  </span>
                  <button
                    onClick={() =>
                      setTracks((prev) => prev.filter((x) => x.id !== t.id))
                    }
                    className="shrink-0 rounded-full p-1.5 text-neutral-500 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                    aria-label={`Remove ${t.name}`}
                  >
                    <IconX size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={reset}
                disabled={busy}
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-40"
              >
                Discard
              </button>
              <button
                onClick={save}
                disabled={busy || tracks.length === 0 || !name.trim()}
                className="flex items-center gap-2 rounded-full bg-[#1db954] px-5 py-2.5 text-sm font-semibold text-black transition hover:scale-[1.03] hover:bg-[#1ed760] disabled:opacity-40 disabled:hover:scale-100"
              >
                {stage === "saving" ? (
                  <>
                    <IconLoader2 size={18} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <IconBrandSpotify size={18} /> Save to Spotify
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition disabled:opacity-50",
        active ? "bg-white text-black" : "text-neutral-300 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
