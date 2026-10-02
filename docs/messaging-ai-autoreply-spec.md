# TEMPTX — Provider Messaging & AI Auto-Reply Assistant

**Design Specification**

| | |
|---|---|
| **Status** | Implemented (v1) — see [Phase 2](#7-deferred-phase-2) for deferred scope |
| **Owner** | TEMPTX Platform |
| **Applies to** | `server.js`, `lib/ai-autoreply.js`, `data/conversations.json`, `data/messages.json`, `chat.html`/`chat.js`, `provider-dashboard.html`/`.js`/`.css`, `profile-public.js` |
| **Last revised** | 2026-10-03 |

> This feature does **not** touch any protected area in [`AGENTS.md`](../AGENTS.md) (Authentication, Verification, Billing, User data schema) with one deliberate exception: it reuses `lib/booking-transitions.js`'s existing state machine read-only, by creating bookings through the same `createBookingRecord` path human clients use — it never adds a new transition or bypasses one.

---

## 1. Problem statement

### 1.1 The request, as given

> "Create a provider booking system for client messaging. When a client messages, [a provider] may lose money, time and sanity. By having this AI generated service replying for you, you can go to sleep knowing you'll have work upon waking up."

### 1.2 Root cause (not the surface symptom)

Before this change, `chat.html` / `chat.js` was a **fully client-side mock**. Conversations and messages lived only in `localStorage`, seeded from static sample data. There was no server endpoint for messages at all. The practical consequence:

- A client "messaging" a provider wrote to *their own browser's* local storage only.
- The provider never received it — not in their dashboard, not on another device, not ever — regardless of whether they were online, offline, asleep, or staffing an AI.

So the actual problem wasn't "providers need an AI to answer for them" — it was **"messages don't reach providers at all."** An AI bolted onto a fake transport would have produced a demo that looked right and did nothing. This spec therefore builds the real transport first (§3), then the AI assistant on top of it (§4), matching the user's own standing instruction to address root causes in the backend/data layer rather than the symptom.

### 1.3 Goals

- A client message reaches the provider's account, persistently, on every device, whether the provider is online or not.
- A provider can optionally delegate replies to an AI assistant while away, under rules they control.
- The AI is never allowed to commit the provider to anything irreversible on its own.
- The feature is additive: it introduces no new protected-area risk and no new state-machine states.

### 1.4 Non-goals (v1)

- The AI does not parse free text into a structured booking automatically (see [§7](#7-deferred-phase-2)).
- No real-time transport (websockets/SSE) — refresh-on-open, matching the rest of the app's polling-free, simple-HTTP style.
- No multi-provider group messaging changes (group chat remains the existing mock feature, untouched).

---

## 2. System overview

### 2.1 Architecture context

Same architecture as the rest of TEMPTX: vanilla HTML/CSS/JS frontend, single-file `server.js`, JSON flat files in `data/`, atomic writes (`.tmp` + rename), one serial `makeQueue()` per file.

### 2.2 File map

| File | Role |
|---|---|
| `data/conversations.json` | One row per client↔provider thread |
| `data/messages.json` | One row per message, linked by `conversationId` |
| `lib/ai-autoreply.js` | Pluggable AI provider (mirrors `lib/identity-verification.js`'s `none`/`dev`/real pattern) |
| `server.js` | Conversation/message routes, auto-reply trigger + sweep job, autoreply-settings routes |
| `chat.html` / `chat.js` | Client+provider messaging UI, now backed by the API instead of `localStorage` |
| `provider-dashboard.html/.js/.css` | New "Messages & Assistant" tab: away toggle, assistant settings, approval queue |
| `profile-public.js` | "Message now" / "Start chat" CTAs deep-link to a real conversation |

### 2.3 Inherited conventions followed

- Atomic writes + per-file serial queues (`conversationsQueue`, `messagesQueue`), identical pattern to `bookingsQueue`.
- Settings view/patch pair (`autoReplySettingsView` / `cleanAutoReplySettingsPatch`) mirrors the existing `bookingSettingsView` / `cleanBookingSettingsPatch`.
- Pluggable provider pattern (`AI_AUTOREPLY_PROVIDER=none|dev|anthropic`) copies `IDENTITY_VERIFICATION_PROVIDER`'s shape: `none` honestly reports "not configured" rather than faking a reply.
- `?v=` cache-busting bump on changed static assets.
- New routes follow the existing `if (pathname === "/api/..." && request.method === "...")` style; rate limiting added for message sends (`messageRateLimits`), matching `authRateLimits`/`reportRateLimits`.

---

## 3. Real messaging backend (the fix for the root cause)

### 3.1 Data model

**`conversations.json`**

```
{
  id, providerId, clientId,
  aiTurnCount,              // consecutive AI replies since a human (provider) last spoke
  needsProviderAttention,   // true once aiTurnCount hits the provider's cap
  pendingAiDraft,           // { text, createdAt } | null — draft mode only
  providerUnreadCount, clientUnreadCount,
  createdAt, updatedAt, lastMessageAt
}
```

**`messages.json`**

```
{ id, conversationId, senderId, senderRole: "client"|"provider"|"ai_assistant", body, aiGenerated, createdAt }
```

A conversation is unique per `(providerId, clientId)` pair — starting a new one with the same provider reopens the existing thread rather than forking it.

### 3.2 Routes

| Route | Purpose |
|---|---|
| `GET /api/conversations` | Role-aware list (client sees providers, provider sees clients), with preview, unread count, `needsProviderAttention`, `hasPendingAiDraft` |
| `POST /api/conversations` | Client starts/reopens a thread with a provider (blocked if that provider has blocked the client) |
| `GET /api/conversations/:id/messages` | Fetch + mark-read for the requesting side |
| `POST /api/conversations/:id/messages` | Send a message; rate-limited; triggers the auto-reply check for client-sent messages |
| `POST /api/conversations/:id/ai-draft/approve` | Provider approves (optionally edits) a pending AI draft, sending it |
| `POST /api/conversations/:id/ai-draft/discard` | Provider discards a pending AI draft without sending |

### 3.3 Frontend wiring

`chat.js` now tags each real thread `apiBacked: true` and:

- On load, a signed-in client/provider's real conversations are fetched and merged in ahead of the sample/mock "advertiser" conversation (`syncRealConversations`), which is filtered out once real data exists.
- `chat.html?provider=<id>` (reached from `profile-public.js`'s "Message now"/"Start chat" buttons, now wired to the real provider ID instead of the old hardcoded mock conversation) starts or reopens a real conversation and opens it directly.
- Sending a message in an `apiBacked` thread posts to the real endpoint; any AI auto-reply returned in the same response is appended immediately, so the client sees the assistant respond in-thread exactly like a human would.
- Non-`apiBacked` conversations (sample data, group chat) are untouched — same `localStorage` mock behaviour as before.

---

## 4. AI auto-reply assistant

### 4.1 Provider settings (`user.autoReplySettings`)

| Field | Meaning |
|---|---|
| `enabled` | Master on/off |
| `mode` | `"draft"` (assistant prepares a reply, provider approves) or `"auto_send"` (sent immediately) |
| `awayMode` | `"manual"` (only while explicitly marked away), `"delayed"` (steps in after `respondWithinMinutes` of silence), or `"always"` |
| `manualAwayUntil` | Timestamp set by the dashboard's "Going to sleep" button; cleared by "I'm back" |
| `respondWithinMinutes` | Delay threshold for `"delayed"` mode |
| `allowAutoBookingRequests` | Reserved for Phase 2 ([§7](#7-deferred-phase-2)) — currently unused by v1's reply generator |
| `houseRules` | Free text injected into the AI's system prompt (boundaries, screening requirements, things it must never say) |
| `maxAiTurnsPerConversation` | Consecutive AI replies allowed before the thread is flagged `needsProviderAttention` and handed back |

Dashboard surface: new **Messages & Assistant** tab (`provider-dashboard.html`) — away-status toggle, the settings form above, and a "Needs your reply" queue listing conversations with a pending draft or that hit the turn cap.

### 4.2 Trigger logic

`maybeTriggerAutoReply({ conversationId, providerId })` runs synchronously after a client sends a message:

1. Skip if `!isProviderSyncAway(settings)` — i.e. assistant is off, or `awayMode` conditions (manual-away window / always-on) aren't met. (`"delayed"` mode is handled separately by the sweep job, §4.3, since it depends on elapsed time rather than the moment of send.)
2. `claimAutoReplyTurn` — queue-guarded increment of `aiTurnCount`; if it would exceed `maxAiTurnsPerConversation`, set `needsProviderAttention` and stop (hand back to the human).
3. `performAutoReply` calls `lib/ai-autoreply.js#generateReply`, passing the provider's rates/booking settings/house rules and recent message history.
4. In `auto_send` mode, the reply is appended immediately as an `ai_assistant` message and returned to the client's request (so it appears in the same round-trip). In `draft` mode, it's stored as `conversation.pendingAiDraft` for the provider to approve/edit/discard from the dashboard queue — nothing is sent to the client yet.

### 4.3 Background sweep (`runAutoReplySweep`)

A `setInterval` job (every 2 minutes, matching the existing `runBookingSweep` convention) scans conversations where the **last message is from the client** and more than `respondWithinMinutes` has elapsed, for providers in `"delayed"` away mode, and runs the same trigger path. This is what lets a provider say "step in if I haven't answered in 20 minutes" without the AI racing to reply to every message instantly.

### 4.4 Safety rails

These are deliberate, not incidental:

- **The AI never auto-confirms a booking.** Any booking the AI assistant originates goes through the same `createBookingRecord` function used for human-submitted requests, but with `useInstantBook` forced to `false` regardless of the provider's instant-book setting — it always lands in `REQUESTED`, same as any other client request awaiting the provider's own action. There is no code path by which an AI reply advances the booking state machine past that point.
- **Hard-coded base rules** (`BASE_RULES` in `lib/ai-autoreply.js`) are prepended to every system prompt regardless of a provider's `houseRules`, and cannot be overridden by provider input: never confirm or finalize a booking, never discuss sexual services/content, never share a real address or personal contact details, never negotiate rates, keep replies short. House rules can *add* constraints, not remove these.
- **Turn cap hand-back.** A conversation can't be AI-only forever — `maxAiTurnsPerConversation` forces a return to the human provider, surfaced in the dashboard queue.
- **Transparency in-thread.** Messages sent by the assistant are tagged `senderRole: "ai_assistant"`; the client-facing UI labels them "Automated assistant" and the provider's own view labels them "Your assistant (sent automatically)" — nobody sees an AI reply presented as the provider typing live.
- **Honest non-configuration.** With `AI_AUTOREPLY_PROVIDER=none` (the default), `generateReply` returns `{ ok: false, reason: "not_configured" }` rather than fabricating a reply — mirrors `lib/identity-verification.js`'s "none" behaviour. The dashboard shows this plainly ("not connected on this server yet") rather than silently no-opping.

### 4.5 Provider configuration

```
AI_AUTOREPLY_PROVIDER=none|dev|anthropic   # default: none
ANTHROPIC_API_KEY=...                       # required if provider=anthropic
ANTHROPIC_AUTOREPLY_MODEL=claude-haiku-4-5-20251001  # default
```

`dev` mode returns a deterministic templated reply with no external call — useful for local testing of the full flow (turn counting, draft/auto-send, sweep job) without needing an API key.

---

## 5. What changed, file by file

See the commit on `feature/provider-ai-autoreply-messaging` for the full diff. Summary:

- **New:** `lib/ai-autoreply.js`
- **Modified:** `server.js` (conversations/messages data layer + queues, booking-creation refactor into `createBookingRecord`, full messaging/auto-reply route section, sweep job, `autoReplySettings` added to `/api/auth/me`)
- **Modified:** `chat.js` (real-data wiring, see §3.3), `profile-public.js` (CTA href fix)
- **Modified:** `provider-dashboard.html/.js/.css` (new "Messages & Assistant" tab)
- **Modified:** `package.json` (`node --check lib/ai-autoreply.js` added to `check`), `.env.example`, `AGENTS.md` (data-file table)

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| AI says something inappropriate/unsafe | Hard-coded `BASE_RULES`, short replies, no booking/sexual-content/contact-info authority |
| AI accidentally commits provider to a bad booking | Forced `REQUESTED` status, identical to human-submitted flow — provider always confirms |
| Provider forgets it's running and clients feel misled | Messages are labelled as automated to both sides |
| Runaway AI-only conversation | `maxAiTurnsPerConversation` hands back to the provider |
| No AI provider configured but feature "enabled" | `generateReply` reports `not_configured` honestly; dashboard surfaces this |

---

## 7. Deferred (Phase 2)

Not built in v1, by design — flagged here so it isn't silently forgotten:

- **Structured booking auto-creation from free text.** Having the AI parse a client's message ("book me Friday 8pm, 2 hours") directly into a booking request. Deferred because unreliable NLP extraction risks malformed/unwanted booking requests reaching a provider's queue; `allowAutoBookingRequests` exists in the schema as a placeholder for this but is currently unused by the reply generator.
- **Real-time delivery** (websocket/SSE push) instead of fetch-on-open/poll.
- **Per-client AI tone/persona customization** beyond `houseRules` free text.
