# TEMPTX — Agent Instructions

Australia's premium adult industry network. Vanilla HTML/CSS/JS frontend served by a custom Node.js HTTP server. No build step. No framework.

## Dev Commands

```bash
bash scripts/setup.sh  # First-time setup: installs dependencies, creates .env from .env.example
npm start          # Start local server at http://127.0.0.1:5510
npm run check      # Syntax-check every JS file (server, lib/, content/, public/)
```

Node ≥ 18 required. No build or compile step — changes to HTML/CSS/JS are live on next request.

## Architecture

| Layer | Details |
|---|---|
| Frontend | Plain HTML pages + vanilla JS in [`public/`](public/). No bundler, no framework. |
| Backend | Custom HTTP server: [`server.js`](server.js) (API, auth, data) |
| Page layer | [`lib/site/`](lib/site/) — routing, canonical URLs, shared `<head>`, robots.txt, sitemap, server-rendered pages |
| Content | [`content/info-pages.js`](content/info-pages.js) — text of the information pages (About, Safety Hub, Terms, ...) |
| Data | JSON flat files in [`data/`](data/) — `users.json`, `memberships.json`, `subscriptions.json`, `transactions.json`, `reports.json` |
| Auth | Session tokens in a server-side in-memory `Map`. Cookie: `temptx_session`. |
| PWA | [`public/pwa.js`](public/pwa.js) + [`public/sw.js`](public/sw.js) + [`public/manifest.webmanifest`](public/manifest.webmanifest) |

## Pages and URLs

Only files inside `public/` can be requested by a browser. Server code, `data/`, docs and audits live outside it. Never put anything in `public/` that should not be public.

| Kind | URL | Source | Indexed |
|---|---|---|---|
| Public page | `/directory` (`/directory.html` 301s to it) | `public/directory.html` | Yes |
| Information page | `/safety-hub` | an entry in `content/info-pages.js`, rendered by the server | Yes |
| App page (signed-in or form) | `/settings.html` | `public/settings.html`, slug listed in `APP_PAGES` | No |
| City page | `/directory/adelaide` | rendered from `DIRECTORY_OPTIONS.locations` | Only while a real provider lists that city |
| Provider page | `/providers/<name>-<id8>` | `public/profile.html` filled in by the server | Yes |

- **Adding a public page**: create `public/<slug>.html`. It is served at `/<slug>`, gets canonical, Open Graph and breadcrumb tags, and joins the sitemap automatically.
- **Adding an information page**: add an entry to `content/info-pages.js`. No HTML file is needed.
- **Adding an app page**: create the HTML file and add its slug to `APP_PAGES` in [`lib/site/config.js`](lib/site/config.js).
- **Links**: write root-absolute canonical paths — `href="/directory"`, `href="/settings.html"`, `href="/"`. Relative links break on nested routes such as `/directory/adelaide`.
- **Head tags**: each page keeps its own `<title>` and `<meta name="description">`. Do not add canonical, Open Graph, favicon or JSON-LD tags by hand; `lib/site/head.js` adds them to every response.
- **Asset versions**: write `href="/style.css"` and `src="/script.js"` with no `?v=`. The server appends a content hash, so a changed file is picked up on the next load.
- **One `<h1>` per page.** The age gate's wordmark is a `<p class="age-title">`.

## User Roles

- **Client** — books/messages providers
- **Provider / Creator** — lists services, manages profile
- **Business** — friendly businesses listing
- **Admin** — moderation and platform management

Role is stored on the user record and checked server-side on every protected API call.

## Key Conventions

### Server (`server.js`)
- `isPublicProvider` / `publicProviderView` are the single definition of which providers are public. Use them for anything that lists or shows providers.
- **Atomic writes**: always write to `<file>.tmp` then `fs.renameSync` — never write directly.
- **Serial queue** (`makeQueue()`): all read-modify-write operations on a data file must go through that file's queue to prevent race conditions. Do not bypass.
- New API routes follow the existing `if (pathname === "/api/..." && request.method === "...")` pattern inside the main request handler.
- Rate limiting is applied in-memory (`authRateLimits`, `reportRateLimits`, `clientIdFailures`). Add rate limiting to any new auth or submission endpoints.

### Frontend JS
- Each HTML page loads its own companion `.js` file (e.g. `auth.html` → `auth.js`).
- Shared utilities live in [`public/script.js`](public/script.js).
- Auth pages read `data-auth-mode` and `data-auth-role` from `document.body` to configure behaviour without URL params.
- All API calls use `fetch` against `/api/*` endpoints.
- Currency: always format as AUD using `new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })`.

### CSS / Design
- Design language: **dark luxury** — near-black backgrounds, champagne/cream text, gold accents.
- CSS custom properties are defined in [`public/style.css`](public/style.css) `:root`. Always use them; never hardcode colour values.
- Key tokens: `--black`, `--cream`, `--gold`, `--muted`, `--champagne`, `--panel`, `--line`, `--luxury-border`, `--luxury-shadow`.
- Page-specific overrides live in dedicated CSS files (e.g. [`public/creator-dashboard.css`](public/creator-dashboard.css), [`public/membership.css`](public/membership.css), [`public/pricing.css`](public/pricing.css)).

### Membership Tiers
Defined in [`membershipData.ts`](membershipData.ts): **Network** ($39/mo), **Select** ($79/mo), **Icon** ($149/mo) + Campaign Credit system.

## ⚠️ Do Not Change Without Explicit Approval

These areas are protected — propose changes and wait for confirmation:

1. **Authentication** — signup, login, session, password reset flows
2. **Verification** — identity/age verification logic
3. **Billing / subscriptions** — Stripe integration, membership tier logic, transaction records
4. **User data schema** — field names and structure in `users.json`

## Project Context

See [`TEMPTX_CONTEXT.md`](TEMPTX_CONTEXT.md) for current stage, focus areas, and high-level feature list.

See [`audit/2026-06-23/temptx-full-website-audit.md`](audit/2026-06-23/temptx-full-website-audit.md) for the latest full-site audit.

## Cursor Cloud specific instructions

- `npm start` runs `node server.js`; the app binds to `127.0.0.1:5510` only by default, and `PORT` overrides the port.
- There is no dev/watch server or hot reload. Restart Node after editing `server.js`, `lib/` or `content/`; files in `public/` load on refresh.
- The gitignored `data/` directory is auto-created on first boot. It also stores `server-secret`; deleting `data/` resets local accounts and reports.
- There is no automated test suite or build step. The only routine check is `npm run check`.
- End-to-end signup testing must handle the first-load 18+ modal. Signup requires `acceptedPolicies: true`, and state-changing `/api/*` requests need `Origin: http://127.0.0.1:5510` for CSRF validation.
