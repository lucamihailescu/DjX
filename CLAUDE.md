@AGENTS.md

# Project notes & lessons learned

This is **DjX**, a client-side Spotify web UI (Next.js + `@spotify/web-api-ts-sdk` browser PKCE + Aceternity UI). Hard-won gotchas to avoid repeating:

## Spotify browser PKCE auth

- **Memoize the code exchange — it is single-use.** React Strict Mode fires effects twice in dev. The auth `code` and the PKCE verifier are each single-use, so a second `sdk.authenticate()` fails with **"No verifier found in cache - can't validate query string callback parameters."** Guard the exchange behind a module-level memoized promise so both effect runs await one result. See `src/hooks/useSpotify.ts`.
- **Strip `?code=`/`?state=` in a `finally`, so it clears on FAILURE too.** If the exchange throws (e.g. a lost verifier) and you only strip on success, the dead code stays in the URL and re-throws on every refresh AND every Connect-button click — the app wedges and the login button looks broken. Server restarts don't help (the code is in the URL + verifier/token in `localStorage`, all client-side). Wrap `authenticate()` in `try { … } finally { replaceState(pathname) }`.
- **Strip `?code=`/`?state=` only AFTER `authenticate()` resolves — never before.** `authenticate()` reads the `code` directly from `window.location.search` to perform the exchange. Stripping it first makes the SDK see "no code, no token" and start a *new* authorize redirect → infinite login loop (Spotify → callback → strip → redirect → repeat). The single-exchange guarantee must come from the module-level memo, NOT from URL stripping.
- **`getAccessToken()` vs `authenticate()`:** `getAccessToken()` reads the cached token *without* redirecting; `authenticate()` redirects to Spotify's consent screen. On page load, only call `authenticate()` when a `?code=` is present — otherwise it bounces a logged-out user straight to Spotify instead of showing the login screen.
- **Use `http://127.0.0.1:3000`, not `localhost`.** Spotify rejects `localhost` redirect URIs. The verifier lives in `localStorage`, which is **per-origin** — if login starts on one host and the redirect lands on the other, the verifier genuinely won't be found ("No verifier found in cache"). The Next dev terminal prints a `localhost` link, which lures users onto the wrong origin. `useSpotify` defends against this with `canonicalizeHost()`: on load, if the hostname is `localhost`/`0.0.0.0`/`[::1]` it `location.replace`s to `127.0.0.1` BEFORE any auth begins, so login and the callback always share one origin. Don't remove this guard.

## AI playlist builder (Ollama → Spotify Search)

- **Proxy Ollama through a Next API route, never the browser.** Ollama's CORS (`OLLAMA_ORIGINS`) blocks direct browser calls; the server route (`src/app/api/playlist-intent/route.ts`) reaches `localhost:11434` with no CORS issue. Spotify calls stay in the browser where the user token lives.
- **Thinking models (qwen3, etc.) need `think: false`** in the `/api/chat` body — otherwise a single request spends 180s+ on reasoning before emitting JSON. With `think:false` the same call returns in ~4s. Non-thinking models reject the field with a 400, so retry once without it.
- **Always wrap the Ollama fetch in an `AbortController` timeout** (`OLLAMA_TIMEOUT_MS`, default 90s) so a slow/stuck model fails fast with a helpful message instead of hanging the route.
- **Constrain the model to REAL Spotify search syntax.** Left unguided it invents filters like `bpm:130-150`, `popularity:high`, `filter:bpm_high` that Spotify silently ignores → empty results. The system prompt must whitelist only `genre: artist: track: album: year:` + free text and forbid the rest.
- **Spotify's Recommendations / audio-features / genre-seed endpoints are deprecated for new apps (Nov 2024).** Don't use `sdk.recommendations`. Approximate "bangers" by sorting Search results on `track.popularity`.
- **Search `limit` max is now 10 (not 50).** `/v1/search?...&limit=12` returns a bare **400 Bad Request** even though the SDK types allow `MaxInt<50>`. Keep all `sdk.search(...)` limits ≤ 10; use `offset` to page for more. Symptom: search worked before, suddenly 400s with an otherwise-valid query — it's the limit, not the query/auth.
- Env (server-side, NOT `NEXT_PUBLIC_`): `OLLAMA_BASE_URL`, `OLLAMA_MODEL`. `next dev` (Turbopack) reads these from `.env.local`, not from inline shell vars passed to `npm run dev`.
- **The `@spotify/web-api-ts-sdk` v1.2.0 calls TWO retired playlist-write paths — both 403 now. Bypass both with `makeRequest`:**
  - Create: SDK calls `POST /users/{user_id}/playlists` → retired. Use `sdk.makeRequest<Playlist>("POST", "me/playlists", { name, description, public })`.
  - Add items: SDK's `addItemsToPlaylist` calls `POST /playlists/{id}/tracks` → retired (renamed). Use `sdk.makeRequest("POST", \`playlists/${id}/items\`, { uris })`. Still 100 URIs/call max.
  - Both retired paths return a bare `403 Forbidden` even with a valid token, both `playlist-modify-*` scopes, and an allowlisted user — **identical to a permissions failure**, which cost a lot of time (we chased re-consent, revoke, dev-mode allowlist, public/private scope splits — none were the cause). The tell: create succeeded after the first fix but add-items still 403'd → a second stale endpoint, not permissions.
- **When a playlist write 403s with a bare `{"error":{"status":403,"message":"Forbidden"}}` (NOT "Insufficient client scope") on a token you've confirmed has the scopes, suspect a stale SDK endpoint path, not auth.** Verify the SDK's path against the CURRENT API reference (use the canonical doc page, e.g. `add-items-to-playlist`, not the legacy `add-tracks-to-playlist` which still shows the old `/tracks`).
- **Adding new scopes does NOT update existing tokens.** A 403 "Forbidden" / "Bad OAuth request" on playlist write means the cached token predates the scope addition. An unexpired token is reused as-is (`getAccessToken()` never re-prompts), and even `authenticate()` reuses a valid cached token — so the new scope is never requested. Fix: `logOut()` (clears the token) THEN `authenticate()` to force fresh consent. The hook exposes `reconnect()` for exactly this.
- **Do NOT try to detect missing scopes client-side from the token's `scope` field.** It works right after a fresh auth, but Spotify OMITS `scope` from refresh-token responses, so once the SDK auto-refreshes (~1h) the cached token has no `scope` and any "missing scopes" check becomes a false positive. The only reliable signal is an actual 403 from the API call — react to that, don't pre-guess.
- The SDK's generic 403 message ("re-authenticating won't help here") is hardcoded and misleading — for a missing-scope 403, re-authenticating IS the fix.
- If `reconnect()` still doesn't grant the scope (Spotify silently re-approves cached consent), the bulletproof reset is to revoke the app at spotify.com/account/apps and log in fresh — the SDK can't send `show_dialog=true`.

## Next.js dev config

- Accessing the dev server via `127.0.0.1` triggers a cross-origin HMR block. Add `allowedDevOrigins: ["127.0.0.1"]` to `next.config.ts`.

## Tooling

- `create-next-app` rejects directory names with capital letters (this dir is `DjX`). Scaffold into a lowercase temp subdir (`djx-tmp`), then move files up — don't fight the npm naming rule.
- Aceternity UI has **no npm package** — components are copy-in. They depend on `motion` (import from `motion/react`), `clsx`, `tailwind-merge`, and `@tabler/icons-react`.
