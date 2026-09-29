# TemptX Full Website Product Audit

Date: 29 September 2026
Status: Audit only — no website behavior changed. (One incidental cleanup: a test API call made during this audit wrote a throwaway record to `data/reports.json`; it has been removed and is noted under Evidence limits.)

## Audit scope

This is a re-run of the 23 June 2026 audit (`audit/2026-06-23/temptx-full-website-audit.md`), three months later. **Method differs from the June audit**: no browser-automation tool was available in this session, so no screenshots were captured and no rendered/visual verification was possible. Instead, this audit is a **source-code-based review** — reading every relevant HTML/CSS/JS file and the `server.js` route handlers directly, checking each specific June finding against the current implementation, spot-checking with live `curl` calls against the running local server, and inferring layout/responsive behavior from CSS media queries and structure rather than from rendered pages.

Four areas were reviewed in depth: (1) trust & safety flows (report/block/moderation), (2) legal/policy pages and verification claims, (3) authentication security hardening, (4) mobile CSS/accessibility, and (5) simulated features, pricing, and directory behavior. Every P0–P2 item from the June report was checked individually; items are tagged **FIXED**, **PARTIALLY FIXED**, **STILL BROKEN**, **NEW ISSUE**, **ACCEPTED-DESIGN** (matches AGENTS.md's documented architecture, not a defect), or **COULD NOT VERIFY STATICALLY**.

The net result: **TemptX has made substantial, real progress since June** — most of the P0 launch blockers are now genuinely fixed at the code level, not just relabeled. The remaining gaps are narrower but still real, and one new structural issue (conflicting pricing across four pages) emerged that didn't exist in June.

## Executive assessment

The June audit's central risk — a site presenting prototype features as if they were operational — has been meaningfully addressed. Reporting, blacklist/moderation intake, terms/privacy, signup consent, mobile navigation, mobile layout overflow, rate limiting, cookie/CSRF/security headers, and the account dropdown overflow bug are all now backed by real, verified server-side code, not just relabeled UI. The biggest remaining risks are narrower and more specific: (1) password reset tokens are still returned directly in the API response instead of an out-of-band channel, (2) core engagement features — messaging, favourites, groups, tips — are still 100% localStorage with a real backend (`/api/community/*`) sitting unused right next to them, (3) four different pricing pages now show four different, mutually contradictory price schemes for overlapping audiences, and (4) low-contrast small text and a missing skip link remain unaddressed accessibility gaps. The recommended posture: finish wiring the already-built community/messaging backend to the chat UI, reconcile pricing into one source of truth, fix the reset-token delivery, and do a focused type-scale/contrast pass — all narrower, more tractable work than June's blockers, and no longer a "is this real or fake" trust problem so much as a "finish connecting what's already built" problem.

## Top issues

### P0 — Launch blockers

1. **Password reset codes still returned directly to the browser** (STILL BROKEN, partially mitigated). `/api/auth/forgot` (`server.js:2995-3026`) still puts `resetToken` in the JSON response body rather than sending it out-of-band via email/SMS — `sendEmail`/`sendSms` are wired only to signup verification OTPs, never to password reset. A new mitigation exists: the endpoint now also requires a `recoveryCode` set at signup to match before issuing a token (`server.js:3009-3020`), so the attack surface is narrower than June, but the underlying finding — a password-reset credential is handed to whoever is calling the API rather than delivered to a channel only the account owner controls — is unchanged.

2. **Core engagement features remain 100% simulated, unlike the backend they sit next to** (STILL BROKEN, more notable now than in June). Messaging, group creation/joining, favourites, and tips are still entirely `localStorage`-backed in `chat.js` (state key `temptxChatState`, e.g. lines 108-122, 237-239, 410-432, 492-511, 552-619) — no network call ever sends a message, tip, favourite, or group action to the server. What's new and important: `server.js` **already defines** real, working `/api/community/threads`, `/api/community/groups`, `/api/community/follows`, and `/api/community/saved` routes that `chat.js` never calls. This is no longer "the feature doesn't exist" (June's framing) — it's "the feature exists on the server and the frontend was never connected to it," which is a much smaller and more urgent fix than building it from scratch.

3. **Directory demo cards still route to a placeholder profile** (PARTIALLY FIXED). Real, API-sourced directory cards (via `/api/directory/providers`, backed by real `data/users.json` records) now link to distinct per-provider profile URLs. But the six hardcoded demo cards baked directly into `directory.html` (marked `data-demo="true"`) still link to a bare `profile.html` with no id — the exact June behavior — and these are what render whenever the API returns zero live providers, which is likely to be most visitors' actual experience pre-launch.

4. **Public "Verified" badges are still decorative, now alongside a real (but unconnected) verification system** (STILL BROKEN for the public-facing badge specifically). A genuine trust-level system now exists server-side (`computeTrustLevel`, `server.js:466-476`, backed by real email/phone OTP verification and exposed with dates via `verification-centre.html`) — this is a real fix for the *account owner's own* verification view. But the "Verified" badges shown on `directory.html` cards are static demo markup with no link, date, or criteria attached, i.e. the same unexplained-badge problem June flagged, just now coexisting with backend machinery it isn't drawing from.

### P1 — High-priority product and UX issues

5. **Pricing is now real but internally contradictory across four pages** (NEW ISSUE — did not exist in June, where the problem was no pricing at all). `membership.html` correctly reflects `membershipData.ts`: Network $39/mo, Select $79/mo, Icon $149/mo, plus Campaign Credit packs. But `pricing.html` — reached via a different nav path ("Advertising") — shows an entirely different, non-matching tier structure for the same provider audience: Directory $29/mo, Featured $79/mo, Network $149/mo (reusing the name "Network" for a different price point than membership.html's $39 tier). `client-pricing.html` and `creator-pricing.html` each define two more independent schemes on top of that. None of `pricing.html`/`client-pricing.html`/`creator-pricing.html` state cancellation terms, and the "Billed yearly" toggle on `pricing.html` has no JS handler at all — it's decorative and never changes the displayed price. This is now a bigger conversion risk than June's "no prices" gap, because a prospective provider who sees two different prices for the same tier name will trust neither.

6. **Blocking is honestly labeled but still unbuilt** (PARTIALLY FIXED). June's false claim ("Block and report available" with no workflow) is gone — `chat.html` now correctly reads "Reporting available · Blocking in development." Reporting itself is now fully real (verified live via `curl` against `/api/reports`, which persists to `data/reports.json` with a reference and access code). Blocking has no server route yet.

7. **CSRF check has a silent bypass path** (NEW ISSUE, minor). The Origin-header CSRF check on state-changing `/api/*` routes (`server.js:3999-4012`) only validates when an `Origin` header is present; a request with no `Origin` header at all skips validation entirely, with no Referer fallback. Not trivially exploitable from a standard browser (normal cross-origin fetches/form posts do send Origin), but it's a real gap against "robust," worth closing before this hardening work is called done.

8. **Directory lacks an accessibility filter and loading state** (PARTIALLY FIXED from June's "no filters" finding). Result counts, sorting, availability/verified/service-type/price-range filters, and a wired no-results empty state all now exist and work (`directory.js`). Still missing: an accessibility-need filter (not present at all, vs. "touring" which exists only as an attribute value, not its own filter), and any loading/skeleton state during the async provider fetch — cards simply pop in with no "Loading…" indicator.

9. **Hardcoded colors outside the design-token system persist** (STILL BROKEN, consistent with June's "visual system feels over-treated" note but now quantified). `style.css` has roughly 108 hardcoded hex colors outside `:root`, in violation of AGENTS.md's rule to always use `--black`/`--cream`/`--gold`/etc. tokens. This directly compounds the contrast issue below, since colors set outside the token system don't get swept up in a future contrast/theme pass.

### P2 — Accessibility, clarity, and growth issues

10. **Small, low-contrast text is still widespread** (STILL BROKEN, unchanged from June). 205 occurrences of 0.5rem–0.78rem font sizes remain in `style.css`, and several combine small size with low-alpha `--cream` text on exactly the kind of surfaces June flagged as risky — e.g. `.dir-card-location` (0.72rem, 52% opacity), `.auth-nav-hint` (0.72rem, 45% opacity), mobile directory-card text down to 0.5rem. No evidence of any size/contrast remediation pass since June.

11. **No skip link exists anywhere in the codebase** (STILL BROKEN, unchanged from June). Checked across all HTML pages including `index.html`; no skip-to-content mechanism was found.

12. **Modal focus is not trapped or returned** (PARTIALLY FIXED). The recovery modal on `auth.html` gained proper ARIA (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) since June — a real improvement. But `auth.js` still only toggles visibility on open/close: no focus is moved into the modal on open, no Tab-key containment, no Escape handler, and no focus returned to the trigger button on close.

13. **Focus-visible styling is now genuinely strong** (FIXED — flagging as a positive so it isn't lost in a future pass). Over 100 `:focus-visible` rules now exist across the site with a consistent `--focus-outline` treatment on nav, dropdowns, buttons, inputs, and cards. This is a real, non-trivial improvement over June's "inconsistent" finding and should be protected in any future CSS refactor.

14. **SEO/metadata thinness was not re-checked this round** — carried over from June as unverified in this pass; see Evidence limits.

## Strengths to preserve

- The atomic-write + serial-queue discipline AGENTS.md documents is followed consistently in practice, not just on paper — every `data/*.json` read-modify-write site checked goes through `makeQueue()` and `atomicWrite` (`.tmp` + `renameSync`). No race-condition risk was found.
- Rate limiting is now real and sensibly tuned (login 10/15min, signup/forgot/reset 5/hr, report submissions 20/hr, blacklist reports 3/hr), not dead code sitting unused as it was in June.
- Cookie security (`HttpOnly`, `SameSite=Strict`, `Secure` in production) and a full set of response security headers (CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) are in place — a genuine hardening pass happened here.
- The mobile hamburger nav and account-dropdown overflow fix are both real, deliberate fixes with dedicated CSS/JS, not accidental side effects — including an explicit code comment on the password-toggle fix documenting the bug it prevents.
- The report/blacklist/moderation pipeline is a real, thought-through system: rate-limited intake, hashed access codes, status lookup, an explicit AU emergency-services carve-out ("call 000"), and a documented six-step moderation process — this is launch-credible, not decorative.
- Terms/Privacy content is substantive and AU-specific (ABN, ACL, Notifiable Data Breaches, OAIC complaint path), not filler.
- Calm, non-exploitative tone and clear client/provider account separation, both noted in June, remain intact.

## What to fix first

### Phase 1 — Close the remaining trust gaps (small, specific fixes)
1. Move password-reset token delivery out of the API response body and into an out-of-band channel (email/SMS), reusing the existing `sendEmail`/`sendSms` plumbing already built for signup OTPs.
2. Add a Referer-header fallback (or reject requests with no Origin) to close the CSRF bypass gap.
3. Attach real criteria/date/link to the public "Verified" badges on directory cards, drawing from the trust-level data that already exists server-side — this is a wiring fix, not new backend work.
4. Give the six demo directory cards real per-item links (or hide them entirely once live provider count is nonzero) so no visitor path still dead-ends at a placeholder profile.

### Phase 2 — Connect existing backend to existing frontend
1. Point `chat.js` at the already-built `/api/community/threads`, `/api/community/groups`, `/api/community/follows`, `/api/community/saved` routes instead of `localStorage`, for messaging, groups, and favourites.
2. Decide tips' real path (a genuine payment integration vs. explicitly relabeling as a non-monetary gesture) rather than leaving it silently fake.
3. Wire the home interest form to a real `/api/*` endpoint instead of a local-only reset.

### Phase 3 — Reconcile pricing into one source of truth
1. Pick a single canonical pricing model (`membershipData.ts`'s Network/Select/Icon $39/$79/$149 is the one AGENTS.md documents) and make `pricing.html`, `client-pricing.html`, and `creator-pricing.html` either reflect it or be retired/merged.
2. Wire the "Billed yearly" toggle to actually change displayed prices, or remove it.
3. Add cancellation terms to every pricing surface, matching what `membership.html` already has.

### Phase 4 — Accessibility and visual polish
1. Add a skip-to-content link.
2. Do a font-size/contrast pass on the ~205 sub-0.8rem, reduced-opacity text instances, prioritizing safety/nav/form-guidance surfaces.
3. Add focus trapping + focus return to the recovery modal (and any future modals).
4. Sweep the ~108 hardcoded hex colors in `style.css` into the existing CSS custom-property tokens.
5. Add an accessibility-need directory filter and a loading state for the async provider fetch.

## Feature ideas worth adding

- **Directory**: a loading/skeleton state for the provider fetch; an accessibility-need filter; a clear "showing demo listings" label if live provider count is ever zero, so demo cards stop being indistinguishable from real ones.
- **Trust/verification**: surface verification date/expiry directly on provider cards (not just the owner's own verification-centre view), since that's the audience the badge is actually meant to reassure.
- **Pricing**: a single comparison table across client/provider/business tiers in one place, since prospective users currently have no way to see all plans side by side even once the contradiction above is fixed.
- **Messaging**: once wired to the real backend, a "message request" or first-contact flow, since currently nothing gates who a client can message.

## Simple implementation plan

- **Sprint 1**: Reset-token delivery fix; CSRF Referer fallback; verified-badge wiring; demo-card link fix. (All Phase 1 — narrow, well-scoped, no new backend needed.)
- **Sprint 2**: Wire `chat.js` to `/api/community/*` for messages/groups/favourites; decide and implement tips' real path; wire home interest form.
- **Sprint 3**: Pricing reconciliation across all four pricing pages; yearly-toggle wiring; cancellation terms.
- **Sprint 4**: Skip link; contrast/font-size pass; modal focus trap/return; hardcoded-color sweep; directory accessibility filter + loading state.

## Captured flow steps

No screenshots were captured this round (no browser-automation tool available in this session — see Evidence limits). In place of visual flow steps, each area below reflects a direct source-code read plus, where noted, a live `curl` check against the running local server:

1. **Report a profile** (`report.html` → `/api/reports`) — Good. Verified live: POST returns a real reference + access code and persists to `data/reports.json`.
2. **Blacklist a provider** (`blacklist.html` → `/api/blacklist/reports`) — Good. Session-gated, rate-limited, real persistence.
3. **Moderation process page** (`moderation.html`) — Good. Real 6-step process content, explicit emergency-services carve-out.
4. **Terms / Privacy** (`terms.html`, `privacy.html`) — Good. Substantive AU-specific content, linked from footer and age gate.
5. **Signup consent** (`auth.html`, `client-signup.html` → `server.js` signup handler) — Good. Checkbox required client-side and enforced server-side (`400` if missing).
6. **Password reset** (`auth.html` → `/api/auth/forgot`) — Needs improvement. Requires a recovery code now, but still returns the reset token directly in the response.
7. **Directory browse** (`directory.html`/`directory.js` → `/api/directory/providers`) — Mixed. Real data path works; demo-card fallback still dead-ends.
8. **Verified badge** (directory cards) — Needs improvement. Still decorative on the public-facing card, despite real backend trust-level data existing.
9. **Chat / messaging** (`chat.html`/`chat.js`) — Broken. Entirely localStorage; real backend routes exist unused.
10. **Membership pricing** (`membership.html`) — Good. Matches documented tiers exactly.
11. **Advertising pricing** (`pricing.html`) — Broken. Contradicts `membership.html` for the same audience.
12. **Mobile account dropdown at narrow width** — Good (inferred from CSS, not visually confirmed). Explicit `max-width`/`min-width:0` override exists for narrow viewports.
13. **Mobile nav below 900px** — Good (inferred from CSS/JS, not visually confirmed). Hamburger toggle exists and is wired with scroll-lock and Escape handling.
14. **Recovery modal keyboard behavior** — Needs improvement. ARIA roles present; no focus trap or return.

## Comparison to previous audit (23 June 2026)

**Fixed since June:**
- Report/block/moderation flows — now real (report + blacklist genuinely work; blocking is honestly labeled as unbuilt rather than falsely claimed).
- Terms/Privacy pages — now exist with real content, linked from footer, age gate, and enforced at signup.
- Rate limiting — now genuinely applied across auth and report endpoints with sane limits.
- Cookie security, CSRF (Origin check), and security headers — now implemented, with one residual gap (item 7 above).
- Mobile account-dropdown overflow at 390px — fixed with explicit narrow-viewport CSS.
- Mobile navigation disappearing below 820px — fixed with a working hamburger menu.
- Password-toggle/input collision on mobile auth — fixed with explicit spacing rules.
- Focus-visible styling — went from "inconsistent" to genuinely comprehensive.
- Directory search — now pulls from real API/data instead of a small hardcoded array (mostly; demo-card fallback remains).
- Pricing — went from "no prices at all" to real prices on `membership.html` specifically.
- Account-level verification — a real trust-level/OTP system now exists and is shown to the account owner with dates.

**Still open from June:**
- Password reset token still delivered directly to the browser (narrower than June, but same core issue).
- Messages/favourites/groups/tips still entirely simulated (localStorage), unchanged.
- Small, low-contrast text — unchanged, same scale of issue (205 instances).
- No skip link — unchanged.
- Hardcoded colors outside the token system — unchanged/quantified.

**Newly broken/discovered since June:**
- Four pricing pages (`pricing.html`, `client-pricing.html`, `creator-pricing.html`, `membership.html`) now show four different, contradictory price schemes — this specific conflict didn't exist in June because there was no real pricing anywhere to conflict.
- Public "Verified" badges remain decorative *despite* a real backend verification system now existing right next to them — a wiring gap that's newly visible now that the backend half is done.
- A CSRF bypass path for requests with no Origin header (minor, likely low real-world exploitability, but worth closing).

## Evidence limits

- **No screenshots, no visual/rendered verification.** This entire audit was performed by reading source code (HTML/CSS/JS/server.js) and, where noted, live `curl` calls against the running local server — not by viewing rendered pages in a browser. Every "FIXED" verdict on layout/responsive behavior (mobile nav, dropdown overflow, password-toggle spacing) is an inference from CSS media queries and structure, explicitly flagged as such above, and should be visually confirmed the next time browser tooling is available.
- **SEO/metadata (June finding #16) was not re-checked this round** — carried over as unverified, not re-confirmed broken or fixed.
- **No form submissions, payments, or account deletion were tested end-to-end.** One report-submission API call was made live to verify the reporting pipeline works; the resulting test record was removed from `data/reports.json` after confirming the flow.
- **No credentialed testing** (e.g. actually completing signup/verification/reset flows as a real user, testing the age gate interactively) was performed — findings on these flows are based on reading the client/server code paths, not exercising them end-to-end as a user would.
- **Backend/infra** (deployment config, production environment variables, actual email/SMS delivery behavior in production) was not assessed — only what the code does when called locally.
