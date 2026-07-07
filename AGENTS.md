# TEMPTX — Agent Instructions

Australia's premium adult industry network. Vanilla HTML/CSS/JS frontend served by a custom Node.js HTTP server. No build step. No framework.

## Dev Commands

```bash
npm start          # Start local server at http://127.0.0.1:5510
npm run check      # Syntax-check all JS files (node --check)
```

Node ≥ 18 required. No build or compile step — changes to HTML/CSS/JS are live on next request.

## Architecture

| Layer | Details |
|---|---|
| Frontend | Plain HTML pages + vanilla JS. No bundler, no framework. |
| Backend | Single-file custom HTTP server: [`server.js`](server.js) |
| Data | JSON flat files in [`data/`](data/) — `users.json`, `memberships.json`, `subscriptions.json`, `transactions.json`, `reports.json` |
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
- **Atomic writes**: always write to `<file>.tmp` then `fs.renameSync` — never write directly.
- **Serial queue** (`makeQueue()`): all read-modify-write operations on a data file must go through that file's queue to prevent race conditions. Do not bypass.
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
4. **User data schema** — field names and structure in `users.json`

## Project Context

See [`TEMPTX_CONTEXT.md`](TEMPTX_CONTEXT.md) for current stage, focus areas, and high-level feature list.

See [`audit/2026-06-23/temptx-full-website-audit.md`](audit/2026-06-23/temptx-full-website-audit.md) for the latest full-site audit.
