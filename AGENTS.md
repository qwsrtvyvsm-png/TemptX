# TEMPTX — Agent Instructions

Australia's premium adult industry network. Vanilla HTML/CSS/JS frontend served by a custom Node.js HTTP server. No build step. No framework.

## Dev Commands

```bash
bash scripts/setup.sh  # First-time setup: installs dependencies, creates .env from .env.example
npm start          # Start local server at http://127.0.0.1:5510
npm run check      # Syntax-check all JS files (node --check)
```

Node ≥ 18 required. No build or compile step — changes to HTML/CSS/JS are live on next request.

## Architecture

| Layer | Details |
|---|---|
| Frontend | Plain HTML pages + vanilla JS. No bundler, no framework. |
| Backend | Single-file custom HTTP server: [`server.js`](server.js) |
| Data | Postgres, accessed through [`lib/db.js`](lib/db.js) — one JSONB "document table" per collection (`users`, `reports`, `memberships`, `subscriptions`, `transactions`, `verification_events`, `bookings`, `client_notes`, `community_posts`, `community_follows`, `community_saved`, `community_groups`, `community_group_members`, `community_feedback`). `server.js` keeps an in-memory cache per collection (hydrated at boot, updated synchronously on write) and persists to Postgres in the background — see "Data layer" below. Requires `DATABASE_URL` in `.env`. The one file still on disk is `data/server-secret` (session-signing secret). |
| Auth | Session tokens in a server-side in-memory `Map`. Cookie: `temptx_session`. |
| PWA | [`pwa.js`](pwa.js) + [`sw.js`](sw.js) + [`manifest.webmanifest`](manifest.webmanifest) |

## User Roles

- **Client** — books/messages providers
- **Provider / Creator** — lists services, manages profile
- **Business** — friendly businesses listing
- **Admin** — moderation and platform management

Role is stored on the user record and checked server-side on every protected API call.

## Key Conventions

### Server (`server.js`)
- **Data layer**: each collection has a `readX()`/`writeX()` pair (from `makeStore()` in `server.js`) backed by an in-memory cache. `readX()` returns the cache synchronously; `writeX(records)` updates the cache immediately and persists to Postgres asynchronously via `lib/db.js`'s `writeCollection()` (fire-and-forget, logged on failure). Route handlers call these exactly as before — no `async`/`await` needed at call sites.
- **Atomic writes**: `lib/db.js` writes a whole collection inside a single Postgres transaction (`BEGIN` / `DELETE FROM` / re-`INSERT` / `COMMIT`), mirroring the old "read whole array, mutate, write whole array back" pattern but crash-safe. Never write to Postgres outside `lib/db.js`.
- **Serial queue** (`makeQueue()`): all read-modify-write operations on a collection must still go through that collection's queue (`usersQueue`, `reportsQueue`, etc.) to prevent race conditions in the in-process cache. Do not bypass.
- New API routes follow the existing `if (pathname === "/api/..." && request.method === "...")` pattern inside the main request handler.
- Rate limiting is applied in-memory (`authRateLimits`, `reportRateLimits`, `clientIdFailures`). Add rate limiting to any new auth or submission endpoints.

### Frontend JS
- Each HTML page loads its own companion `.js` file (e.g. `auth.html` → `auth.js`).
- Shared utilities live in [`script.js`](script.js).
- Auth pages read `data-auth-mode` and `data-auth-role` from `document.body` to configure behaviour without URL params.
- All API calls use `fetch` against `/api/*` endpoints.
- Currency: always format as AUD using `new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })`.

### CSS / Design
- Design language: **dark luxury** — near-black backgrounds, champagne/cream text, gold accents.
- CSS custom properties are defined in [`style.css`](style.css) `:root`. Always use them; never hardcode colour values.
- Key tokens: `--black`, `--cream`, `--gold`, `--muted`, `--champagne`, `--panel`, `--line`, `--luxury-border`, `--luxury-shadow`.
- Page-specific overrides live in dedicated CSS files (e.g. [`creator-dashboard.css`](creator-dashboard.css), [`membership.css`](membership.css), [`pricing.css`](pricing.css)).

### Membership Tiers
Defined in [`membershipData.ts`](membershipData.ts): **Network** ($39/mo), **Select** ($79/mo), **Icon** ($149/mo) + Campaign Credit system.

## ⚠️ Do Not Change Without Explicit Approval

These areas are protected — propose changes and wait for confirmation:

1. **Authentication** — signup, login, session, password reset flows
2. **Verification** — identity/age verification logic
3. **Billing / subscriptions** — Stripe integration, membership tier logic, transaction records
4. **User data schema** — field names and structure of `users` records (now stored as JSONB in Postgres, see Architecture above, but the schema itself is still protected)

## Project Context

See [`TEMPTX_CONTEXT.md`](TEMPTX_CONTEXT.md) for current stage, focus areas, and high-level feature list.

See [`audit/2026-06-23/temptx-full-website-audit.md`](audit/2026-06-23/temptx-full-website-audit.md) for the latest full-site audit.

## Cursor Cloud specific instructions

- `npm start` runs `node server.js`; the app binds to `127.0.0.1:5510` only by default, and `PORT` overrides the port.
- There is no dev/watch server or hot reload. Restart Node after editing `server.js`; static `.html`, `.js`, and `.css` changes load on refresh.
- App data (users, reports, memberships, subscriptions, transactions, bookings, community content, etc.) lives in Postgres — set `DATABASE_URL` in `.env` (see `.env.example`). The server won't boot without it. The gitignored `data/` directory now only holds `server-secret` (session-signing secret); it no longer needs to exist for accounts/reports, and deleting it does not reset them.
- There is no automated test suite or build step. The only routine check is `npm run check`.
- End-to-end signup testing must handle the first-load 18+ modal. Signup requires `acceptedPolicies: true`, and state-changing `/api/*` requests need `Origin: http://127.0.0.1:5510` for CSRF validation.
