# TEMPTX — Verification & Trust System

**Design Specification**

| | |
|---|---|
| **Status** | Draft for implementation — Phase 1 in progress, Phases 2–4 specified |
| **Owner** | TEMPTX Platform |
| **Applies to** | `server.js`, `data/users.json`, `data/verificationEvents.json`, Verification Centre pages, `style.css` |
| **Last revised** | 2026-08-01 |

> ⚠️ **Protected areas.** [`AGENTS.md`](../AGENTS.md) lists **Authentication**, **Verification**, **Billing/subscriptions**, and **User data schema** as areas that must not change without explicit approval. Everything in this document touches at least two of them. This spec is a *proposal and reference*; each phase requires sign-off before code lands.

---

## Table of contents

- [1. Introduction](#1-introduction)
  - [1.1 Goals](#11-goals)
  - [1.2 Non-goals](#12-non-goals)
  - [1.3 Design principles](#13-design-principles)
- [2. System overview](#2-system-overview)
  - [2.1 Architecture context](#21-architecture-context)
  - [2.2 File map](#22-file-map)
  - [2.3 Inherited conventions](#23-inherited-conventions)
- [3. Shared foundations](#3-shared-foundations)
  - [3.1 The `user.verification` object](#31-the-userverification-object)
  - [3.2 Channel status state machine](#32-channel-status-state-machine)
  - [3.3 `data/verificationEvents.json`](#33-dataverificationeventsjson)
  - [3.4 API conventions and the rate-limit table](#34-api-conventions-and-the-rate-limit-table)
  - [3.5 Design tokens and shared components](#35-design-tokens-and-shared-components)
  - [3.6 Cross-cutting security model](#36-cross-cutting-security-model)
- [4. Subsystems](#4-subsystems)
  - [4.1 Verification Centre dashboard](#41-verification-centre-dashboard)
  - [4.2 Verification progress tracker](#42-verification-progress-tracker)
  - [4.3 Trust Passport](#43-trust-passport)
  - [4.4 Trust Level system](#44-trust-level-system)
  - [4.5 Email verification (Phase 1, as-built)](#45-email-verification-phase-1-as-built)
  - [4.6 Phone verification (Phase 1, as-built)](#46-phone-verification-phase-1-as-built)
  - [4.7 Age verification](#47-age-verification)
  - [4.8 Identity verification (KYC vendor)](#48-identity-verification-kyc-vendor)
  - [4.9 Face matching](#49-face-matching)
  - [4.10 Provider / Creator verification](#410-provider--creator-verification)
  - [4.11 Business verification](#411-business-verification)
  - [4.12 Verification history](#412-verification-history)
  - [4.13 Live verification status tracking](#413-live-verification-status-tracking)
  - [4.14 Verification expiry management](#414-verification-expiry-management)
  - [4.15 Reverification workflows](#415-reverification-workflows)
  - [4.16 Suspicious activity detection](#416-suspicious-activity-detection)
  - [4.17 Public Trust Profile](#417-public-trust-profile)
  - [4.18 Staff moderation and review tools](#418-staff-moderation-and-review-tools)
  - [4.19 Manual review queues](#419-manual-review-queues)
  - [4.20 Verification notifications](#420-verification-notifications)
  - [4.21 User settings for verification](#421-user-settings-for-verification)
- [5. Scalability and migration path](#5-scalability-and-migration-path)
- [6. Phased rollout](#6-phased-rollout)
- [Appendix A — Route index](#appendix-a--route-index)
- [Appendix B — Event taxonomy](#appendix-b--event-taxonomy)
- [Appendix C — Glossary](#appendix-c--glossary)

---

## 1. Introduction

TEMPTX is an adult-industry network. Trust is the product. A client deciding whether to message a provider, a provider deciding whether to accept a booking, and a business deciding whether to list alongside a creator are all making a safety judgement with very little information. The Verification & Trust System is the machinery that turns scattered signals — a confirmed email, a confirmed phone, a government ID checked by a specialist vendor, an ABN that resolves to a real entity — into one legible, honest, hard-to-fake signal.

It is also the machinery that must *not* turn TEMPTX into a honeypot. Adult-industry workers are among the most doxxing-exposed people on the internet. A verification system that hoards passport scans in a flat JSON file on a single VPS is worse than no verification system at all. Everything below is shaped by that tension.

### 1.1 Goals

1. **A single, legible trust signal.** One integer (`trustLevel`) with a stable public meaning, derived from auditable underlying facts — never hand-set, never guessed.
2. **Fraud and harm reduction.** Raise the cost of creating throwaway accounts, catfishing, and scam listings. Give the safety team evidence to act on.
3. **Progressive, voluntary escalation.** A client should be able to use TEMPTX at Trust Level 0. Each further step buys the user something concrete (reach, payouts, badge, filter placement), and is a choice, not a wall.
4. **Minimal data custody.** TEMPTX stores verification *outcomes*, not verification *evidence*. Documents, selfies, and raw DOBs stay with the KYC vendor.
5. **Auditability.** Every status transition is written to an append-only log with enough context to reconstruct "why is this account Level 3?" months later.
6. **Premium feel.** Verification is a conversion funnel. It should feel like a concierge desk, not a customs queue — consistent with the dark-luxury language in [`style.css`](../style.css).

### 1.2 Non-goals

- **No in-house document forensics or face-matching.** Firm product decision. TEMPTX will never run OCR on an ID, never run a liveness model, never hold a template of anyone's face. This is delegated to a pluggable third-party KYC vendor (Stripe Identity / Onfido / Persona class). Not open for reconsideration in this spec.
- **Not a replacement for the age gate.** The existing self-attestation modal in [`script.js`](../script.js) (`#ageGate`, `localStorage.temptxAgeConfirmed`) stays as the site-wide legal gate. Real age verification (§4.7) is an additional, account-level assurance for a subset of users.
- **Not a reputation or review system.** Trust Level measures *identity assurance*, not conduct quality. Conduct lives in `reportsCount` / `riskScore` / the reports pipeline and only ever *suppresses* trust, never inflates it.
- **Not a background check.** No criminal record checks, no sanctions screening beyond whatever the vendor performs as part of its own KYC product.
- **Not a database migration.** This spec stays inside the flat-JSON + `makeQueue()` architecture. §5 records what would have to change if TEMPTX outgrows it, deliberately without prescribing that change now.
- **Phase 1 does not wire the directory badge.** The `✓ Verified` mark rendered on every card in [`directory.js`](../directory.js) (`dir-card-verified-mark`, around the `card.innerHTML` template) is currently hardcoded on *all* providers and is **still fake**. Connecting it to real trust data is a deliberate follow-up (§4.17), not something Phase 1 delivers.

### 1.3 Design principles

| Principle | What it means in practice |
|---|---|
| **Privacy by default** | Nothing about a user's verification state is public unless they opt in. Public surfaces show a tier label and a set of checkmarks — never an address, never a phone number, never a date of birth, never a document number. |
| **Minimal data custody** | If TEMPTX can function with a hash, store the hash. If it can function with a boolean, store the boolean. Raw PII entering the system needs a named justification in this document. |
| **Derived, never asserted** | `trustLevel` is a *pure function* of channel statuses. There is no endpoint that sets it directly. Recompute-on-read is always safe. |
| **Fail closed, degrade gracefully** | Vendor down → channel stays `pending`, user sees an honest "we're waiting on our verification partner" state. Never auto-promote on ambiguity. |
| **Honest UI** | Never render a verified badge that isn't backed by data (this is the exact sin the current directory card commits). A missing signal is shown as absent, not hidden. |
| **Reversible** | Every granted status can be expired, revoked, or downgraded. The audit log makes downgrades explicable. |
| **Premium feel** | Gold-gradient progress, glassmorphism panels, `--ease-luxury` motion, serif headings. Verification steps are framed as *unlocks*, not *demands*. |

---

## 2. System overview

### 2.1 Architecture context

TEMPTX is deliberately small-tech: plain HTML pages each with a companion `.js`, one custom Node HTTP server ([`server.js`](../server.js), ~74 KB, no framework), and JSON flat files under `data/`. There is no build step, no ORM, no migration tool, no test suite — `npm run check` (`node --check` over the JS files) is the only routine gate.

The verification system therefore has to be **boring and self-contained**: in-memory `Map`s for ephemeral state, `makeQueue()` for anything that writes, `atomicWrite()` for every file write, and route handlers that are just more `if (pathname === … && request.method === …)` branches inside `handleApi`.

```
Browser                          server.js                        data/
────────                         ─────────                        ─────
verification-centre.html   ──▶   handleApi()                      users.json
verification-centre.js           ├─ /api/verification/status  ──▶  (user.verification,
                                 ├─ /api/verification/email/*      user.trustLevel)
                                 ├─ /api/verification/phone/*
trust.html (public)        ──▶   ├─ /api/trust/:ref            ──▶ verificationEvents.json
trust.js                         ├─ /api/verification/history        (append-only)
                                 └─ /api/verification/webhooks/kyc
                                        ▲
KYC vendor (hosted flow) ───────────────┘  signed webhook
```

### 2.2 File map

| Path | Phase | Role |
|---|---|---|
| [`server.js`](../server.js) | 1+ | All routes, OTP `Map`s, trust computation, event appending. |
| `data/users.json` | 1+ | `user.verification`, `user.trustLevel`, `user.trustLevelUpdatedAt`. |
| `data/verificationEvents.json` | 1+ | Append-only audit log. |
| `verification-centre.html` / `.js` | 1+ | The authenticated dashboard. **New page** — must not collide with the existing [`verification.html`](../verification.html), which is a marketing/info page driven by [`info-page.js`](../info-page.js) via `data-info-page="verification"`. |
| [`style.css`](../style.css) | 1+ | New `.verification-*` block; reuses the `.setup-checklist-*` block (currently around line 7723, "Setup checklist (provider profile edit page + creator dashboard)"). |
| `notifications.js` (server-side module or inline section of `server.js`) | 1 stub → 4 real | Delivery abstraction. Phase 1 logs to console. |
| `trust.html` / `trust.js` | 4 | Public Trust Passport page. |
| `admin-verification.html` / `.js` | 3 | Staff review queue. Spec-only until an `admin` role exists. |
| [`directory.js`](../directory.js) | 4 | Where the fake `dir-card-verified-mark` gets replaced with real tier data. |
| [`creator-dashboard.js`](../creator-dashboard.js), [`provider-profile.html`](../provider-profile.html) | 2+ | Existing `setup-checklist` consumers; the `verification` checklist row currently hardcodes `status: "not-started"` and gets wired to real data. |

### 2.3 Inherited conventions

Every rule below is already established in the codebase and is **binding** on this system.

- **Atomic writes.** All writes go through `atomicWrite(filePath, data)` — write `<file>.tmp`, then `fs.renameSync`. Never `fs.writeFileSync` straight to a live data file.
- **Serial write queues.** `usersQueue` and `reportsQueue` are `makeQueue()` instances. Every read-modify-write on `users.json` goes through `usersQueue`. `verificationEvents.json` gets its own `verificationEventsQueue = makeQueue()`, mirroring `reportsQueue`. Do not bypass, do not share a queue across files, do not `await` one queue from inside another (deadlock).
- **Route shape.** `if (pathname === "/api/verification/status" && request.method === "GET") { … }` inside `handleApi`, returning via the `json(response, status, payload, headers)` helper (which already sets `no-store`, `nosniff`, `X-Frame-Options: DENY`, etc.).
- **Rate limiting.** New auth-adjacent endpoints use `requireAuthRateLimit(request, response, action, identifier)`; new `action` keys are added to its internal `limits` table. Non-auth read endpoints may use `rateLimit(store, key, limit, windowMs)` directly with a dedicated `Map`.
- **CSRF.** State-changing `/api/*` requests are already origin-checked against `${url.protocol}//${url.host}`. All `POST`/`PATCH` verification routes inherit this. The KYC webhook is the one documented exception (§4.8) and substitutes HMAC signature verification.
- **Hashing.** `hashPrivateValue(value)` = `HMAC-SHA256(serverSecret, value)`. Used today for IPs, recovery codes, device tokens, report access codes. Used here for `ipHash` and OTP codes.
- **Sessions.** In-memory `Map`, cookie `temptx_session`, 7-day expiry, resolved by `requireSession(request)`; role checks via `requireRole(request, role, user)`.
- **Input hygiene.** `cleanText(value, maxLength)` strips NULs and trims; `normaliseEmail`, `validEmail`, `normaliseAbn` already exist and must be reused rather than re-implemented.
- **Currency.** Any AUD amount rendered (e.g. vendor cost surfaced to staff) uses `new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })`.
- **Colour.** No hardcoded hex anywhere. Only `:root` custom properties from `style.css`.

---

## 3. Shared foundations

### 3.1 The `user.verification` object

Phase 1 introduces two channels. The object is designed so that Phases 2–4 add sibling keys without reshaping anything.

**Phase 1 shape (as-built):**

```json
{
  "id": "b9329c3c-106d-4640-8dd2-e908dc6d39e9",
  "role": "provider",
  "verification": {
    "email": {
      "status": "verified",
      "address": "hopexbell@gmail.com",
      "verifiedAt": "2026-07-30T04:11:22.019Z",
      "lastSentAt": "2026-07-30T04:09:58.402Z"
    },
    "phone": {
      "status": "unverified",
      "e164": null,
      "verifiedAt": null,
      "lastSentAt": null
    }
  },
  "trustLevel": 1,
  "trustLevelUpdatedAt": "2026-07-30T04:11:22.019Z"
}
```

**Full target shape (Phase 4), showing every reserved key:**

```json
{
  "verification": {
    "email":   { "status": "verified",   "address": "…", "verifiedAt": "…", "lastSentAt": "…" },
    "phone":   { "status": "verified",   "e164": "+61…", "verifiedAt": "…", "lastSentAt": "…" },

    "identity": {
      "status": "verified",
      "provider": "stripe_identity",
      "sessionRef": "vs_1P…",
      "verifiedAt": "2026-08-14T02:00:00.000Z",
      "expiresAt": "2028-08-14T02:00:00.000Z",
      "lastStartedAt": "2026-08-14T01:41:00.000Z",
      "attempts": 1,
      "documentType": "passport",
      "documentCountry": "AU",
      "nameMatchesAccount": true,
      "failureCode": null
    },

    "age": {
      "status": "verified",
      "source": "identity",
      "isOver18": true,
      "ageBracket": "25-34",
      "verifiedAt": "2026-08-14T02:00:00.000Z",
      "expiresAt": null
    },

    "faceMatch": {
      "status": "verified",
      "provider": "stripe_identity",
      "sessionRef": "vs_1P…",
      "verifiedAt": "2026-08-14T02:00:00.000Z",
      "expiresAt": "2027-08-14T02:00:00.000Z",
      "livenessPassed": true,
      "failureCode": null
    },

    "business": {
      "status": "verified",
      "abnStatus": "active",
      "abnCheckedAt": "2026-08-02T00:00:00.000Z",
      "entityNameMatchesAccount": true,
      "documentsReviewedAt": "2026-08-05T00:00:00.000Z",
      "reviewedBy": "staff:4f2a…",
      "expiresAt": "2027-08-05T00:00:00.000Z"
    },

    "flags": {
      "manualReview": false,
      "reviewReason": null,
      "reviewOpenedAt": null,
      "suspendedChannels": []
    },

    "settings": {
      "passportVisibility": "public",
      "showTierBadge": true,
      "showChannelDetail": true,
      "showVerifiedSince": true,
      "allowDirectoryTrustFilter": true
    }
  },
  "trustLevel": 4,
  "trustLevelUpdatedAt": "2026-08-14T02:00:00.001Z",
  "trustLevelHighWaterMark": 4
}
```

**Field rules**

- **Never store**: document images, document numbers, full date of birth, selfie images, face templates, vendor-side PII payloads. `age.isOver18` + `age.ageBracket` is the *maximum* age detail permitted (§4.7).
- `documentType` / `documentCountry` are kept only because staff need them to answer "which ID did this person use?" during a dispute. They are low-entropy and non-identifying on their own. If that justification ever stops holding, drop them.
- `sessionRef` is a **vendor-side opaque handle**, not a document reference. It is the only pointer TEMPTX keeps into vendor custody, and it is what a right-to-be-forgotten request uses to instruct the vendor to delete (§4.21).
- `e164` is stored in full because phone is a re-contactable channel used for reverification and account recovery. It is never exposed in `publicUser()` or any public payload. If a future review decides even this is too much, the migration is `e164` → `{ e164Hash, e164Last4 }`; the OTP flow would then only support re-entry, not re-send.
- `trustLevelHighWaterMark` exists so that a downgrade (expiry, revocation) is distinguishable from "never got there", which matters for reverification prompts (§4.15) and for anti-gaming heuristics (§4.16).
- All timestamps are ISO 8601 UTC strings via `new Date().toISOString()` — matching `createdAt`, `settingsUpdatedAt`, `policiesAcceptedAt` already in `users.json`.

**Backfill / absence semantics.** `users.json` currently holds 32 records, none with a `verification` key. There is no migration script. Instead, every read path goes through a normaliser:

```js
const CHANNEL_DEFAULT = { status: "unverified", verifiedAt: null, lastSentAt: null };

const readVerification = (user) => ({
  email: { ...CHANNEL_DEFAULT, address: user.email || null, ...(user.verification?.email || {}) },
  phone: { ...CHANNEL_DEFAULT, e164: null, ...(user.verification?.phone || {}) },
  // …future channels default the same way
});
```

This keeps legacy records valid, keeps `npm run check` the only gate, and means a rollback is just "stop reading the field".

> **Note on the pre-existing `user.email`.** Provider/creator/business accounts already carry a top-level `email` (set at signup by `isEmailAccount(role)`); clients do not. `verification.email.address` is a *separate* field and is the authoritative address for the verification channel. Phase 1 seeds it from `user.email` when present. They are allowed to diverge — a provider may verify a different address than their login address — and nothing in this system rewrites `user.email`. Login continues to key off `user.email` exactly as it does today.

### 3.2 Channel status state machine

Every channel uses one shared status enum. Phase 1 uses the first three only.

| Status | Meaning | Counts toward trust |
|---|---|---|
| `unverified` | Never attempted, or attempt abandoned. Default. | No |
| `pending` | Attempt in flight — OTP sent, or vendor session open awaiting webhook. | No |
| `verified` | Confirmed. | Yes |
| `failed` | Attempt concluded negatively (wrong OTP exhausted, vendor returned a negative decision). Retryable. | No |
| `expired` | Was `verified`, passed `expiresAt`. Retryable, and treated more gently in UI than `failed`. | No |
| `flagged` | Held for manual review — suspicious signal or vendor "requires input". Not retryable by the user. | No |
| `revoked` | Withdrawn by staff or by the user (e.g. deleted KYC data). Retryable only after a cooldown. | No |

```
unverified ──start──▶ pending ──success──▶ verified ──ttl──▶ expired ──restart──▶ pending
     ▲                   │                    │                                     │
     │                   ├──failure──▶ failed─┘                                     │
     │                   └──risk────▶ flagged ──staff approve──▶ verified           │
     └───────────────────────────────staff/user revoke◀── revoked ◀── staff reject──┘
```

**Invariants**

1. Only the server writes statuses. There is no client-supplied status anywhere in any request body.
2. A transition to `verified` **must** be accompanied by a `verifiedAt` in the same write.
3. A transition **must** append exactly one event to `verificationEvents.json` (§3.3), and if `trustLevel` changed, the same event carries both the old and new level. No separate "trust changed" event — one transition, one row.
4. Status writes and trust recomputation happen in **one** `usersQueue` task. Never read the user, compute outside the queue, then write.

### 3.3 `data/verificationEvents.json`

Append-only. Same discipline as `reports.json`: read whole file, push, `atomicWrite`, all inside `verificationEventsQueue`.

```json
[
  {
    "id": "3f0c9a1e-6a2c-4d3b-9d15-6e2e0f4a1b77",
    "userId": "b9329c3c-106d-4640-8dd2-e908dc6d39e9",
    "channel": "email",
    "event": "channel_verified",
    "previousStatus": "pending",
    "newStatus": "verified",
    "previousTrustLevel": 0,
    "newTrustLevel": 1,
    "actor": "user",
    "ipHash": "9c1f…",
    "createdAt": "2026-07-30T04:11:22.019Z"
  }
]
```

| Field | Rules |
|---|---|
| `id` | `crypto.randomUUID()`. |
| `userId` | The subject. Not the actor — a staff decision on someone else's account still has the subject's id here. |
| `channel` | `"email" \| "phone" \| "identity" \| "age" \| "faceMatch" \| "business" \| "account"`. `"account"` covers events that aren't channel-specific (e.g. `suspicious_activity_flagged`). |
| `event` | From the closed taxonomy in [Appendix B](#appendix-b--event-taxonomy). |
| `previousStatus` / `newStatus` | Nullable for non-transition events (`otp_sent`, `otp_failed`). |
| `previousTrustLevel` / `newTrustLevel` | Always populated with the integer before/after. Equal values are normal and fine. |
| `actor` | `"user" \| "system" \| "staff"`. `"system"` covers webhooks, expiry sweeps, risk triggers. |
| `ipHash` | `hashPrivateValue(getClientIp(request))`. `null` for `system` actors with no request context. **Never store a raw IP.** |
| `createdAt` | ISO 8601. |

**Forbidden in this file:** OTP codes (hashed or not), email addresses, phone numbers, names, document data, vendor payloads, free-text staff notes containing PII. If a staff decision needs a reason, use a closed `reasonCode` (added as an optional field in Phase 3), not prose.

**Growth.** At an estimated 8–15 events per fully verified user, 10 000 users ≈ 120 000 rows ≈ 30–40 MB. That is where full-file read-per-append stops being acceptable. Mitigation ladder, in order: (1) in-memory cache of the parsed array with the queue as the single writer; (2) monthly rotation to `data/verificationEvents-YYYY-MM.json` with a small manifest; (3) append-only NDJSON so writes are `fs.appendFileSync` and only reads pay the parse cost; (4) a real store (§5). Phase 1 does none of these and should not.

### 3.4 API conventions and the rate-limit table

All verification routes live under `/api/verification/*` (public read surface at `/api/trust/*`, staff at `/api/admin/verification/*`).

**Standard responses**

| Code | Body | When |
|---|---|---|
| `200` / `201` | `{ …payload }` | Success. |
| `400` | `{ "error": "Enter a valid Australian mobile number." }` | Validation. Human-readable, no field-level codes — matches how `/api/auth/*` already talks. |
| `401` | `{ "error": "Sign in to continue." }` | No/expired session. |
| `403` | `{ "error": "…" }` | Wrong role, or channel not available to this role. |
| `404` | `{ "error": "…" }` | Unknown passport reference. |
| `409` | `{ "error": "That email is already verified on another account." }` | Uniqueness conflict. |
| `429` | `{ "error": "Too many attempts. Wait before trying again." }` | Emitted by `requireAuthRateLimit` verbatim. |
| `503` | `{ "error": "Our verification partner is unavailable. Try again shortly." }` | Vendor unreachable. |

**Rate-limit `action` keys** to add to the `limits` table inside `requireAuthRateLimit` (`server.js`, alongside `signup`, `login`, `forgot`, `reset`, `rotateRecovery`):

```js
const limits = {
  signup:            [5,  60 * 60 * 1000],
  login:             [10, 15 * 60 * 1000],
  forgot:            [5,  60 * 60 * 1000],
  reset:             [5,  60 * 60 * 1000],
  rotateRecovery:    [5,  60 * 60 * 1000],

  // Phase 1
  verifyEmailStart:  [5,  60 * 60 * 1000],   // OTP sends per IP+user per hour
  verifyEmailCheck:  [10, 15 * 60 * 1000],   // code submissions
  verifyPhoneStart:  [5,  60 * 60 * 1000],   // costs real money — keep tight
  verifyPhoneCheck:  [10, 15 * 60 * 1000],
  verificationStatus:[60, 60 * 1000],        // polling headroom

  // Phase 2+
  identitySession:   [3,  24 * 60 * 60 * 1000],
  ageSession:        [3,  24 * 60 * 60 * 1000],
  businessSubmit:    [3,  24 * 60 * 60 * 1000],
  reverifyRequest:   [3,  24 * 60 * 60 * 1000],
  verificationHistory:[30, 60 * 1000],
  trustPassport:     [60, 60 * 1000]         // unauthenticated — keyed on IP only
};
```

The `identifier` argument scopes the bucket. Use `user.id` for authenticated actions so one abusive IP behind CGNAT cannot lock out an entire suburb, and `""` for the unauthenticated passport read (IP-only). Phone *send* additionally carries a per-destination-number counter (§4.6) because the cost is per-message, not per-account.

### 3.5 Design tokens and shared components

Only `:root` custom properties from [`style.css`](../style.css). Never a literal colour.

| Purpose | Token(s) |
|---|---|
| Page / panel ground | `--black`, `--soft-black`, `--panel`, `--luxury-panel`, `--surface-gradient` |
| Text | `--cream`, `--text-secondary`, `--text-tertiary`, `--muted` |
| Accent / verified | `--gold`, `--champagne`, `--bullion-rich`, `--btn-gold-gradient` |
| Borders / dividers | `--luxury-border`, `--line`, `--line-soft`, `--line-strong` |
| Elevation | `--luxury-shadow`, `--gold-glow`, `--gold-glow-strong` |
| Radii | `--radius-md`, `--radius-lg`, `--radius-pill` |
| Motion | `--duration-fast`, `--duration-mid`, `--ease-luxury`, `--ease-soft` |
| Focus | `--focus-outline`, `--focus-ring-offset`, `--focus-ring-glow` |
| Type | `--font-display` (serif headings), `--font-sans` (body) |

**Semantic status colours.** The palette has no red/green. Rather than introduce foreign hues into a dark-luxury system, status is carried by *token pairing plus form*:

```css
/* Add near the setup-checklist block in style.css */
:root {
  --status-verified-fg: var(--bullion-light);
  --status-verified-bg: rgba(var(--gold-rgb), 0.10);
  --status-verified-line: rgba(var(--gold-rgb), 0.50);

  --status-pending-fg: var(--champagne);
  --status-pending-bg: rgba(var(--champagne-rgb), 0.07);
  --status-pending-line: var(--line-soft);

  --status-attention-fg: var(--cream);
  --status-attention-bg: rgba(var(--wine-rgb), 0.55);   /* deep wine — reads as caution, stays in-palette */
  --status-attention-line: rgba(var(--champagne-rgb), 0.34);

  --status-idle-fg: var(--muted);
  --status-idle-bg: rgba(var(--cream-rgb), 0.04);
  --status-idle-line: var(--line);
}
```

Colour is never the sole carrier of meaning: every status chip also has a glyph (`✓`, `⋯`, `!`, `–`) and a text label, satisfying WCAG 1.4.1.

**Reused component: `.setup-checklist`.** The progress tracker (§4.2) is an extension of the existing block (`style.css` ≈ line 7723, "Setup checklist (provider profile edit page + creator dashboard)"), already consumed by [`provider-profile.html`](../provider-profile.html) (`<section class="setup-checklist" id="setupChecklist">`) and rendered by [`creator-dashboard.js`](../creator-dashboard.js) (`buildChecklistItems` / `renderChecklist`). Reuse `.setup-checklist-progress-bar`, `.setup-checklist-row`, `.setup-checklist-badge`, `.setup-checklist-row.is-complete`, and the existing `--btn-gold-gradient` progress fill. Do not fork it.

**Responsive baseline.** Mobile-first. `.setup-checklist-row` is currently `display:flex; align-items:center; justify-content:space-between` — at ≤ 640 px it must stack (`flex-direction: column; align-items: stretch`) so the action button becomes full-width rather than crushing the text column. All interactive targets ≥ 44 × 44 px. OTP input uses `inputmode="numeric"` so mobile keyboards open numeric.

### 3.6 Cross-cutting security model

| Threat | Control |
|---|---|
| OTP brute force | 6-digit code, max **5** submissions per code, 10-minute expiry, `requireAuthRateLimit` on top, constant-time compare via hash equality, code destroyed on success or on attempt exhaustion. |
| OTP enumeration / user probing | Start endpoints return an identical `200 { message }` whether or not the destination is already in use elsewhere. Conflict is surfaced only *after* correct code entry, as a `409`. |
| Channel takeover (attacker verifies their own phone onto a victim's account) | All start/verify routes require an active session; a channel change on an account with an existing `verified` value for that channel additionally requires password re-entry (§4.21) and emits a notification to the *old* destination. |
| Session fixation after verification | Verification does not mint a new session. It also does not extend one. |
| CSRF | Existing origin check on state-changing `/api/*`. Webhook exempt, HMAC-signed instead (§4.8). |
| Webhook forgery | Constant-time HMAC signature check against a `KYC_WEBHOOK_SECRET` env var, ±5-minute timestamp tolerance, replay rejection by vendor event id, and a **status re-fetch from the vendor API before trusting any promotion**. The webhook is a doorbell, not a source of truth. |
| PII leakage through logs | `notifications.js` and any `console.log` must never print an OTP, address, or `e164`. Log `userId` + `channel` only. |
| PII leakage through the audit file | Enforced by the field whitelist in §3.3. |
| Timing side-channel on "is this email registered" | Start endpoints do the same amount of work regardless; the uniqueness scan runs unconditionally. |
| IP correlation | Only `hashPrivateValue(ip)` is ever persisted — consistent with `signupIpHash` / `lastIpHash` / `reporterIpHash` already in the codebase. |
| Server restart | OTP `Map`s are intentionally volatile. A restart invalidates in-flight codes; the UI treats an unknown code as expired and offers resend. Acceptable, and a small security bonus. |
| Vendor compromise | TEMPTX holds no document data, so blast radius is limited to `sessionRef` values. Rotate `KYC_API_KEY` / `KYC_WEBHOOK_SECRET`, and mark affected `identity`/`faceMatch` channels `flagged` for re-run. |

---

## 4. Subsystems

---

### 4.1 Verification Centre dashboard

**Phase 1 ships a first version (email + phone). This section specifies the fuller target.**

#### Purpose

One authenticated page — `verification-centre.html` + `verification-centre.js` — that is the single place a user of any role sees what they've verified, what they haven't, what each step unlocks, and what happened historically.

> Naming: the existing [`verification.html`](../verification.html) is a *content* page (`<body … data-info-page="verification">`, rendered by [`info-page.js`](../info-page.js)) explaining the verification standard publicly. It stays. It gains a primary CTA into the Centre. The Centre is a new, session-gated page.

#### UI/UX

Layout, top to bottom, mobile-first single column, widening to a two-column grid (`minmax(0,1fr) 320px`) at ≥ 900 px:

1. **Trust header** — glass panel (`--luxury-panel` + `backdrop-filter: blur(18px)` + `--luxury-border` + `--luxury-shadow`). Contains: tier medallion (serif numeral in a `--btn-gold-gradient` ring), tier label ("Partially Verified"), one-line explanation of the *next* unlock, and `Verified since <date>` when tier ≥ 1.
2. **Progress tracker** — §4.2.
3. **Channel cards** — one per available channel for this role. Each card: channel name, status chip, plain-English benefit line, the masked value when verified (`h•••••l@gmail.com`, `+61 4•• ••• 891`), a primary action, and a disclosure-triangle "What we store" that expands the exact list of persisted fields for that channel. That last element is a deliberate trust-building device and is not optional.
4. **Recent activity** — last 5 events (§4.12) with a "View full history" link.
5. **Sidebar** (desktop) / **bottom section** (mobile) — "What each level unlocks" ladder, plus links to privacy policy and Trust Passport settings.

**States** — every channel card must render all of these:

| State | Visual | Copy pattern | Actions |
|---|---|---|---|
| Empty / unverified | `--status-idle-*`, glyph `–` | "Not started. Takes about 30 seconds." | **Verify** (primary) |
| In-flow | Card expands inline into a form. No navigation, no modal. | — | Submit / Cancel |
| Loading | Button → `aria-busy="true"`, label swaps to "Sending…", spinner uses `--duration-mid`/`--ease-soft`; skeleton shimmer suppressed under `prefers-reduced-motion` | — | disabled |
| Pending (OTP sent) | `--status-pending-*`, glyph `⋯` | "Code sent to h•••••l@gmail.com. Expires in 9:41." | Enter code / Resend (disabled 60 s) / Change address |
| Pending (vendor) | `--status-pending-*` | "Your ID is with our verification partner. Usually under 2 minutes." | Refresh status / Cancel |
| Success | `--status-verified-*`, glyph `✓`, gold ring pulse once (`--ease-snap`, suppressed under reduced motion) | "Verified 30 Jul 2026." | Change / Remove |
| Failure | `--status-attention-*`, glyph `!` | "That code didn't match. 3 attempts left." | Retry (focus returns to the input, input cleared) |
| Rejected | `--status-attention-*` | "Our partner couldn't confirm your document. This is usually a photo-quality issue." + closed-set guidance | Try again (respects cooldown) |
| Flagged | `--status-attention-*` | "Under review by our safety team. We'll notify you — usually within 2 business days." | none (informational) |
| Expired | `--status-pending-*` with a clock glyph | "Your ID check expired on 14 Aug 2028." | Reverify |
| Locked | `--status-idle-*`, reduced opacity | "Available once your email is verified." | disabled, with reason |
| Rate-limited | inline notice | "Too many attempts. Try again after 4:12pm." | disabled with countdown |
| Offline / server error | inline notice, card retains last known state | "We couldn't reach the server. Your progress is safe." | Retry |

**Accessibility**

- Page `<h1>` "Verification Centre"; each channel card is a `<section aria-labelledby>` with an `<h2>`.
- Status changes announce through a single `<div role="status" aria-live="polite">` region per card — never `aria-live="assertive"` (it interrupts).
- OTP field: `<input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*">`. **One input, not six boxes** — six boxes are a screen-reader and paste disaster.
- Focus management: opening the inline form moves focus to the first field; a failure moves focus to the error text (`tabindex="-1"`); success moves focus to the card heading.
- The countdown timer is `aria-live="off"` with the remaining time also present as static text, so it doesn't chatter every second.
- Contrast: `--cream` / `--champagne` on `--black`/`--panel` are the existing WCAG-minded pairings; `--muted` is body-secondary only, never for essential small text.
- Full keyboard reachability; visible focus via `--focus-outline` + `--focus-ring-glow`; no focus traps (the flow uses inline expansion, not modals, partly for this reason).
- `prefers-reduced-motion: reduce` disables the progress-bar fill transition, the success pulse, and any shimmer.

**Responsive**

| Breakpoint | Behaviour |
|---|---|
| ≤ 480 px | Single column, 16 px gutters, channel cards full-bleed with `--radius-lg`, actions full-width, sticky bottom CTA for the single highest-value next step. |
| 481–899 px | Single column, wider gutters, actions inline-right. |
| ≥ 900 px | Two-column with sticky sidebar. |
| ≥ 1440 px | Content capped at ~1180 px, centred. |

#### Backend

`GET /api/verification/status` is the only call the page needs on load (§4.13). Channel actions each hit their own route. The page never computes trust level client-side — it renders `trustLevel` and `tierLabel` from the response, so browser and server can never disagree.

#### API

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| `GET` | `/api/verification/status` | session | `verificationStatus` |

#### Permissions

Any authenticated user, any role. Clients included — this is the point of capturing email in-flow rather than at signup, since client accounts have no `email` field today (they sign up with a generated `clientId` like `TX-A3F91`).

#### Security

No verification data is rendered server-side into HTML; the page is static and hydrates from the API, so there is no injection surface and no cached-HTML PII. Masking of `address`/`e164` happens **server-side** in the status payload — the client is never sent the full value it doesn't need.

#### Audit

Page views are **not** logged. Only state transitions are. Logging views would balloon the file and add a surveillance flavour that contradicts §1.3.

#### Scalability

Single-user read of `users.json` on every load is O(n) over all users. At ~10 k users that's a ~10 MB parse per request. Mitigation before that point: an in-process `Map<userId, user>` index rebuilt on write (the serial queue makes this safe), which is a ~20-line change and does not require leaving flat files.

---

### 4.2 Verification progress tracker

#### Purpose

Extend the existing `.setup-checklist` pattern from a 3-item creator checklist into the verification funnel's spine, so the same visual language carries across [`creator-dashboard.html`](../creator-dashboard.html), [`provider-profile.html`](../provider-profile.html), and the Verification Centre.

#### UI/UX

Reuses the DOM shape produced by `renderChecklist()` in [`creator-dashboard.js`](../creator-dashboard.js): `.setup-checklist-progress-bar > span` for the gold fill, `.setup-checklist-progress-label` for `"2 of 4 required steps complete · 50%"`, and `.setup-checklist-row` items with `.setup-checklist-badge` chips.

**Extensions required:**

1. **A third status.** Today the row status set is `complete | not-started` (`STATUS_LABELS` in `creator-dashboard.js`). Add `in-progress` → `.setup-checklist-row.is-in-progress` with `--status-pending-*`, and `attention` → `.setup-checklist-row.is-attention` with `--status-attention-*`. `STATUS_LABELS` gains `"in-progress": "In progress"`, `"attention": "Needs attention"`.
2. **A fourth requirement tier.** `REQUIREMENT_LABELS` today is `required | required-verified | recommended`. Add `"required-payouts": "Required for payouts"` — provider/creator identity verification is the payout gate (§4.10).
3. **Real data.** The `verification` row in `buildChecklistItems()` currently hardcodes `status: "not-started"` with the comment that the checklist "only covers fields that genuinely exist on the user record". Once `user.verification` exists, that row is computed from it, and `actionHref` points at `verification-centre.html` rather than the info page.
4. **Segmented progress.** The single bar becomes N segments (one per required step) so partial progress is legible at a glance on mobile. Implementation stays CSS-only: a flex row of `<span>` segments inside `.setup-checklist-progress-bar`, filled segments carrying `--btn-gold-gradient`, empty carrying `rgba(var(--cream-rgb), 0.1)` — matching the existing bar background exactly.
5. **Role-aware step sets.** The tracker asks the server for its steps rather than hardcoding them, so the same component renders a 2-step client funnel and a 5-step business funnel.

**States**: empty (no steps applicable → tracker hidden, matching today's `setupChecklistSection.hidden` behaviour); loading (label reads "Loading setup progress…", already the markup default in `provider-profile.html`); partial; complete (bar 100 %, heading swaps to a congratulatory line, section collapses to a summary row after 7 days so it doesn't nag forever); blocked (a step in `attention` is pinned to the top).

**Accessibility**: the bar is `role="progressbar"` with `aria-valuenow` / `aria-valuemin="0"` / `aria-valuemax="100"` and `aria-labelledby` pointing at the label. Each row's status is text inside the badge, not colour-only. The list stays a `<ul>` of `<li>` so counts are announced.

**Responsive**: at ≤ 640 px `.setup-checklist-row` stacks and `.setup-checklist-action` becomes `width: 100%`. `.setup-checklist-heading` (currently `justify-content: space-between` with a 30ch max-width paragraph) wraps to a column.

#### Backend

Steps come from `GET /api/verification/status` as a `steps[]` array, computed by a pure `buildVerificationSteps(user)` in `server.js`:

```json
"steps": [
  { "id": "email",    "title": "Verify your email",    "requirement": "required",
    "status": "complete", "actionLabel": "Change", "actionHref": "verification-centre.html#email" },
  { "id": "phone",    "title": "Verify your phone",    "requirement": "required",
    "status": "not-started", "actionLabel": "Verify", "actionHref": "verification-centre.html#phone" },
  { "id": "identity", "title": "Verify your identity", "requirement": "required-payouts",
    "status": "not-started", "actionLabel": "Start", "actionHref": "verification-centre.html#identity" }
]
```

`percent` is computed over `requirement !== "recommended"` steps, mirroring today's `requiredItems` logic.

#### Validation / permissions / security

Read-only, derived. Nothing to validate. Session required. No new PII in the payload — step titles are static strings.

#### Audit

None. The tracker is a projection.

#### Scalability

Pure function over one user record. Free.

---

### 4.3 Trust Passport

#### Purpose

A shareable, user-controlled summary of verification state. A provider can drop the link in a booking reply; a client can show it to a provider screening them. It answers "has this person been checked, and how deeply?" without answering "who is this person?".

#### UI/UX

`trust.html` + `trust.js`, addressed as `trust.html?ref=<passportRef>` where `passportRef` is a short, opaque, rotatable token — **not** the `user.id`, and **not** the `clientId` (which is displayed elsewhere and would leak).

The page is a single centred card, deliberately screenshot-friendly and OG-image-friendly, styled with `--luxury-panel`, `--luxury-border`, `--luxury-shadow`:

- Tier medallion + label
- Display name (`settings.displayName`) or "TEMPTX member" if the owner has hidden it
- Verified-since date (owner-toggleable)
- A checkmark row: which *categories* are verified — Contact, Identity, Age, Business — as `✓` / `–`
- A footer: "Verified by TEMPTX · temptx link · Checked <relative date>"
- For the owner viewing their own passport: an "Owner view" banner with copy-link, visibility toggle, and rotate-link controls

**Public vs owner-only**

| Field | Public | Owner |
|---|---|---|
| Tier number + label | ✔ (if `showTierBadge`) | ✔ |
| Category checkmarks (contact / identity / age / business) | ✔ (if `showChannelDetail`) | ✔ |
| Verified-since date | ✔ (if `showVerifiedSince`) | ✔ |
| Display name | ✔ | ✔ |
| Email address, phone number (even masked) | ✘ **never** | masked only |
| Which specific channel satisfied a category | ✘ | ✔ |
| Exact `verifiedAt` / `expiresAt` timestamps | ✘ (relative only: "checked 3 months ago") | ✔ (exact) |
| Document type / country | ✘ **never** | ✔ |
| `sessionRef`, vendor name | ✘ **never** | ✔ (vendor name only) |
| Event history | ✘ | ✔ |
| `riskScore`, `reportsCount`, flags, review state | ✘ **never** | ✘ (staff only) |

**States**: not-yet-created (owner sees "Create your Trust Passport"); private (visitor sees a neutral "This passport is private" card — *identical* whether the passport is private, revoked, or never existed, so the endpoint can't be used to enumerate); active; stale (a category has expired → that row shows `–` with "expired" as owner-only detail; public sees only the `–`); revoked.

**Accessibility**: single `<h1>` = display name; the checkmark row is a `<dl>` with visually-hidden "Verified"/"Not verified" text alongside each glyph; the medallion has an `aria-label` reading the full tier sentence. Contrast on the gold gradient uses `--text-on-gold`.

**Responsive**: card is `max-width: 420px`, full-bleed under 480 px, `aspect-ratio` unconstrained so long display names wrap rather than truncate.

#### Data

```json
"passport": {
  "ref": "tp_7Kd2mQ",
  "createdAt": "2026-08-02T09:00:00.000Z",
  "rotatedAt": null,
  "visibility": "public",
  "viewCount": 0
}
```

Stored under `user.verification.passport`. `ref` is `"tp_" + crypto.randomBytes(6).toString("base64url")`, uniqueness-checked against existing refs the same way `makeClientId(users)` loops until unique.

#### API

| Method | Path | Auth | Rate limit | Notes |
|---|---|---|---|---|
| `GET` | `/api/trust/:ref` | none | `trustPassport` (IP-keyed) | Returns the public projection only. |
| `POST` | `/api/verification/passport` | session | `verificationStatus` | Create, or rotate `ref`. |
| `PATCH` | `/api/verification/passport` | session | `verificationStatus` | Change `visibility`. |

Public response:

```json
{
  "displayName": "Meow",
  "trustLevel": 3,
  "tierLabel": "Identity Verified",
  "verifiedSince": "2026-07",
  "categories": { "contact": true, "identity": true, "age": true, "business": false },
  "checkedAgo": "3 months"
}
```

Note `verifiedSince` is month-precision and `checkedAgo` is relative — day-precision timestamps are a correlation vector when combined with other public data.

#### Validation, permissions, security

`ref` must match `/^tp_[A-Za-z0-9_-]{8}$/` before any lookup. Unknown, private, and revoked all return the **same** `404` body. Rotating the ref invalidates every previously shared link — that is the "someone screenshotted my passport into a group chat" escape hatch, and the UI says so plainly. `Cache-Control: no-store` (already the default in the `json()` helper) prevents intermediary caching of a passport that may be revoked seconds later. `viewCount` is incremented at most once per IP-hash per hour to avoid turning the file into a write-storm target.

#### Audit

`passport_created`, `passport_rotated`, `passport_visibility_changed`. Views are not logged (privacy, volume).

#### Scalability

Lookup by `ref` is a linear scan of `users.json`. Same mitigation as §4.1 — an in-memory `Map<ref, userId>` built at boot and maintained by the write queue.

---

### 4.4 Trust Level system

#### The ladder

| Level | Label | Requirement | Public meaning |
|---:|---|---|---|
| **0** | Unverified | Nothing verified | "We haven't confirmed anything about this account." |
| **1** | Partially Verified | Exactly one of `email` / `phone` verified | "One contact method confirmed." |
| **2** | Fully Verified | Both `email` and `phone` verified | "Both contact methods confirmed." |
| **3** | Identity Verified | Level 2 **and** `identity.status === "verified"` | "A government ID was checked by our verification partner." |
| **4** | Fully Verified+ | Level 3 **and** `faceMatch.status === "verified"` | "ID checked, and the person matched the ID." |
| *5+* | *Reserved* | — | Reserved for a future professional/business assurance tier. Do not use. |

Labels are the user-facing contract. They must not be reworded ad hoc — they appear on the passport, in the directory, in notification templates, and in the info page copy.

#### Computation

One pure function, one call site pattern. It is the only thing that may write `trustLevel`.

```js
const TIER_LABELS = ["Unverified", "Partially Verified", "Fully Verified",
                     "Identity Verified", "Fully Verified+"];

const isVerified = (channel) => channel?.status === "verified";

const computeTrustLevel = (user) => {
  const v = readVerification(user);
  const contact = [v.email, v.phone].filter(isVerified).length;   // 0..2

  // Phase 1 stops here; Phases 2+ extend upward. Strictly monotonic:
  // a higher tier always requires everything the tier below requires.
  if (contact < 2) return contact;                                // 0 or 1
  if (!isVerified(v.identity)) return 2;
  if (!isVerified(v.faceMatch)) return 3;
  return 4;
};
```

**Rules**

1. **Monotonic and total.** Every tier strictly contains the one below. There is no path to Level 3 that skips phone. This is what makes the single integer meaningful — a client can reason "Level 3 implies contact verified" without a lookup table.
2. **Derived only.** No `PATCH /trustLevel`. Not even for staff. Staff act on *channels* (revoke, approve); the level follows.
3. **Recomputed on every channel write**, inside the same `usersQueue` task, and defensively recomputed on read in `GET /api/verification/status` — if the stored value disagrees with the computed value, the computed value wins and a `trust_level_recomputed` event is appended (that disagreement is a bug signal worth catching).
4. **Suppression, not deduction.** `flags.manualReview === true` or `safetyStatus !== "active"` does not change `trustLevel`; instead the *display* layer suppresses the badge and the passport returns `"private"`. Keeping the computed number clean means the audit trail stays interpretable, and reinstating an account doesn't require recomputation.
5. **Role-relative labels, absolute numbers.** For a `business` account, Level 3 is displayed as "Business Verified" and requires `business.status === "verified"` **in place of** `identity` (§4.11), because an ABN check plus document review is the equivalent assurance for an entity. The *number* still means "a third party checked a credential", which is what keeps cross-role comparison honest.

#### Data

`user.trustLevel` (int), `user.trustLevelUpdatedAt` (ISO), `user.trustLevelHighWaterMark` (int, Phase 3).

#### Exposure

- `publicUser()` in `server.js` (used by `/api/auth/me`, signup, login responses) gains `trustLevel` and `tierLabel`. Phase 1 currently also returns a per-user `verification` summary in `publicUser()`; if that is kept, treat it as authenticated-only and avoid returning it from any public directory/profile projections.
- `publicDirectoryBusiness()` and the provider directory projection gain `trustLevel` + `tierLabel` only (Phase 4, §4.17).

#### Audit

Every event row already carries `previousTrustLevel` / `newTrustLevel`, so the ladder history is reconstructible from the log without a separate stream.

#### Scalability

Pure and cheap. The only scaling concern is the *display* join — filtering the directory by tier currently means scanning all users. That is already how the directory works today, so no new problem.

---

### 4.5 Email verification (Phase 1, as-built)

#### UI/UX

Inline in the Verification Centre email card. Two steps, no page change:

1. **Address entry.** Prefilled with `user.email` for provider/creator/business accounts (which have one from signup); empty for clients (which do not — a client's identifier is `clientId`, e.g. `TX-A3F91`). Label: "Email address". Helper: "We use this for security alerts and account recovery. It is never shown on your profile."
2. **Code entry.** Single 6-digit field, `autocomplete="one-time-code"`. Shows the masked destination and a live "expires in m:ss". Resend disabled for 60 s.

**States**: empty · entering address · sending (`aria-busy`) · code sent · code invalid ("That code didn't match. 3 attempts left.") · code expired ("That code has expired." + Send a new code) · attempts exhausted (card returns to address entry; a fresh start is required) · rate-limited · already-verified-elsewhere (`409`, "That email is already verified on another account.") · verified · change flow (verified card → Change → address entry, with a warning that the current address will be notified).

**Accessibility**: `<label for>` on both inputs, `aria-describedby` linking helper and error text, errors announced via the card's `role="status"` region, focus moved to the error on failure. The masked address is announced in full-word form for screen readers via a visually-hidden span (`"h, five dots, l, at gmail dot com"` is unhelpful; the SR text instead reads "code sent to your email ending in gmail.com").

#### Backend

In-memory store, never persisted:

```js
// server.js — alongside sessions / authRateLimits / reportRateLimits
const emailOtps = new Map();  // userId -> { codeHash, address, expiresAt, attempts, sentAt }
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
```

Code generation: `String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")` — `randomInt` rather than `randomBytes` modulo, to avoid modulo bias. Stored as `hashPrivateValue(code)`; compared by hash equality. The plaintext code exists only in the local variable passed to the notifier.

Success path, all inside one `usersQueue` task: set `verification.email = { status: "verified", address, verifiedAt: now, lastSentAt }`, recompute `trustLevel`, set `trustLevelUpdatedAt`, `writeUsers`. Then append the event on `verificationEventsQueue`. Then delete the `Map` entry.

#### API

**`POST /api/verification/email/start`** — auth: session · rate limit: `verifyEmailStart` (identifier `user.id`)

```jsonc
// request
{ "address": "hopexbell@gmail.com" }
// 200
{ "message": "Verification code sent.", "maskedAddress": "h•••••l@gmail.com", "expiresInSeconds": 600 }
```

**`POST /api/verification/email/verify`** — auth: session · rate limit: `verifyEmailCheck`

```jsonc
// request
{ "code": "418302" }
// 200
{ "message": "Email verified.", "trustLevel": 1, "tierLabel": "Partially Verified",
  "verification": { "email": { "status": "verified", "maskedAddress": "h•••••l@gmail.com",
                               "verifiedAt": "2026-07-30T04:11:22.019Z" } } }
// 400
{ "error": "That code didn't match.", "attemptsRemaining": 3 }
```

#### Validation

- `normaliseEmail(body.address)` then `validEmail()` — reuse the existing helpers, do not write a new regex.
- Length ≤ 254; local part ≤ 64.
- Uniqueness: reject with `409` if another user has `verification.email.address === address && status === "verified"`, **or** if another user has `user.email === address` (the login-identity field). Checked at *verify* time, not *start* time, to avoid enumeration.
- Code: exactly `/^\d{6}$/` after `cleanText(body.code, 6)`.
- A start request for an address already `verified` on *this* account returns `200` with a no-op message rather than an error.

#### Permissions

Any authenticated user, any role — explicitly including `client`.

#### Security

Enumeration-safe start responses; hashed codes; volatile storage; 60-second resend floor enforced server-side via `lastSentAt` (not just client-side button state); changing a verified address notifies the *previous* address (§4.20); disposable-domain blocking is deliberately **not** implemented — it produces false positives against privacy-conscious users, who are exactly TEMPTX's population.

#### Audit

`otp_sent` (channel `email`, statuses `unverified`→`pending`), `otp_failed`, `otp_expired`, `channel_verified`, `channel_changed`.

#### Scalability

`emailOtps` is bounded by concurrent in-flight verifications; a periodic sweep (`setInterval`, 5 min) deletes expired entries so a burst can't grow the `Map` unboundedly. Multi-process deployment would break the `Map` — noted in §5.

---

### 4.6 Phone verification (Phase 1, as-built)

Structurally identical to email; the differences are what matter.

#### UI/UX

Number entry uses a fixed `+61` prefix affix with a plain national-format field beside it ("04XX XXX XXX"), because TEMPTX is Australia-only. Helper: "Used for security alerts and account recovery. Never shown publicly, never used for marketing." Live-format as the user types; submit the normalised E.164.

Additional state beyond email's set: **carrier failure** ("We couldn't deliver a message to that number. Check it and try again, or use email instead."), and **cost-guard rate limit**, which is stricter and phrased differently ("You've requested several codes. For security, try again in an hour.").

Mobile: `inputmode="tel"`, `autocomplete="tel-national"`. On Android, `autocomplete="one-time-code"` on the code field enables SMS autofill.

#### Backend

```js
const phoneOtps = new Map();       // userId -> { codeHash, e164, expiresAt, attempts, sentAt }
const phoneSendCounts = new Map(); // hashPrivateValue(e164) -> [timestamps]  (cost guard)
```

The second `Map` is the important addition: SMS costs real money per message, so the limit is *per destination number* as well as per account. Cap: 5 sends per number per 24 h, regardless of which account requests them. This blocks the "spin up accounts to SMS-bomb one number" attack, which is a harassment vector, not just a cost problem.

Phase 1 delivery is the `notifications.js` stub (console log). Swap-in is a single function (§4.20).

#### API

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| `POST` | `/api/verification/phone/start` | session | `verifyPhoneStart` + per-number cost guard |
| `POST` | `/api/verification/phone/verify` | session | `verifyPhoneCheck` |

```jsonc
// start request
{ "phone": "0412 345 891" }
// 200
{ "message": "Verification code sent.", "maskedPhone": "+61 4•• ••• 891", "expiresInSeconds": 600 }
```

#### Validation

Normalise: strip non-digits; accept `04XXXXXXXX` (10 digits, mobile) → `+614XXXXXXXX`; accept `+614XXXXXXXX`; accept `614XXXXXXXX`. Reject landlines (`02/03/07/08`) with "Enter an Australian mobile number." — voice OTP is out of scope. Reject known virtual/VoIP prefixes only if a maintained list exists; otherwise don't, for the same false-positive reason as disposable email. Uniqueness: one `verified` phone per account, and a phone `verified` on another account returns `409` at verify time.

A dedicated `normalisePhoneAu(value)` helper sits next to `normaliseAbn` / `normaliseEmail` in `server.js`.

#### Permissions

Any authenticated user, any role.

#### Security

Per-number cost guard (above); SMS is the weakest channel against SIM-swap, so **phone alone never satisfies account recovery** — the existing recovery-code mechanism (`recoveryCodeHash`, `makeRecoveryCode()`) remains primary and is not weakened by this system. Changing a verified number notifies the old number and the verified email.

#### Audit

Same taxonomy as email with `channel: "phone"`.

---

### 4.7 Age verification

#### Relationship to the existing age gate

TEMPTX already has a site-wide 18+ self-attestation modal: `#ageGate` in the shared header markup, gated on `localStorage.getItem("temptxAgeConfirmed") === "true"` in [`script.js`](../script.js), with a decline path that redirects off-site. That stays exactly as it is. It is a *legal notice*, unauthenticated, per-device, and trivially bypassed — and it is not evidence of anything.

Age verification here is different: account-level, verified by a third party, and recorded as a channel.

#### Approach

Age is **derived from the identity check**, not collected separately. The KYC vendor already extracts DOB from the document; TEMPTX asks the vendor for a *predicate* — "is this person over 18?" — and stores the answer, not the date.

```json
"age": {
  "status": "verified",
  "source": "identity",       // "identity" | "standalone"
  "isOver18": true,
  "ageBracket": "25-34",      // optional, coarse, opt-in
  "verifiedAt": "2026-08-14T02:00:00.000Z",
  "expiresAt": null            // an over-18 fact does not expire
}
```

**Why no DOB.** A stored DOB is a high-value identifier that combines with a name and a suburb to deidentify someone. TEMPTX does not need it for any product function. The predicate is sufficient. This is the single most important data-minimisation decision in the spec.

`ageBracket` is optional, coarse (`18-24`, `25-34`, `35-44`, `45-54`, `55+`), and only stored if the user opts in during the flow, because some directory features may later want it. Default: not stored.

If TEMPTX ever needs age assurance *without* full identity (a lighter regulatory path), `source: "standalone"` covers a vendor "age check only" product — same webhook, same channel, cheaper, no document retained. The channel shape doesn't change.

#### UI/UX

Age is usually not a separate card. When the user completes identity verification, the age card flips to verified automatically with the copy "Confirmed as part of your ID check." A standalone card appears only for users who need age assurance but not identity (a Phase 2+ decision).

States: unverified · pending (mirrors identity's pending) · verified · failed ("Our partner couldn't confirm you're over 18 from that document.") · **under-18** — a distinct and consequential state: the account is immediately restricted, all sessions cleared via the existing `clearUserSessions(userId)`, `safetyStatus` set to a restricted value, a `flags.manualReview` opened, and the user is shown a plain, non-accusatory screen with an appeal contact. This must never be a silent failure and must never be reversible by the user without staff involvement.

#### API

Reuses identity's routes; the vendor session is created with an age check included. A standalone variant would be `POST /api/verification/age/session` with rate limit `ageSession`.

#### Validation / permissions / security / audit

Validation is vendor-side. Any authenticated role may verify age. The under-18 path is the security-critical branch and must be tested explicitly. Audit events: `channel_verified` (`age`), `channel_failed`, and `underage_detected` (channel `age`, actor `system`) — the last of which is the highest-priority signal in the entire log and should be surfaced to staff at the top of the review queue (§4.19), alongside how the existing report pipeline already treats `category === "underage"` as `priority: "urgent"`.

#### Scalability

One extra key on the user record. Nil.

---

### 4.8 Identity verification (KYC vendor)

#### Product decision

TEMPTX integrates a hosted third-party KYC vendor — Stripe Identity, Onfido, or Persona class. TEMPTX does **not** build document forensics, OCR, or tamper detection. The integration is written against a thin internal interface so the vendor is swappable:

```js
// kycProvider — one object, one place to swap vendors
const kycProvider = {
  name: "stripe_identity",
  createSession({ userId, checks, returnUrl }) { /* → { sessionRef, hostedUrl, expiresAt } */ },
  fetchSession(sessionRef)                     { /* → { status, checks, failureCode } */ },
  verifyWebhookSignature(rawBody, headers)     { /* → boolean, constant-time */ },
  requestDeletion(sessionRef)                  { /* → boolean */ }
};
```

Vendor selection criteria (for the Phase 2 decision, recorded here so the reasoning survives): Australian document coverage (AU passport, AU driver licence per state, Medicare-adjacent handling); data residency options; a genuine deletion API; per-check pricing; webhook reliability; and — specific to TEMPTX — whether the vendor's terms permit adult-industry customers, which several do not. That last one has killed integrations before and should be checked first.

#### Flow

```
User clicks "Verify my identity"
  │
  ├─▶ POST /api/verification/identity/session
  │     ├─ session + role check + rate limit (identitySession)
  │     ├─ preconditions: trustLevel >= 2 (email + phone done)
  │     ├─ kycProvider.createSession(...)
  │     ├─ usersQueue: identity = { status:"pending", sessionRef, lastStartedAt, attempts+1 }
  │     ├─ event: channel_started
  │     └─▶ 200 { hostedUrl, expiresAt }
  │
  ├─▶ Browser navigates to vendor hostedUrl  (documents + selfie captured VENDOR-SIDE ONLY)
  │
  ├─▶ Vendor redirects back to verification-centre.html?identity=returned
  │     └─ page shows "pending" and begins polling GET /api/verification/status
  │
  └─▶ Vendor POSTs webhook → /api/verification/webhooks/kyc
        ├─ HMAC signature check (constant-time), timestamp window, replay check
        ├─ kycProvider.fetchSession(sessionRef)   ← re-fetch; never trust the payload body
        ├─ map vendor status → channel status
        ├─ usersQueue: write identity (+ age, + faceMatch), recompute trustLevel
        ├─ events: channel_verified / channel_failed / channel_flagged
        └─ notification (§4.20)
```

The redirect is a *hint*, not a result. A user who closes the tab still gets verified when the webhook lands. A webhook that never lands is caught by the reconciliation sweep (below).

#### What TEMPTX stores vs. what stays with the vendor

| Data | TEMPTX | Vendor |
|---|---|---|
| Document image (front/back) | ✘ never | ✔ |
| Selfie / video | ✘ never | ✔ |
| Document number | ✘ never | ✔ |
| Full name as printed | ✘ never (only `nameMatchesAccount: true\|false`) | ✔ |
| Date of birth | ✘ never (only `isOver18`) | ✔ |
| Address on document | ✘ never | ✔ |
| Document type + issuing country | ✔ (low-entropy, needed for dispute handling) | ✔ |
| Pass/fail decision | ✔ | ✔ |
| Failure reason code | ✔ (closed set) | ✔ |
| Opaque session reference | ✔ | ✔ |

If the vendor's webhook payload contains PII beyond this table — and it will — it is **read and discarded in memory**. It is never written to `users.json`, never written to `verificationEvents.json`, and never `console.log`ed. This needs an explicit code comment at the webhook handler, because the default instinct is to log the payload while debugging.

#### UI/UX

The identity card is locked until Level 2 with the copy "Available once your email and phone are verified" — a deliberate funnel ordering that also means TEMPTX has a working contact channel before spending money on a KYC check.

Pre-flight panel before the redirect, because a hosted-flow handoff is where users bail:
- What you'll need: a passport or Australian driver licence, and about two minutes
- What happens: "You'll be taken to our verification partner. **TEMPTX never sees or stores your document.**"
- What we keep: an itemised list (the table above, in plain words)
- Who our partner is, with a link to their privacy policy
- Primary: **Continue to verification** · Secondary: Cancel

**States**: locked · ready · pre-flight · redirecting (full-card spinner, `aria-busy`; if the popup/redirect fails, a copyable fallback link) · returned-pending ("We're waiting on our verification partner. This usually takes under two minutes. You can close this page — we'll email you.") · verified (gold pulse, tier medallion animates 2 → 3) · failed with a closed set of reason codes mapped to *actionable* copy:

| `failureCode` | User-facing copy |
|---|---|
| `document_unreadable` | "The photo was too blurry to read. Try again in better light." |
| `document_expired` | "That document has expired. Use a current one." |
| `document_unsupported` | "We can't accept that document type. Try a passport or Australian driver licence." |
| `document_manipulated` | "We couldn't confirm that document." *(deliberately vague — do not tell a fraudster what tripped the detector)* |
| `name_mismatch` | "The name didn't match your account. Update your account name or use matching ID." |
| `consent_declined` | "You didn't complete the check with our partner." |
| `abandoned` | "It looks like you didn't finish. Pick up where you left off." |

· flagged (vendor returned "requires input"/manual review → `flagged`, staff queue) · expired (§4.14) · cooldown after 3 failed attempts in 24 h ("You've tried a few times. Contact support and we'll help.").

**Accessibility**: the pre-flight panel is a `<section>`, not a modal — no focus trap, back button works, and the redirect is a real link the user can middle-click. If a modal is used anyway, it needs full focus containment, `aria-modal`, Escape-to-close, and focus restoration. Pending state announces once via `role="status"`, and the poller does **not** re-announce on every tick.

**Responsive**: pre-flight is full-screen on mobile with a sticky footer CTA; the hosted flow is the vendor's responsibility and is required to be mobile-capable (a selection criterion).

#### API

**`POST /api/verification/identity/session`** — session · `identitySession` (3/24 h)

```jsonc
// 200
{ "hostedUrl": "https://verify.stripe.com/start/…", "expiresAt": "2026-08-14T02:41:00.000Z" }
// 403 — precondition
{ "error": "Verify your email and phone first." }
// 503
{ "error": "Our verification partner is unavailable. Try again shortly." }
```

**`POST /api/verification/webhooks/kyc`** — **no session**, HMAC-signed, **CSRF-origin check explicitly bypassed for this path only**. Always returns `200` on a valid signature even if processing is deferred (vendors retry aggressively on non-2xx). Returns `401` on signature failure with no body detail.

**`GET /api/verification/identity/status`** — session · `verificationStatus`. Convenience alias; the Centre normally uses the aggregate `/api/verification/status`.

#### Validation, permissions, security

No user-supplied identity data crosses the API — the request body for session creation is effectively empty, which is the point. Available to `provider`, `creator`, `business`, and `client` (a client verifying identity is a strong safety signal for providers screening them, and is one of the more valuable things this system can offer providers).

Security specifics: signature verified with `crypto.timingSafeEqual` on raw body bytes **before** JSON parsing; a replay cache of vendor event ids (in-memory `Set`, 24 h) rejects duplicates; a ±5-minute timestamp window; `sessionRef` in the webhook must match the `sessionRef` currently stored on that user, otherwise the event is ignored and logged as `webhook_mismatch`; and the re-fetch step means a forged webhook with a valid-looking body still cannot promote anyone.

**Reconciliation sweep.** A `setInterval` (15 min) finds `identity.status === "pending"` older than 30 minutes and calls `kycProvider.fetchSession`. This covers dropped webhooks, and is the difference between "usually works" and "works". Sweep actions log with `actor: "system"`.

#### Audit

`channel_started`, `channel_verified`, `channel_failed`, `channel_flagged`, `webhook_received`, `webhook_mismatch`, `reconciliation_resolved`. Never the payload.

#### Scalability

Vendor calls are the slow path and are all async; nothing blocks the write queue while waiting on the network — `kycProvider.*` calls happen *outside* `usersQueue`, and only the resulting small write goes inside it. Getting this ordering wrong would serialise the whole server behind vendor latency, so it is called out explicitly.

---

### 4.9 Face matching

#### Approach

Face match and liveness are **entirely vendor-side**. TEMPTX consumes a boolean. There is no image upload endpoint, no biometric template, no on-device model, no fallback "send us a selfie holding a sign" flow — that last one being the traditional adult-industry approach and precisely what this system replaces, since it means the platform holds a selfie forever.

In most vendors, face match is a *check* within the same session as the document check, so Phase 2 gets it nearly free: request `checks: ["document", "selfie"]` at session creation and read two results from one webhook.

```json
"faceMatch": {
  "status": "verified",
  "provider": "stripe_identity",
  "sessionRef": "vs_1P…",
  "verifiedAt": "2026-08-14T02:00:00.000Z",
  "expiresAt": "2027-08-14T02:00:00.000Z",
  "livenessPassed": true,
  "failureCode": null
}
```

Note the shorter TTL than identity (12 months vs 24) — appearance drifts, and Level 4 is the tier that most needs to be current.

#### UI/UX

Not a separate card by default: presented as a sub-line inside the identity card ("Selfie match — ✓ Confirmed"). It becomes a standalone card only when a user is at Level 3 with a face-match failure and needs to retry independently.

States: not-attempted · pending · verified · failed (`selfie_unreadable` → "We couldn't get a clear enough selfie. Try again in even lighting."; `selfie_face_mismatch` → "The selfie didn't match your document."; `selfie_manipulated` → deliberately vague) · flagged · expired.

**Accessibility and inclusion note**: face match fails disproportionately for some users — certain disabilities, facial differences, some head coverings, and darker skin tones on weaker vendors. Therefore: (a) vendor demographic-bias performance is a **selection criterion**, not a nice-to-have; (b) a face-match failure must never be the sole cause of a punitive action; (c) every failure state offers a human-review path (§4.19); (d) Level 4 must never be a hard requirement for core platform function — it may unlock placement and badges, never access.

#### API

None of its own. Result arrives on the identity webhook.

#### Permissions, security, audit, scalability

Same as §4.8. Audit uses `channel: "faceMatch"`. No biometric data ever touches TEMPTX storage, which also keeps the system clear of the strictest categories of biometric-data regulation — a deliberate architectural benefit of the vendor decision.

---

### 4.10 Provider / Creator verification

#### Purpose

Role-specific requirements layered on the generic ladder. Providers and creators are the accounts that receive money and hold public listings, so they carry the highest bar.

#### Requirements

| Capability | Minimum |
|---|---|
| Create an account, browse | Level 0 |
| Save a profile draft | Level 0 |
| Appear in the directory | Level 2 (email + phone) |
| Receive messages from clients | Level 2 |
| Receive payouts | Level 3 (identity) — **hard gate**, non-negotiable |
| "Verified" badge on directory cards | Level 3 |
| Priority directory placement / trust filter inclusion | Level 4 |

The payout gate at Level 3 is not a product preference — it is the AML/KYC posture that makes a payments partner willing to work with an adult-industry platform at all. It should be stated plainly in provider-facing copy from the first screen, because discovering it at cash-out time is the worst possible moment.

`provider` and `creator` have identical verification requirements. They differ in what they unlock (in-person directory listing vs. content/subscription surfaces), not in what they must prove.

#### UI/UX

Entry points: the `setup-checklist` on [`provider-profile.html`](../provider-profile.html) and [`creator-dashboard.html`](../creator-dashboard.html) — specifically the `verification` row in `buildChecklistItems()`, currently hardcoded to `status: "not-started"` with `actionHref: "verification.html"`. Once real, it reads live status and points to `verification-centre.html`.

Copy frames verification as an unlock ladder, not a compliance chore: "You're two steps from payouts" beats "Verification required". Every locked capability names the exact step that unlocks it and links to it — never a bare "not verified" with no path.

**States**: the checklist row reflects channel status; the profile page shows a persistent but dismissible banner when a *required-for-payouts* step is outstanding **and** the provider has pending earnings — targeted, not permanent nagging.

**Accessibility**: locked capability controls use `aria-disabled="true"` plus a visible reason, rather than being removed from the DOM (a removed control is invisible to a screen-reader user trying to find out why they can't do something).

#### Backend, data, API

No new schema — role requirements are a lookup table in `server.js`:

```js
const ROLE_REQUIREMENTS = {
  client:   { directory: 0, messaging: 1, payouts: null, badge: 3 },
  provider: { directory: 2, messaging: 2, payouts: 3,    badge: 3 },
  creator:  { directory: 2, messaging: 2, payouts: 3,    badge: 3 },
  business: { directory: 2, messaging: 2, payouts: 3,    badge: 3 }
};
```

Gates are enforced **server-side** at the point of the capability (directory projection, message send, payout request), not merely hidden in the UI. `GET /api/verification/status` returns a `capabilities` object so the UI can render the same truth without duplicating the rules.

#### Permissions, security, audit, scalability

Enforced via `requireRole(request, role, user)` plus a trust check. A trust downgrade must revoke capabilities immediately, which means the gate reads current state per request rather than caching a decision at login. Audit: `capability_gate_denied` is **not** logged (too noisy, no forensic value); `channel_*` transitions already explain any capability change.

---

### 4.11 Business verification

#### Starting point (already in the codebase)

Business signup already collects and stores:

- `businessAbn` — normalised to 11 digits by `normaliseAbn()`, length-validated at signup (`"Enter a valid 11 digit ABN."`)
- `applicationStatus` — initialised to `"draft"`, surfaced through `publicUser()` and `publicDirectoryBusiness()`, and already used as a directory gate (`user.applicationStatus === "approved"`)
- `businessProfile` — `{ website, contactPhone, description, services, location, openingHours, priceRange, logoDataUrl }`

So a two-track state already exists. This spec **aligns** them rather than replacing either: `applicationStatus` remains the *listing* lifecycle (draft → submitted → approved → rejected), and `verification.business.status` becomes the *credential* state. Approval requires verified credentials; the two are related but not the same field, and conflating them would break the existing directory query.

#### Data

```json
"business": {
  "status": "verified",
  "abnStatus": "active",
  "abnCheckedAt": "2026-08-02T00:00:00.000Z",
  "entityNameMatchesAccount": true,
  "documentsReviewedAt": "2026-08-05T00:00:00.000Z",
  "reviewedBy": "staff:4f2a…",
  "expiresAt": "2027-08-05T00:00:00.000Z"
}
```

Note: no entity name, no address, no director details, no document copies. `entityNameMatchesAccount` is a boolean computed at check time and then the source strings are discarded. `reviewedBy` is a hashed staff reference, not a staff name.

#### ABN validation

Two layers:

1. **Checksum (offline, Phase 2, no dependency).** The ABN weighted-modulus algorithm: subtract 1 from the first digit, apply weights `[10,1,3,5,7,9,11,13,15,17,19]`, sum, and require `sum % 89 === 0`. Catches typos instantly with zero network calls, no API key, and no privacy exposure. Implement as `validAbnChecksum(abn)` next to the existing `normaliseAbn`.
2. **Registry lookup (Phase 3, optional).** The ABR web-services lookup confirms the ABN is *active* and returns the registered entity name for a fuzzy match against `workingName`. Requires a registered GUID, so it is env-gated (`ABR_GUID`); when unset, the system falls back to checksum-only plus manual review, and says so honestly in staff UI.

#### Document checks

Business documents (venue licence, council permit, insurance certificate) are reviewed by staff. Given §1.3, TEMPTX should **not** accumulate these files in the repo's data directory. Options in preference order: (a) route them through the same KYC vendor's document-collection product where available; (b) staff-side review via an external secure channel with only the *outcome* recorded; (c) if TEMPTX must hold them, they go in a non-web-served path outside the static root with a short mandatory retention limit and a deletion job — and this needs its own security review, because `server.js` serves the project directory statically and a misplaced upload directory would be world-readable. **`logoDataUrl` already stores a base64 image inline in `users.json`; documents must not follow that pattern.**

#### UI/UX

Business verification card on the Verification Centre, plus mirrored status on [`business-dashboard.html`](../business-dashboard.html).

States: ABN not provided · ABN format invalid (inline, instant, checksum-based) · ABN checksum passed / registry pending · ABN inactive ("The ABN you entered isn't currently active on the register.") · name mismatch (surface both, ask which is right, route to staff) · documents required (list exactly which) · documents submitted / under review ("Usually reviewed within 3 business days") · verified · rejected (closed reason code + resubmit path) · expired (annual re-attestation).

**Accessibility**: the ABN field uses `inputmode="numeric"`, an 11-digit `maxlength` after formatting, and announces checksum validity via `role="status"` **on blur**, not on every keystroke.

#### API

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| `POST` | `/api/verification/business/abn` | session + `requireRole("business")` | `businessSubmit` |
| `POST` | `/api/verification/business/submit` | session + `requireRole("business")` | `businessSubmit` |
| `GET` | `/api/verification/business/status` | session + role | `verificationStatus` |

#### Permissions, security, audit, scalability

`business` role only — enforced with the existing `requireRole(request, "business", user)` pattern already used by `/api/business/profile`. ABNs are public information, so they are not treated as secret, but they *are* linkable to a person for sole traders and therefore never appear in the audit log or on public surfaces beyond what the business chooses to publish. Audit events use `channel: "business"` with `actor: "staff"` on review decisions. Business accounts are the smallest cohort; no scaling concern.

---

### 4.12 Verification history

#### Purpose

Give the user (and later staff) a readable chronology, backed by `data/verificationEvents.json`. This is both a trust feature ("you can see everything we recorded") and a security feature ("you didn't do this — tell us").

#### UI/UX

Full-page or expanded section at `verification-centre.html#history`. Reverse-chronological, grouped by day with sticky date headers. Each row: channel glyph, plain-English sentence, relative time (`title` attribute carrying the exact timestamp), and a subtle tier-change chip when the level moved.

Event → copy mapping (user-facing; never expose raw event names):

| Event | Copy |
|---|---|
| `otp_sent` | "Verification code sent to your email" |
| `otp_failed` | "Incorrect code entered" |
| `channel_verified` | "Email verified" · "Phone verified" · "Identity verified" |
| `channel_failed` | "Identity check could not be completed" |
| `channel_expired` | "Identity verification expired" |
| `channel_revoked` | "Phone verification removed" |
| `trust_level_changed` chip | "Trust Level 1 → 2" |
| `reverification_required` | "We asked you to re-verify" |
| `suspicious_activity_flagged` | "Unusual activity detected on your account" |

Staff-actor events read as "Reviewed by TEMPTX Safety" — never a staff member's name or id.

**States**: loading (3 skeleton rows) · empty ("Nothing here yet. Your verification activity will appear as you complete steps.") · loaded · paginated ("Load older activity", cursor-based) · error (retry, prior rows kept on screen).

**Accessibility**: `<ol>` with `<li>` rows; date headers are real `<h3>`s; relative times use `<time datetime="…">`; "Load older" appends and moves focus to the first new row.

**Responsive**: single column throughout; on mobile the tier chip drops below the sentence rather than truncating it.

#### API

**`GET /api/verification/history?before=<iso>&limit=25`** — session · `verificationHistory` (30/min)

```jsonc
{
  "events": [
    { "id": "3f0c…", "channel": "email", "event": "channel_verified",
      "previousTrustLevel": 0, "newTrustLevel": 1, "actor": "user",
      "createdAt": "2026-07-30T04:11:22.019Z" }
  ],
  "hasMore": false,
  "nextBefore": null
}
```

`ipHash` is **not** returned to the user — it is not meaningful to them and is a correlation risk if their account is compromised. `userId` is redundant and omitted. Staff get a richer projection (§4.18).

#### Validation, permissions, security

`limit` clamped 1–100; `before` must parse as a valid ISO date. Users see **only their own** events — the handler filters on `session.userId` and never accepts a `userId` parameter, which removes the entire class of IDOR bug here.

#### Scalability

Reverse-scanning the whole array per request is fine at thousands of rows and not at millions. Ladder as in §3.3. Cursor pagination is specified from day one precisely so the storage layer can change underneath without touching the API contract.

---

### 4.13 Live verification status tracking

#### `GET /api/verification/status`

The single aggregate read behind the Centre, the tracker, and any embedded trust widget.

**Auth**: session · **Rate limit**: `verificationStatus` (60/min, generous enough for polling)

```jsonc
{
  "trustLevel": 1,
  "tierLabel": "Partially Verified",
  "trustLevelUpdatedAt": "2026-07-30T04:11:22.019Z",
  "nextStep": { "id": "phone", "title": "Verify your phone", "unlocks": "Directory listing and messaging" },
  "channels": {
    "email": { "status": "verified", "maskedAddress": "h•••••l@gmail.com",
               "verifiedAt": "2026-07-30T04:11:22.019Z", "expiresAt": null, "canRetry": false,
               "pending": null },
    "phone": { "status": "unverified", "maskedPhone": null,
               "verifiedAt": null, "expiresAt": null, "canRetry": true,
               "pending": null },
    "identity": { "status": "locked", "reason": "Verify your email and phone first." }
  },
  "steps": [ /* §4.2 */ ],
  "capabilities": { "directory": false, "messaging": false, "payouts": false, "badge": false },
  "flags": { "manualReview": false },
  "pollAfterSeconds": 0
}
```

`pending` carries `{ expiresAt, attemptsRemaining, resendAvailableAt }` when a channel is mid-flow — everything the UI needs for its countdowns without a second call.

`pollAfterSeconds` is a **server-driven backoff hint**, and the client must honour it. It is the mechanism that keeps polling from becoming a self-inflicted denial of service:

| Situation | `pollAfterSeconds` |
|---|---|
| Nothing pending | `0` (don't poll; refresh on user action) |
| OTP outstanding | `0` (user-driven; no poll needed) |
| Vendor session pending, < 2 min elapsed | `3` |
| Vendor session pending, 2–10 min | `10` |
| Vendor session pending, > 10 min | `30` |
| Server under load | raised centrally |

The client polls only while the tab is visible (`document.visibilityState`), stops after 10 minutes and swaps to a manual "Check again" button, and never polls when nothing is pending.

#### Future real-time layer

| Option | Fit | Verdict |
|---|---|---|
| **Adaptive polling** (specified above) | Works today with the plain `http` server; no new dependency; survives restarts trivially. | **Phase 1–3. Correct choice.** |
| **SSE** (`text/event-stream`) | Implementable on the existing server with ~40 lines and no dependency: hold the response open, keep a `Map<userId, response[]>`, write on transition. One-way, which is exactly the shape of this problem. Needs heartbeats and proxy buffering care. | **Phase 4 candidate — the natural next step.** |
| **WebSockets** | Needs `ws` (the repo has near-zero dependencies), plus upgrade handling, heartbeats, backpressure. Bidirectional, which this feature doesn't need. | **Not recommended for this feature.** Revisit only if chat also moves to sockets. |

Either push mechanism keeps the polling endpoint as the fallback, and neither becomes a source of truth — a push is a nudge to re-read, mirroring how the webhook is treated in §4.8.

#### Security, audit, scalability

Session-scoped; never accepts a `userId` argument. Masking happens server-side. Reads are not audited. At scale, the per-request `readUsers()` parse is the bottleneck — same in-memory index mitigation as §4.1, and note that if push replaces polling, read volume drops by roughly an order of magnitude, which is the real argument for SSE.

---

### 4.14 Verification expiry management

#### Policy

| Channel | TTL | Rationale |
|---|---|---|
| `email` | none | A working address is self-evidencing; bounce handling covers decay. |
| `phone` | none by default | Same; number recycling is handled by risk signals rather than blanket expiry. |
| `identity` | **24 months** | Documents expire, appearances change, regulatory expectations favour periodic refresh. |
| `age` | never | An over-18 predicate cannot become false. |
| `faceMatch` | **12 months** | Shorter than identity — it is the freshest-signal tier. |
| `business` | **12 months** | Annual re-attestation that the ABN is still active and licences current. |

TTLs live in one constant so policy changes are a single edit:

```js
const CHANNEL_TTL_MS = {
  email: null, phone: null, age: null,
  identity: 730 * 24 * 60 * 60 * 1000,
  faceMatch: 365 * 24 * 60 * 60 * 1000,
  business: 365 * 24 * 60 * 60 * 1000
};
```

#### Detection

Two mechanisms, belt and braces:

1. **Lazy (authoritative).** Every read of a channel compares `expiresAt` to now. An expired channel is reported as `expired` regardless of what is written on disk. This means expiry is *correct even if the sweep never runs*, which matters on a single-process server that may restart at any time.
2. **Sweep (for notifications and consistency).** A `setInterval` (hourly, plus once at boot) walks users, materialises `verified → expired` transitions through `usersQueue`, recomputes trust levels, appends `channel_expired` events with `actor: "system"`, and fires the reminder ladder.

Reminder ladder: **T-30 days**, **T-7 days**, **T-0**, **T+7 days**. Each is sent at most once — tracked by `verification.reminders = { "identity:T-30": "2026-07-15T…" }` — so a restart mid-sweep cannot spam.

#### UI/UX

- **Approaching (≤ 30 days)**: the channel card gains a `--status-pending-*` sub-line "Expires in 24 days · Renew now". The tracker adds a `Renew` step with `requirement: "required-verified"`. No banner yet — 30 days out does not warrant interrupting anyone.
- **Expired**: card flips to `expired` with a clock glyph and copy that is careful not to imply wrongdoing ("Your ID check has expired. Renewing takes about two minutes."). Tier medallion animates down; the reason is stated inline so the drop never feels arbitrary.
- **Grace period**: **14 days** after expiry, capabilities keep working while the badge is suppressed and the banner is persistent. This prevents a provider's payouts vanishing overnight because of a date they never saw. After grace, capabilities gate.
- **Renewal**: a renewal reuses the standard channel flow, pre-announced as "This will replace your existing verification."

**Accessibility**: expiry banners are `role="status"` (polite), not `role="alert"`. Countdown text is exact ("Expires 14 August 2028"), with relative time as supplementary, since "in 24 days" alone is poor for screen-reader users navigating out of context.

#### API, validation, permissions

No new routes — `expiresAt` and `canRetry` already ride on `GET /api/verification/status`. Only the system writes expiry. Staff may extend a grace period once the admin role exists (§4.18), which is logged as `expiry_grace_extended` with `actor: "staff"`.

#### Security

The lazy check is what stops a stopped sweep from silently granting indefinite trust — a fail-open bug that would be invisible in testing. Clock skew is irrelevant server-side (single clock), but `expiresAt` is always compared server-side, never trusted from a client.

#### Scalability

The hourly sweep is O(users) per hour. At 10 k users that's a 10 MB parse an hour — fine. At 1 M it isn't, and the answer is an expiry index (a sorted `[{ expiresAt, userId, channel }]` list maintained on write), not a database. Noted, not built.

---

### 4.15 Reverification workflows

#### Triggers

| Trigger | Actor | Channels affected | Grace | Notification |
|---|---|---|---|---|
| Expiry (§4.14) | `system` | the expiring channel | 14 days | ladder |
| Suspicious activity (§4.16) | `system` | risk-dependent | 0–7 days | immediate |
| Staff decision (§4.18) | `staff` | staff-selected | staff-set | immediate |
| User-initiated (changed number, lost access, wants to re-run after a name change) | `user` | user-selected | n/a | confirmation |
| Vendor recall (vendor retracts a decision) | `system` | identity + faceMatch | 0 | immediate |
| Policy change (e.g. new regulatory requirement) | `staff` | cohort | 30–90 days | staggered campaign |

#### Data

```json
"reverification": {
  "required": true,
  "channels": ["identity"],
  "reason": "expiry",
  "requestedAt": "2028-08-14T02:00:00.000Z",
  "dueAt": "2028-08-28T02:00:00.000Z",
  "requestedBy": "system"
}
```

`reason` is a closed set: `expiry | risk | staff | user | vendor_recall | policy`. Free text is never stored here.

#### UI/UX

A required reverification produces a persistent (non-dismissible) banner at the top of the Verification Centre and any dashboard, styled `--status-attention-*`. Copy is calibrated to the reason and never accusatory: risk-triggered reads "As a security precaution, we need to confirm it's still you" — **not** "suspicious activity detected on your account", which reads as an accusation to the innocent majority and tips off the guilty minority.

The flow itself is the normal channel flow. On completion the banner clears with a confirmation, and the tier restores — importantly, restoration is *instant* if the check passes, so a legitimate user experiences a two-minute interruption, not a support ticket.

**States**: not required · required-with-grace (capabilities intact, countdown shown) · required-overdue (capabilities gated, prominent banner) · in progress · completed · failed (routes to manual review rather than immediate punishment).

**Accessibility**: the banner is `role="status"`; the *overdue* variant may use `role="alert"` once, on first render only, because it does represent a capability change the user needs to know about immediately.

#### API

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| `POST` | `/api/verification/reverify` | session | `reverifyRequest` (3/24 h) |

Body `{ "channel": "identity" }`. Validates the channel is reverifiable, that the user isn't already mid-flow, and that any cooldown has passed. A user-initiated reverification of a currently-`verified` channel keeps the existing verification live until the new one succeeds — no self-inflicted downgrade.

#### Permissions, security, audit, scalability

Users may reverify their own channels; only staff/system may *require* it. The re-run cannot be used to escape a `flagged` state — a flagged channel is not user-reverifiable, which closes the "fail the check, immediately retry until it passes" loop. Attempt counters persist across reverification cycles for exactly that reason. Audit: `reverification_required`, `reverification_started`, `reverification_completed`, `reverification_overdue`.

---

### 4.16 Suspicious activity detection

#### Existing hooks

Client accounts already carry `safetyStatus` (`"active"`), `riskScore` (`0`), and `reportsCount` (`0`), set at signup, plus `signupIpHash`, `lastIpHash`, `lastIpChangedAt`, and `deviceTokenHash`. Nothing currently *writes* `riskScore` after signup, and the fields exist only on client accounts. This subsystem makes them live and extends them to all roles.

#### Signals

| Signal | Source | Weight | Notes |
|---|---|---|---|
| Report received against the account | `data/reports.json` | +10 (+25 if `priority === "urgent"`) | The reports pipeline already assigns `urgent` to `underage`/`coercion`. |
| `reportsCount` ≥ 3 in 30 days | derived | +20 | Volume, not just severity. |
| OTP failures ≥ 10 in 24 h | `verificationEvents.json` | +5 | Possible takeover attempt. |
| Identity check failed ≥ 2 in 24 h | events | +15 | |
| `document_manipulated` failure | events | +40 | Near-automatic review. |
| Name mismatch on identity | events | +10 | Often innocent (married names) — never auto-punitive. |
| IP country change (via `lastIpChangedAt` + hash change) | user record | +5 | Weak. VPNs are near-universal in this population and are *expected*, not suspicious. |
| Multiple accounts sharing a `deviceTokenHash` | user records | +15 | Real signal, but shared devices exist. |
| Verified phone/email reused across accounts | user records | +25 | Strong. Uniqueness is already enforced at verify time, so this catches sequencing tricks. |
| Passport link fetched at implausible volume | passport counters | +5 | Scraping. |
| Rapid tier climb then immediate profile change | derived | +10 | Classic account-flip pattern. |

Weights decay: each contribution has a half-life of 30 days, so `riskScore` reflects *recent* behaviour and a user isn't permanently marked by one bad week.

#### Thresholds and responses

| Score | Band | Automatic response |
|---:|---|---|
| 0–24 | Normal | None. |
| 25–49 | Watch | Log only. Staff-visible. Nothing user-facing. |
| 50–74 | Elevated | Reverification required for `identity` with a 7-day grace. Notification. Passport auto-set to private until resolved. |
| 75–89 | High | `flags.manualReview = true`, badge suppressed, review queue entry, capabilities frozen (existing sessions survive). |
| 90+ | Critical | Above, plus `safetyStatus` restricted and `clearUserSessions(userId)`. |

**Hard rules.** No automatic *permanent* action at any score — every terminal outcome requires a human. `underage_detected` bypasses scoring entirely and goes straight to critical. Score is never shown to the user, never returned by any user-facing endpoint, and never appears on the passport — publishing it would both aid evasion and be defamatory when wrong.

#### Data

```json
"risk": {
  "score": 32,
  "band": "watch",
  "updatedAt": "2026-08-01T10:00:00.000Z",
  "signals": [
    { "code": "otp_failures", "weight": 5, "at": "2026-08-01T09:12:00.000Z" }
  ]
}
```

`signals` is capped at the most recent 50 entries so a single record can't grow without bound. The existing top-level `riskScore` remains as the flat mirror of `risk.score` so nothing reading it today breaks.

#### UI/UX

Almost entirely invisible to users by design. The only user-facing surfaces are the reverification banner (§4.15) and, at band ≥ high, a restriction notice with an appeal path. Copy is neutral and never explains which signal fired. Staff-facing surfaces are §4.18.

#### API, permissions, security

No public API. `GET /api/admin/verification/risk/:userId` is staff-only (Phase 3, blocked on the admin role). The scoring function runs server-side on event append and on report creation. Signal weights live in a single constant so they can be tuned without touching logic, and tuning changes should themselves be logged in the repo's commit history — a mis-tuned weight silently restricting real providers is the main operational risk here.

#### Audit

`risk_signal_recorded`, `risk_band_changed`, `suspicious_activity_flagged`, `account_restricted` — all `channel: "account"`, `actor: "system"`.

#### Scalability

Scoring reads `verificationEvents.json` and `reports.json`. Recomputing from scratch per signal is O(events); instead, maintain the score incrementally on append and recompute fully only in the hourly sweep. This is the subsystem most likely to force the storage change in §5.

---

### 4.17 Public Trust Profile

#### Purpose

What everyone else sees. Distinct from the Trust Passport (§4.3): the passport is a *link the user shares*; the public trust profile is trust information *embedded in surfaces that already exist* — directory cards, provider profiles, business listings, chat headers.

#### The badge problem

[`directory.js`](../directory.js) currently renders, unconditionally, on every card:

```html
<span class="dir-card-verified-mark">${checkmarkSvg} Verified</span>
```

Every provider in the directory therefore appears verified, including seeded demo entries (`data-demo="true"`, ids prefixed `demo-`). There is also a `#directoryVerified` filter and a `#dir-verified-checkbox` that filter against a `status` field with no real backing. **This is currently decorative and remains so through Phase 1–3.** Phase 4 fixes it. Until then, no new surface should be built that implies the badge is real.

The fix, when it lands:

1. Add `trustLevel` + `tierLabel` to the directory projection (`publicDirectoryBusiness()` and the provider equivalent).
2. Render the mark only when `trustLevel >= 3` **and** `flags.manualReview !== true` **and** `settings.showTierBadge !== false`.
3. Render a *distinct* mark for Level 4 (a filled medallion vs. an outline check) — not a second identical badge.
4. Show nothing at all for Levels 0–2, rather than an "unverified" mark. Negative badging is a punishment mechanic that damages new-provider onboarding and rewards nothing.
5. Wire `#directoryVerified` / `#dir-verified-checkbox` to `trustLevel >= 3`.
6. Demo/seed cards must be visibly labelled as examples or lose the badge entirely.

#### What is public

| Surface | Shows |
|---|---|
| Directory card | Badge (Level ≥ 3), nothing else. |
| Provider/creator public profile | Badge + tier label + "Verified since <Month Year>" + category checkmarks (opt-out per §4.21). |
| Business listing | Badge + "Business verified" + ABN (already public data the business chose to publish). |
| Chat header | Small badge only. |
| Trust Passport | §4.3. |

**Never public, on any surface**: email, phone, `riskScore`, `reportsCount`, `safetyStatus`, review/flag state, failure reason codes, document type/country, `sessionRef`, exact verification timestamps, event history.

#### UI/UX

The badge is a `.dir-card-verified-mark`-style pill using `--status-verified-*` tokens and the existing gold treatment. It must have a **tooltip and an accessible name** explaining what it means ("Identity verified — a government ID was checked by our verification partner"), because an unexplained checkmark is exactly the kind of ambient trust signal that gets over-read. On mobile, tapping the badge opens a small explainer sheet rather than relying on hover.

**States**: no badge (Level 0–2) · verified (Level 3) · verified+ (Level 4) · hidden by owner (no badge, no trace that one was hidden — otherwise hiding becomes a negative signal) · suppressed by review (identical to no badge, for the same reason).

**Accessibility**: the badge is not an icon-only control — it carries visible text ("Verified") plus a screen-reader-only expansion of the tier meaning. Contrast on gold uses `--text-on-gold`.

#### API, permissions, security, audit, scalability

Served by the existing directory/profile endpoints with two added fields. No auth. The suppression rules must be applied **server-side in the projection** — never by hiding a field the client already received. Badge impressions are not logged. The projection reads a field already loaded, so there is no added cost.

---

### 4.18 Staff moderation and verification review tools

> **Spec-only.** There is no `admin` role in real data today. `AGENTS.md` and `TEMPTX_CONTEXT.md` both list Admin as a user type, and `accountRole()` in `server.js` accepts only `["client", "creator", "provider", "business"]`. Building any of this requires **first** introducing a real `admin` role, admitting it to `accountRole()` (or, better, keeping it out of self-signup entirely and provisioning it separately), and gating every route below with `requireRole(request, "admin", user)`. Nothing here ships in Phase 1.

#### Prerequisites, in order

1. An `admin` role that **cannot be self-assigned** — signup must continue to reject it. Provisioning happens out-of-band (a CLI task or a manually edited record), which is appropriate at TEMPTX's scale and avoids building an invite system prematurely.
2. Stronger auth for staff: mandatory recovery-code enrolment plus, ideally, a second factor. Staff accounts can revoke trust and see risk data; a stolen staff session is the worst outcome in this system.
3. A staff action log — either a separate `data/staffActions.json` or `actor: "staff"` rows in `verificationEvents.json` with a hashed `actorRef`. The latter is preferred: one timeline, no join.
4. An explicit decision that staff **cannot** see raw PII — no document images (there are none), no full phone numbers, no addresses. Staff see statuses, reason codes, risk signals, and masked values. This should be enforced by the projection, not by policy.

#### Tools

**Review queue** (§4.19) — the default landing surface.

**Account verification view** — for one user: tier + history, channel statuses with reason codes, risk band and contributing signals, related reports from `reports.json`, and linked accounts (shared `deviceTokenHash`, shared verified contact). Values masked throughout.

**Actions**, each requiring a closed-set reason code and each writing an audit row:

| Action | Effect | Reversible |
|---|---|---|
| Approve flagged channel | `flagged → verified`, recompute tier | yes |
| Reject flagged channel | `flagged → failed`, cooldown applied | yes |
| Revoke channel | `verified → revoked`, recompute tier | yes |
| Require reverification | writes `reverification` (§4.15) | yes |
| Extend expiry grace | pushes `dueAt` | yes |
| Clear risk flag | resets `flags.manualReview`, adds a decay marker | yes |
| Restrict account | `safetyStatus` + `clearUserSessions()` | yes |
| Delete KYC data | vendor deletion + local scrub (§4.21) | **no** |

Only the last is irreversible, and it requires a typed confirmation.

#### UI/UX

`admin-verification.html`, same dark-luxury language but denser: tabular, keyboard-first, `--font-sans` throughout (no display serif — this is a work tool), sticky filter bar, `j`/`k` row navigation, `Enter` to open. Every destructive action is a two-step confirm naming the user and the effect in plain words. States: loading · empty ("Queue clear") · loaded · action-in-flight (row locked, spinner) · conflict (another staff member acted first → row refreshes with a notice rather than silently overwriting).

**Accessibility**: a real `<table>` with `<th scope="col">`, sortable headers as buttons with `aria-sort`, focus visible on rows, all shortcuts also available as buttons, and a live region announcing action outcomes.

#### API (all `requireRole("admin")`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/verification/queue` | Paginated review queue |
| `GET` | `/api/admin/verification/user/:userId` | Full masked verification view |
| `POST` | `/api/admin/verification/decision` | `{ userId, channel, decision, reasonCode }` |
| `POST` | `/api/admin/verification/restrict` | `{ userId, reasonCode }` |
| `GET` | `/api/admin/verification/events` | Cross-user event search |

Rate-limited like everything else — a compromised staff session should not be able to enumerate the whole user base at speed. Two-person review is **required** for the irreversible action and recommended for `restrict`; at TEMPTX's current size this is a policy in the runbook, enforced in code only when staff headcount makes it practical.

#### Audit

Every staff action writes `actor: "staff"` with a hashed `actorRef`, the `reasonCode`, and both status/level transitions. Staff read-access to a user's verification view is **also** logged (`staff_viewed_account`) — the standard control against internal snooping, and the reason staff tooling needs its own audit discipline rather than borrowing the user one.

#### Scalability

Queue reads scan `verificationEvents.json` and `users.json`. Fine for a queue measured in dozens. A queue in the thousands means TEMPTX has a bigger problem than file formats.

---

### 4.19 Manual review queues

> **Spec-only** — depends on §4.18's admin role.

#### Composition

The queue is a *derived view*, not a stored list — anything with `flags.manualReview === true`, or any channel in `status: "flagged"`, or any `underage_detected` event unresolved. Deriving rather than storing means the queue cannot drift out of sync with the underlying state, which is the usual failure mode of a separate queue table.

```json
"flags": {
  "manualReview": true,
  "reviewReason": "identity_document_manipulated",
  "reviewOpenedAt": "2026-08-14T02:05:00.000Z",
  "reviewPriority": "high",
  "assignedTo": null,
  "slaDueAt": "2026-08-16T02:05:00.000Z"
}
```

#### Priority and SLA

Mirroring the existing report triage in `server.js` (`underage`/`coercion` → `urgent`, `privacy`/`scam` → `high`, else `standard`):

| Priority | Sources | SLA |
|---|---|---|
| `urgent` | `underage_detected`, coercion-linked, risk ≥ 90 | 4 hours |
| `high` | `document_manipulated`, risk 75–89, contact reuse | 2 business days |
| `standard` | vendor "requires input", name mismatch, business documents | 5 business days |

`slaDueAt` is computed on entry; overdue items sort first and are visually marked with `--status-attention-*`.

#### Assignment

Optional soft-lock: `assignedTo` (hashed staff ref) with a 30-minute auto-release, so a staff member closing their laptop doesn't strand an urgent item. Locks are advisory — the conflict state in §4.18 handles the race.

#### Outcomes

Approve · reject · request-more-info (moves to a `waiting_on_user` sub-state with its own SLA clock paused) · escalate (priority bump + reassignment) · restrict. Every outcome clears `flags.manualReview` or explicitly re-queues.

#### UI/UX

Queue list: priority chip, SLA countdown (turns `--status-attention-*` when < 25 % remains), channel, reason code, risk band, waiting time. Filters: priority, channel, assignment, overdue. States: empty ("Nothing waiting" — a genuinely good state and should be styled as a calm one, not a blank) · loading · loaded · filtered-empty · error.

#### Security

Queue items reference users by id; PII is masked. Reviewing an item logs the access. Staff cannot review their own account — an explicit check, because it is the cheapest possible insider attack.

---

### 4.20 Verification notifications

#### Phase 1 stub

Phase 1 ships a `notifications.js` module whose entire job is to be replaced:

```js
// notifications.js — Phase 1 stub. Swapping in a real provider means
// implementing send() and nothing else changes.
const send = async ({ channel, to, template, data }) => {
  if (process.env.NOTIFY_PROVIDER === "console" || !process.env.NOTIFY_PROVIDER) {
    // Never log `to` or any code — userId + template only.
    console.log(`[notify] ${channel}:${template}`);
    return { delivered: true, provider: "console" };
  }
  throw new Error(`Unknown NOTIFY_PROVIDER: ${process.env.NOTIFY_PROVIDER}`);
};
module.exports = { send };
```

The OTP code is passed in `data` and never logged. In local development the code is additionally returned in the API response **only** when `NODE_ENV !== "production"` — a footgun that must be guarded by an explicit environment check and a loud comment, since leaking it in production would make the entire OTP mechanism decorative.

#### Triggers and templates

| Template | Channel | Trigger | Priority |
|---|---|---|---|
| `email_otp` | email | `/email/start` | transactional |
| `phone_otp` | sms | `/phone/start` | transactional |
| `email_verified` | email | success | transactional |
| `phone_verified` | email | success | transactional |
| `contact_changed` | email + sms to **old** destination | verified channel replaced | security |
| `identity_started` | email | vendor session created | transactional |
| `identity_verified` | email | webhook success | transactional |
| `identity_failed` | email | webhook failure | transactional |
| `identity_flagged` | email | routed to review | transactional |
| `tier_upgraded` | email | `newTrustLevel > previousTrustLevel` | marketing-ish, opt-outable |
| `expiry_reminder_30` / `_7` / `_0` / `_overdue` | email | sweep (§4.14) | transactional |
| `reverification_required` | email + sms | §4.15 | security |
| `account_restricted` | email | risk ≥ 90 | security |
| `business_verified` / `business_rejected` | email | staff decision | transactional |
| `passport_rotated` | email | user rotates link | security |

**Opt-out policy.** `settings.emailNotifications` already exists on the user record. Security and transactional messages ignore it — you do not get to opt out of "someone changed your phone number". Only `tier_upgraded` and non-urgent nudges respect it. This distinction must be encoded in the template table, not decided at each call site.

#### Templates

Plain-text-first with a light HTML variant. No tracking pixels, no click tracking, no third-party assets — this population is surveillance-sensitive and an email that phones home is a real risk to them. HTML variants use inline styles echoing the dark-luxury palette (email clients don't support custom properties, so this is the one documented place where literal colour values appear — and they must be kept in sync with `style.css` via a comment naming the source token).

Subject lines avoid the words "adult", "escort", "TEMPTX Verification" in ways that would be awkward on a lock screen. Prefer "Your TEMPTX security code" and "Action needed on your TEMPTX account".

SMS is one sentence, includes the code, includes no link (SMS links train users to phish themselves), and identifies TEMPTX.

#### Delivery, retry, security

Deliveries are fire-and-forget with a bounded retry (3 attempts, exponential backoff) held in an in-memory queue — a failed notification must **never** roll back a successful verification. Bounce/complaint handling (Phase 4) marks an email channel `failed` after a hard bounce and prompts re-verification.

Codes appear in exactly one place: the message body. Not logs, not the audit file, not error responses (except the guarded dev case above). Rate limits from §3.4 apply at the send site, so a notification storm is impossible even if a caller loops.

#### Audit

`notification_sent` with `channel` and template name — **never** the destination. Delivery failures log `notification_failed` with a provider error code.

#### Scalability

In-memory retry queue is lost on restart; acceptable for OTPs (the user simply requests another) and marginal for reminders (the sweep re-fires next hour). A durable queue is a §5 concern.

---

### 4.21 User settings for verification

#### Purpose

The controls that make "privacy by default" real rather than aspirational: what's shown, what's shared, and — critically — how KYC data gets deleted.

#### Data

Lives under `user.verification.settings` (kept separate from the existing top-level `user.settings` block so the verification schema stays self-contained and the existing `/api/auth/settings` handler doesn't need to grow):

```json
"settings": {
  "passportVisibility": "public",     // "public" | "unlisted" | "private"
  "showTierBadge": true,
  "showChannelDetail": true,
  "showVerifiedSince": true,
  "allowDirectoryTrustFilter": true,
  "securityAlerts": true              // read-only true; shown for transparency, cannot be disabled
}
```

Defaults for a **new** user are the private-leaning set: `passportVisibility: "private"`, `showTierBadge: true` (the badge is the earned reward; hiding it by default would gut the incentive), `showChannelDetail: false`, `showVerifiedSince: false`. Users opt *into* detail.

#### UI/UX

A "Privacy & visibility" section inside the Verification Centre, plus a link from [`settings.html`](../settings.html). Each toggle carries a live preview of exactly what a visitor would see — a mini Trust Passport card that updates as toggles flip. This turns an abstract privacy control into something concrete, and is worth the implementation cost.

**States**: default · modified (unsaved changes bar, "Save" / "Discard") · saving · saved (confirmation via `role="status"`) · error · locked (a setting forced by staff during review — shown disabled with the reason, never silently ignored).

**Accessibility**: real `<input type="checkbox">` with `<label>`, grouped in a `<fieldset>` with `<legend>`; toggle switches are CSS on top of real checkboxes, never `<div role="switch">` reimplementations. Preview updates announce once on a debounce, not per keystroke.

#### KYC data deletion / right to be forgotten

The most sensitive control on the page, and the one that justifies the whole vendor architecture.

**What TEMPTX can delete locally**: `identity`, `age`, `faceMatch` channel objects including `sessionRef`, `documentType`, `documentCountry`. Instantly, on request.

**What requires the vendor**: everything real — the document images, selfie, DOB, name. `kycProvider.requestDeletion(sessionRef)` is called; the outcome is recorded.

**What is retained regardless, and why**: the audit rows in `verificationEvents.json`. They contain no PII by construction (§3.3) — only a `userId`, a channel, statuses, and timestamps — and they are the record that TEMPTX performed required checks. Retaining a PII-free audit trail while deleting the underlying evidence is the correct and defensible position, and the fact that the log was *designed* to be PII-free from day one is what makes it available.

**Flow**: request → clear explanation of consequences (tier drops to 2, payouts stop, badge disappears) → typed confirmation → local scrub inside `usersQueue` → tier recomputed → vendor deletion requested → `kyc_data_deleted` event → confirmation email → 30-day cooldown before identity verification can be re-attempted (prevents delete/re-verify churn as a way to reset failure counters — a real gaming vector).

Account deletion (the existing `DELETE /api/auth/delete`) must be extended to call `kycProvider.requestDeletion` for any stored `sessionRef` before removing the record. **Otherwise deleting a TEMPTX account silently orphans a passport scan at a third party forever** — the single worst latent bug this system could ship, and worth calling out in the account-deletion code with a comment.

**Retention defaults**: verification outcomes live as long as the account; audit events are retained 7 years (financial/regulatory posture) then aggregated; vendor-side data follows the vendor's configured retention, which should be set to the **minimum** the vendor offers.

#### API

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| `GET` | `/api/verification/settings` | session | `verificationStatus` |
| `PATCH` | `/api/verification/settings` | session | `verificationStatus` |
| `POST` | `/api/verification/kyc/erase` | session + password re-entry | `reverifyRequest` |

`PATCH` accepts only the known keys, coerces to boolean/enum, and ignores unknown fields — the same defensive shape as the existing `/api/auth/settings` handler.

#### Permissions, security, audit

Users control their own settings only. Erasure requires password re-entry via `verifyPassword(password, user)` and invalidates other sessions. Staff can force `passportVisibility: "private"` during review but can never make a private passport public. Audit: `settings_changed` (with changed key names, not values), `passport_visibility_changed`, `kyc_data_deleted`.

#### Scalability

One nested object. Nil.

---

## 5. Scalability and migration path

Flat JSON + `makeQueue()` is the right architecture for TEMPTX today: 32 users, one process, no ops burden, no dependency surface, and a data store you can read with `cat`. This section is a set of tripwires, not a plan.

**What breaks first, in order:**

| # | Limit | Symptom | Fix without leaving flat files |
|---|---|---|---|
| 1 | `readUsers()` parses the whole file per request | Latency climbs with user count; the Verification Centre feels slow | In-memory `Map<userId, user>` index, rebuilt on write. The serial queue already guarantees single-writer, so this is safe and small. ~2 k users. |
| 2 | `verificationEvents.json` read-per-append | Every event costs a full-file parse | NDJSON + `fs.appendFileSync`; reads stay whole-file until they too hurt. ~50 k events. |
| 3 | History pagination scans the whole log | Slow history page | Monthly rotation `verificationEvents-YYYY-MM.json` + manifest. ~200 k events. |
| 4 | Hourly expiry sweep parses everything | CPU spike on the hour | Sorted expiry index maintained on write. ~20 k users. |
| 5 | Risk scoring cross-references reports + events | Slowest path in the system | Incremental scoring on append; full recompute only in the sweep. |
| 6 | **Single process** | OTP `Map`s, session `Map`, rate-limit `Map`s, and the write queue are all per-process — horizontal scaling silently breaks correctness | **This is the real wall.** Not fixable inside the current architecture. |

**Tripwire 6 is the one that matters.** The moment TEMPTX needs a second Node process — for availability, not just load — the in-memory `Map`s stop being a clever simplification and start being a correctness bug: a user's OTP would live on one process and their verify request could land on another. Everything upstream of that can be solved with indexes.

**If and when the migration happens**, the shape is roughly:

- `users.json` → a `users` table with `verification` as a JSON/JSONB column, so the schema in §3.1 transfers verbatim and this document stays accurate.
- `verificationEvents.json` → an append-only `verification_events` table, indexed on `(user_id, created_at)`, `(event)`, `(created_at)`. Already the exact shape defined in §3.3.
- OTP `Map`s → a TTL store (Redis, or a short-lived table with an expiry sweep).
- Session `Map` → the same store.
- `makeQueue()` → row-level transactions; the queue disappears entirely.
- `atomicWrite()` → disappears.

**What this spec does deliberately to keep that door open**: cursor-based pagination on history (§4.12); a channel-status enum that is already a small closed set; `trustLevel` as a derived pure function, so it can be a computed column or a materialised view; the vendor abstraction object, so identity data never lands in TEMPTX storage in the first place and never needs migrating; and an audit log with a fixed field whitelist that maps 1:1 onto columns.

**What this spec does not do**: prescribe the migration, add an ORM, add a dependency, or shape today's code around a database that does not exist. `npm run check` remains the gate.

---

## 6. Phased rollout

### Phase 1 — Contact verification foundation *(done / in progress)*

**Scope**: §4.5 email, §4.6 phone, §4.4 trust levels 0–2, §4.1 Verification Centre v1, §4.2 tracker (extending `.setup-checklist`), §4.12 history v1, §4.13 `GET /api/verification/status` with polling, §3.3 audit log, §4.20 `notifications.js` console stub.

**Delivers**: `user.verification.{email,phone}`, `user.trustLevel`, `user.trustLevelUpdatedAt`, `data/verificationEvents.json`, `verification-centre.html` + `.js`, five `/api/verification/*` routes, five new `limits` keys, a `.verification-*` CSS block.

**Explicitly out of scope**: identity, age, face match, business channel, admin anything, real notification delivery, and **wiring the directory badge** — the `dir-card-verified-mark` in `directory.js` stays hardcoded through this phase.

**Exit criteria**: a client with no email can add and verify one; a provider can verify both channels and see Level 2; legacy user records without a `verification` key load and render correctly; rate limits return the standard 429 body; every transition appears in `verificationEvents.json`; `npm run check` clean.

**Risks**: schema change to `users.json` and changes to verification logic are both protected areas under `AGENTS.md` — sign-off required before merge. Client accounts gaining an email address is a genuine model change (clients are `clientId`-identified today) and touches account recovery semantics; review that interaction specifically.

---

### Phase 2 — Identity assurance via KYC vendor

**Scope**: §4.8 identity, §4.7 age (derived), §4.9 face match, §4.4 tiers 3–4, §4.10 role requirements + payout gate, §4.11 business ABN checksum + submission, §4.14 expiry policy (fields written, sweep not yet enforcing).

**Delivers**: the `kycProvider` abstraction, session-creation and webhook routes, the reconciliation sweep, pre-flight UI, the `identity`/`age`/`faceMatch`/`business` channel objects, tier medallion states 3–4.

**Blocked on**: vendor selection (§4.8 criteria — start with whether the vendor's terms permit adult-industry customers), `KYC_API_KEY` / `KYC_WEBHOOK_SECRET` provisioning, and a legal/privacy review of the data table in §4.8.

**Exit criteria**: a provider reaches Level 4 end-to-end on a vendor sandbox; a dropped webhook is recovered by the sweep; a forged webhook is rejected; no vendor PII appears in `users.json`, `verificationEvents.json`, or logs (verify by grepping a full test run's output); the under-18 path restricts correctly.

**Risks**: highest-complexity phase and the only one with an external dependency. The webhook handler is the single most security-sensitive piece of code in the system.

---

### Phase 3 — Lifecycle, risk, and staff tooling

**Scope**: §4.14 expiry enforcement + reminder ladder, §4.15 reverification, §4.16 suspicious activity detection, §4.18 staff tools, §4.19 review queues, §4.11 ABR registry lookup + document review.

**Blocked on**: **introducing a real `admin` role** — the gating prerequisite for §4.18 and §4.19, with the four prerequisites listed there (non-self-assignable role, stronger staff auth, staff action logging, no-raw-PII projection).

**Delivers**: TTL constants + lazy checks + hourly sweep, `reverification` object, `risk` object with signal weights and bands, `admin-verification.html`, five `/api/admin/verification/*` routes.

**Exit criteria**: an expired identity downgrades a tier and grace works; a risk band change triggers reverification without any permanent automatic action; staff can approve/reject a flagged channel with a reason code and both the decision and the staff *view* are audited; staff cannot review their own account.

**Risks**: mis-tuned risk weights restricting legitimate providers. Ship in shadow mode first — compute and log bands for two weeks with **no** automatic responses, review the distribution, then enable enforcement.

---

### Phase 4 — Public trust surfaces, notifications, settings

**Scope**: §4.17 public trust profile *including the real directory badge fix*, §4.3 Trust Passport, §4.20 real notification delivery, §4.21 settings + KYC erasure, §4.13 optional SSE layer, §4.1/§4.12 richer Centre and history.

**Delivers**: `trust.html` + `trust.js`, `passport` object and routes, `directory.js` badge wired to `trustLevel >= 3` with demo cards handled, `notifications.js` swapped to a real provider with the full template table, `verification.settings` + erasure flow, account-deletion extended to call `kycProvider.requestDeletion`.

**Exit criteria**: no badge renders without backing data anywhere on the site; a passport link can be rotated and the old link 404s identically to a private one; a security notification cannot be opted out of; KYC erasure removes local data, calls the vendor, drops the tier, and leaves the PII-free audit trail intact; deleting an account triggers vendor deletion.

**Risks**: the directory badge change is *visible to every visitor* and will remove the checkmark from most providers overnight. Sequence it deliberately: notify providers, give a verification window, then flip. Doing it silently would look like a bug and generate exactly the support load the premium framing is meant to avoid.

---

### Beyond Phase 4 (not scheduled)

Trust-level-based directory ranking · verified-only messaging filters for providers · cross-platform trust import · a Level 5 professional/business assurance tier · trust-weighted safety report triage · SSE or WebSocket real-time · the §5 database migration.

---

## Appendix A — Route index

| Phase | Method | Path | Auth | Rate limit key |
|---|---|---|---|---|
| 1 | `GET` | `/api/verification/status` | session | `verificationStatus` |
| 1 | `POST` | `/api/verification/email/start` | session | `verifyEmailStart` |
| 1 | `POST` | `/api/verification/email/verify` | session | `verifyEmailCheck` |
| 1 | `POST` | `/api/verification/phone/start` | session | `verifyPhoneStart` |
| 1 | `POST` | `/api/verification/phone/verify` | session | `verifyPhoneCheck` |
| 1 | `GET` | `/api/verification/history` | session | `verificationHistory` |
| 2 | `POST` | `/api/verification/identity/session` | session | `identitySession` |
| 2 | `GET` | `/api/verification/identity/status` | session | `verificationStatus` |
| 2 | `POST` | `/api/verification/webhooks/kyc` | HMAC signature | vendor-side |
| 2 | `POST` | `/api/verification/age/session` | session | `ageSession` |
| 2 | `POST` | `/api/verification/business/abn` | session + `business` | `businessSubmit` |
| 2 | `POST` | `/api/verification/business/submit` | session + `business` | `businessSubmit` |
| 2 | `GET` | `/api/verification/business/status` | session + `business` | `verificationStatus` |
| 3 | `POST` | `/api/verification/reverify` | session | `reverifyRequest` |
| 3 | `GET` | `/api/admin/verification/queue` | session + `admin` | admin bucket |
| 3 | `GET` | `/api/admin/verification/user/:userId` | session + `admin` | admin bucket |
| 3 | `POST` | `/api/admin/verification/decision` | session + `admin` | admin bucket |
| 3 | `POST` | `/api/admin/verification/restrict` | session + `admin` | admin bucket |
| 3 | `GET` | `/api/admin/verification/events` | session + `admin` | admin bucket |
| 4 | `GET` | `/api/trust/:ref` | none | `trustPassport` |
| 4 | `POST` | `/api/verification/passport` | session | `verificationStatus` |
| 4 | `PATCH` | `/api/verification/passport` | session | `verificationStatus` |
| 4 | `GET` | `/api/verification/settings` | session | `verificationStatus` |
| 4 | `PATCH` | `/api/verification/settings` | session | `verificationStatus` |
| 4 | `POST` | `/api/verification/kyc/erase` | session + password | `reverifyRequest` |

All state-changing routes inherit the existing origin/CSRF check in `server.js`, except `/api/verification/webhooks/kyc`, which substitutes HMAC signature verification (§4.8).

## Appendix B — Event taxonomy

Closed set. Adding a value means updating this table.

| `event` | Channels | Typical actor |
|---|---|---|
| `otp_sent` | email, phone | user |
| `otp_failed` | email, phone | user |
| `otp_expired` | email, phone | system |
| `channel_started` | identity, age, faceMatch, business | user |
| `channel_verified` | all | user, system, staff |
| `channel_failed` | all | user, system |
| `channel_flagged` | all | system, staff |
| `channel_expired` | identity, faceMatch, business | system |
| `channel_revoked` | all | user, staff |
| `channel_changed` | email, phone | user |
| `trust_level_recomputed` | account | system |
| `webhook_received` | identity, age, faceMatch | system |
| `webhook_mismatch` | identity, age, faceMatch | system |
| `reconciliation_resolved` | identity, age, faceMatch | system |
| `underage_detected` | age | system |
| `reverification_required` | any | system, staff |
| `reverification_started` | any | user |
| `reverification_completed` | any | user |
| `reverification_overdue` | any | system |
| `expiry_grace_extended` | any | staff |
| `risk_signal_recorded` | account | system |
| `risk_band_changed` | account | system |
| `suspicious_activity_flagged` | account | system |
| `account_restricted` | account | system, staff |
| `staff_viewed_account` | account | staff |
| `passport_created` | account | user |
| `passport_rotated` | account | user |
| `passport_visibility_changed` | account | user, staff |
| `settings_changed` | account | user |
| `kyc_data_deleted` | identity | user, staff |
| `notification_sent` | any | system |
| `notification_failed` | any | system |

## Appendix C — Glossary

| Term | Meaning |
|---|---|
| **Channel** | One verifiable fact: email, phone, identity, age, faceMatch, business. |
| **Trust Level** | Integer 0–4 derived from channel statuses. Never set directly. |
| **Tier label** | The public wording of a trust level ("Fully Verified"). Contractual. |
| **Trust Passport** | A shareable, user-controlled public summary at `trust.html?ref=…`. |
| **Public Trust Profile** | Trust signals embedded in existing surfaces (directory cards, profiles). |
| **KYC vendor** | The third party that holds documents and performs identity/age/face checks. |
| **`sessionRef`** | Opaque vendor handle — TEMPTX's only pointer into vendor custody. |
| **Grace period** | Window after expiry where capabilities persist but the badge is suppressed. |
| **Band** | Risk bucket: normal / watch / elevated / high / critical. |
| **Sweep** | Periodic `setInterval` reconciling expiry, pending vendor sessions, and risk. |
| **Serial queue** | `makeQueue()` — the single-writer guarantee for each data file. |
