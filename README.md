# DjX — Spotify Console

A modern web UI for Spotify, built with [`@spotify/web-api-ts-sdk`](https://github.com/spotify/spotify-web-api-ts-sdk), Next.js, and [Aceternity UI](https://ui.aceternity.com/) components (Spotlight, Background Gradient, Hover Border Gradient, Bento Grid).

## Features

- **Browser PKCE login** — no backend, no client secret. The SDK handles the OAuth code exchange and token refresh in the browser.
- **Overview** — your top tracks, top artists, playlists, and recently played, in a responsive card grid.
- **Search** — debounced search across tracks and artists.
- **Playback control** — a sticky now-playing bar that polls live state, with play/pause/skip, plus hover-to-play on any card (controls an active Spotify device; **requires Spotify Premium**).
- **AI playlist builder (Create tab)** — describe a vibe ("EDM bangers for a late-night drive") and a **local Ollama** model turns it into Spotify search queries; the app resolves real tracks (ranked by popularity), previews them for editing, and saves the playlist to your account.

## AI playlist builder

The **Create** tab works with two interchangeable LLM backends, chosen by `LLM_PROVIDER`:

- **`ollama`** (default) — a local [Ollama](https://ollama.com) instance. Free, offline, ideal for local dev.
- **`gateway`** — the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) (OpenAI-compatible). Use this when deploying to Vercel, where there's no local Ollama. Set `AI_GATEWAY_API_KEY` (or rely on OIDC on Vercel) and `LLM_MODEL` (e.g. `openai/gpt-4o-mini`).

Both share the same route code (`src/lib/llm.ts` → `chatJSON`); only env differs. Local-dev quick start with Ollama:

1. Install Ollama and pull a model:
   ```bash
   ollama serve                      # if not already running
   ollama pull qwen2.5:7b-instruct   # recommended; set OLLAMA_MODEL to match
   ```
   A fast, non-thinking instruct model is best for this JSON task. Good picks:
   `qwen2.5:7b-instruct` (recommended), `llama3.1:8b`, or `llama3.2:3b` for low RAM.
2. Configure in `.env.local` (server-side only, **not** `NEXT_PUBLIC_`):
   ```bash
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=qwen2.5:7b-instruct
   ```
3. Open **Create**, type a prompt, **Generate**, tweak the track list/name, then **Save to Spotify**.

How it works: the browser posts the prompt to `/api/playlist-intent` (a Next route that proxies Ollama — avoids browser CORS), which returns `{ name, description, queries }`. The browser resolves those queries via the Spotify Search SDK, dedupes, and ranks by popularity (a "banger" proxy, since Spotify deprecated the recommendations/audio-features endpoints for new apps). Reasoning models are run with `think: false` so a request takes ~4s instead of minutes.

## Setup

1. **Create a Spotify app** at the [Developer Dashboard](https://developer.spotify.com/dashboard).
2. Under **Redirect URIs**, add exactly:
   ```
   http://127.0.0.1:3000
   ```
   > Spotify no longer accepts `http://localhost` — use the loopback IP `127.0.0.1`.
3. Copy the env file and paste your **Client ID**:
   ```bash
   cp .env.example .env.local
   # edit .env.local → NEXT_PUBLIC_SPOTIFY_CLIENT_ID=...
   ```
4. Install and run:
   ```bash
   npm install
   npm run dev
   ```
5. Open **http://127.0.0.1:3000** (not `localhost`, so the redirect URI matches) and click **Connect with Spotify**.

## How auth works

`src/lib/spotify.ts` creates a singleton via `SpotifyApi.withUserAuthorization(clientId, redirectUri, scopes)`. The `useSpotify` hook (`src/hooks/useSpotify.ts`):

- On load, completes the PKCE exchange if it sees a `?code=` param, otherwise reads any cached token **without** redirecting.
- `login()` calls `sdk.authenticate()`, which redirects to Spotify's consent screen.
- `logout()` clears the cached token.

Tokens live in the browser's local storage and refresh automatically.

## Deploying to Vercel

The app runs locally against a persistent machine (SQLite + local Ollama). For Vercel's serverless/ephemeral environment, two backends switch automatically by env — **no code changes**:

| Concern | Local dev (default) | Vercel |
|---|---|---|
| LLM (Create/Curate) | local Ollama | **Vercel AI Gateway** — set `LLM_PROVIDER=gateway`, `AI_GATEWAY_API_KEY`, `LLM_MODEL` |
| Persistence (YouTube history) | SQLite (`./data/djx.db`) | **Upstash Redis / Vercel KV** — set `UPSTASH_REDIS_REST_URL` + `_TOKEN` (or `KV_*`) |

Both stores share one API (`src/lib/db.ts`); the LLM shares one (`src/lib/llm.ts`). Other Vercel notes:

- **Spotify redirect URI:** add `https://<your-app>.vercel.app` (or your custom domain) to the Spotify dashboard. You can leave `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI` unset — the app derives it from `window.location.origin` at runtime. (OAuth won't work on random *preview* URLs, since Spotify has no wildcard redirect URIs.)
- **YouTube key:** restrict it by **API (YouTube Data API v3)**, not HTTP referrer — server-side calls from Vercel send no referrer.
- **Env vars** are set in the Vercel project; `NEXT_PUBLIC_*` are inlined at build, so set them before deploying.

## Notes

- Playback control hits the Spotify Connect API, which **requires a Premium account and an active device** (open the Spotify app anywhere). Free accounts can still browse and search.
- Scopes requested are listed in `src/lib/spotify.ts`.
