"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  SpotifyApi,
  UserProfile,
  Track,
  Artist,
  SimplifiedPlaylist,
} from "@spotify/web-api-ts-sdk";
import { motion, AnimatePresence } from "motion/react";
import {
  IconBrandSpotify,
  IconLogout,
  IconLayoutGrid,
  IconSearch,
  IconSparkles,
  IconChevronDown,
  IconSettings,
  IconLoader2,
  IconBrandYoutubeFilled,
  IconDeviceSpeaker,
} from "@tabler/icons-react";
import { PlaybackBar } from "./PlaybackBar";
import { SearchPanel } from "./SearchPanel";
import { CreatePanel } from "./CreatePanel";
import { SettingsPanel } from "./SettingsPanel";
import { YouTubePanel } from "./YouTubePanel";
import { YouTubeMiniPlayer } from "./YouTubeMiniPlayer";
import { YouTubeProvider, useYouTube } from "./youtube-context";
import { SpotifyPlaybackProvider } from "./spotify-playback-context";
import { NowPlayingHero } from "./NowPlayingHero";
import { MediaCard } from "./MediaCard";
import { deletePlaylist } from "@/lib/playlist";
import { getLikedTracks } from "@/lib/library";
import { useLibrary } from "@/hooks/useLibrary";
import { useSpotifyWebPlayer } from "@/hooks/useSpotifyWebPlayer";
import { pickImage } from "@/lib/images";
import { cn } from "@/lib/utils";

type Tab = "overview" | "search" | "create" | "youtube" | "settings";

