# DjX — Spotify Console

A modern web UI for Spotify, built with [`@spotify/web-api-ts-sdk`](https://github.com/spotify/spotify-web-api-ts-sdk), Next.js, and [Aceternity UI](https://ui.aceternity.com/) components (Spotlight, Background Gradient, Hover Border Gradient, Bento Grid).

## Features

- **Browser PKCE login** — no backend, no client secret. The SDK handles the OAuth code exchange and token refresh in the browser.
- **Overview** — your top tracks, top artists, playlists, and recently played, in a responsive card grid.
- **Search** — debounced search across tracks and artists.
- **Playback control** — a sticky now-playing bar that polls live state, with play/pause/skip, plus hover-to-play on any card (controls an active Spotify device; **requires Spotify Premium**).
- **AI playlist builder (Create tab)** — describe a vibe ("EDM bangers for a late-night drive") and a **local Ollama** model turns it into Spotify search queries; the app resolves real tracks (ranked by popularity), previews them for editing, and saves the playlist to your account.

## AI playlist builder

The **Create** tab uses a local [Ollama](https://ollama.com) instance — no cloud AI key.

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

## Notes

- Playback control hits the Spotify Connect API, which **requires a Premium account and an active device** (open the Spotify app anywhere). Free accounts can still browse and search.
- Scopes requested are listed in `src/lib/spotify.ts`.