export function Dashboard({
  sdk,
  profile,
  entraUser,
  onLogout,
  onReconnect,
}: {
  sdk: SpotifyApi;
  profile: UserProfile;
  entraUser: {
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  onLogout: () => void;
  onReconnect: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [topArtists, setTopArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<SimplifiedPlaylist[]>([]);
  const [recent, setRecent] = useState<Track[]>([]);
  const [liked, setLiked] = useState<Track[]>([]);
  // Total counts (for "Load more"); recent uses cursor paging so it's capped.
  const [totals, setTotals] = useState({ tracks: 0, artists: 0, playlists: 0, liked: 0 });
  const [loadingMore, setLoadingMore] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const library = useLibrary(sdk);
  // In-browser playback device (Web Playback SDK). null until ready / on non-Premium.
  const webPlayer = useSpotifyWebPlayer(sdk);
  const webDeviceId = webPlayer.deviceId;

  const PAGE = 24;

  // Lets the YouTube history sync per Spotify account (verified server-side).
  const getToken = useCallback(
    () => sdk.getAccessToken().then((t) => t?.access_token ?? null),
    [sdk],
  );

  useEffect(() => {
    (async () => {
      const [tracks, artists, lists, recentlyPlayed, likedSongs] =
        await Promise.allSettled([
          sdk.currentUser.topItems("tracks", "medium_term", PAGE),
          sdk.currentUser.topItems("artists", "medium_term", PAGE),
          sdk.currentUser.playlists.playlists(PAGE),
          sdk.player.getRecentlyPlayedTracks(50),
          getLikedTracks(sdk, PAGE),
        ]);
      if (tracks.status === "fulfilled") {
        setTopTracks(tracks.value.items);
        setTotals((s) => ({ ...s, tracks: tracks.value.total }));
      }
      if (artists.status === "fulfilled") {
        setTopArtists(artists.value.items);
        setTotals((s) => ({ ...s, artists: artists.value.total }));
      }
      if (lists.status === "fulfilled") {
        setPlaylists(lists.value.items);
        setTotals((s) => ({ ...s, playlists: lists.value.total }));
      }
      if (recentlyPlayed.status === "fulfilled")
        setRecent(recentlyPlayed.value.items.map((i) => i.track));
      if (likedSongs.status === "fulfilled") {
        setLiked(likedSongs.value.tracks);
        setTotals((s) => ({ ...s, liked: likedSongs.value.total }));
      }
    })();
  }, [sdk]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadMore = useCallback(
    async (key: "tracks" | "artists" | "playlists" | "liked") => {
      setLoadingMore(key);
      try {
        if (key === "tracks") {
          const r = await sdk.currentUser.topItems("tracks", "medium_term", PAGE, topTracks.length);
          setTopTracks((p) => [...p, ...r.items]);
        } else if (key === "artists") {
          const r = await sdk.currentUser.topItems("artists", "medium_term", PAGE, topArtists.length);
          setTopArtists((p) => [...p, ...r.items]);
        } else if (key === "playlists") {
          const r = await sdk.currentUser.playlists.playlists(PAGE, playlists.length);
          setPlaylists((p) => [...p, ...r.items]);
        } else {
          const r = await getLikedTracks(sdk, PAGE, liked.length);
          setLiked((p) => [...p, ...r.tracks]);
        }
      } catch {
        notify("Couldn't load more.");
      } finally {
        setLoadingMore(null);
      }
    },
    [sdk, topTracks.length, topArtists.length, playlists.length, liked.length, notify],
  );

  // Prime saved-state for every track id we display so hearts render correctly.
  const { prime } = library;
  useEffect(() => {
    const ids = [...topTracks, ...recent, ...liked].map((t) => t.id);
    if (ids.length) prime(ids);
  }, [topTracks, recent, liked, prime]);

  const removePlaylist = useCallback(
    async (id: string) => {
      try {
        await deletePlaylist(sdk, id);
        setPlaylists((prev) => prev.filter((p) => p.id !== id));
        notify("Playlist deleted");
      } catch {
        notify("Couldn't delete the playlist.");
      }
    },
    [sdk, notify],
  );

  /** Start playback on the active device. `uris` for tracks, `context` for playlists/artists. */
  const play = useCallback(
    async (uris?: string[], context?: string) => {
      const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
      // Prefer the in-browser device when the Web Playback SDK is ready — plays
      // right here in the tab. Fall back to a remote device if it fails.
      if (webDeviceId) {
        try {
          await sdk.player.startResumePlayback(webDeviceId, context, uris);
          notify("Playing in browser ▶");
          return;
        } catch {
          /* fall through to remote devices */
        }
      }
      try {
        const { devices } = await sdk.player.getAvailableDevices();
        if (devices.length === 0) {
          notify(
            "No Spotify device found. Open Spotify on your phone, desktop, or web player, then try again.",
          );
          return;
        }
        const active = devices.find((d) => d.is_active) ?? devices[0];
        if (!active?.id) {
          notify("No usable Spotify device. Open Spotify on a device first.");
          return;
        }

        const start = () =>
          sdk.player.startResumePlayback(active.id!, context, uris);
        try {
          await start();
        } catch (e) {
          // A device that's available but not active returns 404 "Device not
          // found". Transfer to activate it, then retry once.
          if (!active.is_active && /404|not found|no_active_device/i.test(errMsg(e))) {
            await sdk.player.transferPlayback([active.id], false);
            await new Promise((r) => setTimeout(r, 700));
            await start();
          } else {
            throw e;
          }
        }
        notify("Playing ▶");
      } catch (e) {
        const msg = errMsg(e);
        if (/premium/i.test(msg)) {
          notify("Spotify Premium is required to control playback.");
        } else if (/404|not found|no_active_device/i.test(msg)) {
          notify(
            "No active device. Open Spotify and press play once, then control it from here.",
          );
        } else if (/403|forbidden|restriction/i.test(msg)) {
          notify("Spotify blocked that (device restriction). Try another device.");
        } else {
          notify(`Couldn't start playback: ${msg.slice(0, 140)}`);
        }
      }
    },
    [sdk, notify, webDeviceId],
  );

  return (
    <SpotifyPlaybackProvider sdk={sdk}>
    <YouTubeProvider getToken={getToken}>
      <div className="min-h-screen pb-28">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <IconBrandSpotify size={28} className="text-[#1db954]" />
            <span className="text-lg font-bold tracking-tight">DjX</span>
          </div>

          <nav className="order-last flex w-full items-center justify-between gap-1 rounded-full border border-white/10 bg-white/5 p-1 md:order-none md:w-auto md:justify-start">
            <TabButton active={tab === "overview"} onClick={() => setTab("overview")} label="Overview">
              <IconLayoutGrid size={16} />
            </TabButton>
            <TabButton active={tab === "search"} onClick={() => setTab("search")} label="Search">
              <IconSearch size={16} />
            </TabButton>
            <TabButton active={tab === "create"} onClick={() => setTab("create")} label="Create">
              <IconSparkles size={16} />
            </TabButton>
            <TabButton
              active={tab === "youtube"}
              onClick={() => setTab("youtube")}
              label="YouTube"
            >
              <IconBrandYoutubeFilled size={16} />
            </TabButton>
            <TabButton
              active={tab === "settings"}
              onClick={() => setTab("settings")}
              label="Settings"
            >
              <IconSettings size={16} />
            </TabButton>
          </nav>

          <div className="flex items-center gap-3">
            {webPlayer.status === "ready" && (
              <span
                className="hidden items-center gap-1.5 rounded-full border border-[#1db954]/30 bg-[#1db954]/10 px-3 py-1 text-xs text-[#1ed760] md:flex"
                title="This tab is a Spotify playback device — playback happens here"
              >
                <IconDeviceSpeaker size={13} /> In-browser playback
              </span>
            )}
            <div className="hidden text-right sm:block">
              {entraUser ? (
                <>
                  <div className="text-sm font-medium leading-tight">
                    {entraUser.name ?? entraUser.email}
                  </div>
                  {entraUser.email && (
                    <div className="text-xs text-neutral-400">
                      {entraUser.email}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-neutral-500">
                    Spotify:{" "}
                    <span className="text-neutral-400">
                      {profile.display_name}
                    </span>{" "}
                    <span className="capitalize">({profile.product})</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium leading-tight">
                    {profile.display_name}
                  </div>
                  <div className="text-xs capitalize text-neutral-400">
                    {profile.product} account
                  </div>
                </>
              )}
            </div>
            {entraUser?.image || pickImage(profile.images, "small") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entraUser?.image || pickImage(profile.images, "small")}
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-2 ring-[#1db954]/40"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1db954] text-sm font-bold text-black">
                {(entraUser?.name ?? profile.display_name)?.[0]?.toUpperCase() ??
                  "?"}
              </div>
            )}
            <button
              onClick={onLogout}
              className="rounded-full p-2 text-neutral-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Log out"
            >
              <IconLogout size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {tab === "search" ? (
          <SearchPanel sdk={sdk} onPlay={play} />
        ) : tab === "create" ? (
          <CreatePanel sdk={sdk} onReconnect={onReconnect} onPlay={play} />
        ) : tab === "youtube" ? (
          <YouTubePanel />
        ) : tab === "settings" ? (
          <SettingsPanel />
        ) : (
          <div className="space-y-4">
            <NowPlayingHero
              sdk={sdk}
              savedMap={library.saved}
              onToggleSave={(id) => library.toggle(id)}
              primeSaved={library.prime}
            />
            <CollapsibleSection title="Your Top Tracks" count={totals.tracks || topTracks.length}>
              <Grid>
                {topTracks.map((t) => (
                  <MediaCard
                    key={t.id}
                    image={pickImage(t.album.images)}
                    title={t.name}
                    subtitle={t.artists.map((a) => a.name).join(", ")}
                    href={t.external_urls?.spotify}
                    onPlay={() => play([t.uri])}
                    saved={!!library.saved[t.id]}
                    onToggleSave={() => library.toggle(t.id)}
                  />
                ))}
              </Grid>
              <LoadMore
                show={topTracks.length < totals.tracks}
                loading={loadingMore === "tracks"}
                onClick={() => loadMore("tracks")}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Your Top Artists" count={totals.artists || topArtists.length}>
              <Grid>
                {topArtists.map((a) => (
                  <MediaCard
                    key={a.id}
                    image={pickImage(a.images)}
                    title={a.name}
                    subtitle={a.genres?.slice(0, 2).join(", ") || "Artist"}
                    href={a.external_urls?.spotify}
                    round
                    onPlay={() => play(undefined, a.uri)}
                  />
                ))}
              </Grid>
              <LoadMore
                show={topArtists.length < totals.artists}
                loading={loadingMore === "artists"}
                onClick={() => loadMore("artists")}
              />
            </CollapsibleSection>

            {playlists.length > 0 && (
              <CollapsibleSection title="Your Playlists" count={totals.playlists || playlists.length}>
                <Grid>
                  {playlists.map((p) => (
                    <MediaCard
                      key={p.id}
                      image={pickImage(p.images)}
                      title={p.name}
                      subtitle={`${p.tracks?.total ?? 0} tracks`}
                      href={p.external_urls?.spotify}
                      onPlay={() => play(undefined, p.uri)}
                      onDelete={() => removePlaylist(p.id)}
                    />
                  ))}
                </Grid>
                <LoadMore
                  show={playlists.length < totals.playlists}
                  loading={loadingMore === "playlists"}
                  onClick={() => loadMore("playlists")}
                />
              </CollapsibleSection>
            )}

            {recent.length > 0 && (
              <CollapsibleSection title="Recently Played" count={recent.length}>
                <Grid>
                  {recent.map((t, i) => (
                    <MediaCard
                      key={`${t.id}-${i}`}
                      image={pickImage(t.album.images)}
                      title={t.name}
                      subtitle={t.artists.map((a) => a.name).join(", ")}
                      href={t.external_urls?.spotify}
                      onPlay={() => play([t.uri])}
                      saved={!!library.saved[t.id]}
                      onToggleSave={() => library.toggle(t.id)}
                    />
                  ))}
                </Grid>
              </CollapsibleSection>
            )}

            <YouTubeRecentSection />

            {liked.length > 0 && (
              <CollapsibleSection title="Liked Songs" count={totals.liked || liked.length}>
                <Grid>
                  {liked.map((t) => (
                    <MediaCard
                      key={t.id}
                      image={pickImage(t.album.images)}
                      title={t.name}
                      subtitle={t.artists.map((a) => a.name).join(", ")}
                      href={t.external_urls?.spotify}
                      onPlay={() => play([t.uri])}
                      saved={library.saved[t.id] ?? true}
                      onToggleSave={() => library.toggle(t.id)}
                    />
                  ))}
                </Grid>
                <LoadMore
                  show={liked.length < totals.liked}
                  loading={loadingMore === "liked"}
                  onClick={() => loadMore("liked")}
                />
              </CollapsibleSection>
            )}
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-900/90 px-5 py-2.5 text-sm text-neutral-100 shadow-2xl backdrop-blur">
          {toast}
        </div>
      )}

      <YouTubeMiniPlayer />
      <PlaybackBar sdk={sdk} />
      </div>
    </YouTubeProvider>
    </SpotifyPlaybackProvider>
  );
}

function YouTubeRecentSection() {
  const { history, play } = useYouTube();
  if (history.length === 0) return null;
  return (
    <CollapsibleSection
      title="Recently Played on YouTube"
      count={history.length}
    >
      <Grid>
        {history.map((v) => (
          <MediaCard
            key={v.videoId}
            image={v.thumbnail}
            title={v.title}
            subtitle={v.channel}
            href={`https://www.youtube.com/watch?v=${v.videoId}`}
            onPlay={() => play(v)}
          />
        ))}
      </Grid>
    </CollapsibleSection>
  );
}

function CollapsibleSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015]">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-white/[0.03]"
      >
        <span className="flex items-baseline gap-3">
          <span className="text-lg font-bold tracking-tight text-neutral-100">
            {title}
          </span>
          {count != null && (
            <span className="text-xs text-neutral-500">{count}</span>
          )}
        </span>
        <IconChevronDown
          size={20}
          className={cn(
            "text-neutral-400 transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function LoadMore({
  show,
  loading,
  onClick,
}: {
  show: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  if (!show) return null;
  return (
    <div className="mt-5 flex justify-center">
      <button
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-50"
      >
        {loading && <IconLoader2 size={16} className="animate-spin" />}
        Load more
      </button>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        // On mobile the nav is a full-width row, so tabs share the space and
        // show icon-only; labels return at md where the pill sits inline.
        "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition md:flex-none md:px-4",
        active
          ? "bg-white text-black"
          : "text-neutral-300 hover:text-white",
      )}
    >
      {children}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
