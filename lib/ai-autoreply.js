// Pluggable AI auto-reply provider for provider <-> client messaging.
// Mirrors the lib/identity-verification.js pattern already in this codebase:
// a provider is selected by env var, "none" is the honest default (nothing
// pretends to work), and real integrations are isolated behind one function
// so server.js never needs to know which vendor is configured.
//
// What this module is for: when a provider is away (asleep, offline, or has
// marked themselves unavailable) and a client sends a message, this generates
// a reply *grounded only in that provider's own saved data* — their rates,
// booking settings, and their own written house rules/boundaries. It never
// invents services, prices, or availability the provider hasn't stated.
//
// What this module will NEVER do, regardless of provider:
//   - Confirm, cancel, or alter a booking's status itself. It can only draft
//     the *content* of a booking request for the existing /api/bookings flow
//     to create as a normal REQUESTED (or provider's own instant-book, if
//     that's a setting the provider already turned on) booking. Every
//     safeguard already built into bookings.json / booking-transitions.js
//     (response windows, deposits, conflict checks) still applies untouched.
//   - Discuss anything beyond what's needed to schedule: no sexual content,
//     no negotiating rates, no sharing real-world contact details or the
//     provider's address.
//   - Pretend to be a human. Every AI-sent message is labelled as automated
//     in the conversation and the client can always ask to wait for the
//     provider directly.
//
// Provider is selected with AI_AUTOREPLY_PROVIDER:
//   "none" (default) — auto-reply honestly reports as not configured.
//   "dev"  — local/testing only. Deterministic templated reply, no external
//     call. Mirrors IDENTITY_VERIFICATION_PROVIDER=dev and PAYMENT_PROVIDER=dev.
//   "anthropic" — real integration via the Claude Messages API using
//     ANTHROPIC_API_KEY. Model is configurable via ANTHROPIC_AUTOREPLY_MODEL
//     (defaults to a small/fast model since this runs on every inbound
//     message from an away provider).

const PROVIDER = (process.env.AI_AUTOREPLY_PROVIDER || "none").trim().toLowerCase();
const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ANTHROPIC_AUTOREPLY_MODEL || "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";

const isConfigured = () => {
  if (PROVIDER === "none") return false;
  if (PROVIDER === "dev") return true;
  if (PROVIDER === "anthropic") return Boolean(API_KEY);
  return false;
};

// Hard word/behaviour boundary baked into every system prompt, independent of
// whatever the provider writes in their own houseRules field — a provider's
// own text can add restrictions, never remove these.
const BASE_RULES = [
  "You are an automated scheduling assistant replying on behalf of an adult-industry service provider on TEMPTX while they are away.",
  "You are NOT the provider. Never imply you are a real person or the provider themselves — if asked, say plainly you're their automated assistant.",
  "Only state rates, services, availability windows, or policies that appear in the PROVIDER FACTS block below. Never invent, estimate, or guess any of these.",
  "Never discuss sexual acts, explicit content, or anything beyond what is needed to schedule a session (date, time, duration, incall/outcall, and the provider's stated rate for that combination).",
  "Never share a real address, personal phone number, email, or social media handle. Location details are only exchanged through the platform's existing booking flow after a booking is confirmed.",
  "Never quote, discount, or negotiate a rate that differs from PROVIDER FACTS.",
  "If the client wants to schedule, gather: date, time, duration (1 hour / 2 hours / overnight), and incall or outcall — then say you'll pass it on as a booking request for the provider to confirm. Do not say the booking is confirmed.",
  "If the client asks something you don't have facts for (special requests, questions about the provider personally, anything ambiguous or that makes you unsure), say the provider will follow up personally — do not guess.",
  "Keep replies short (2-4 sentences), warm, and professional.",
];

const buildSystemPrompt = ({ provider, settings }) => {
  const facts = [
    `Working name: ${provider.workingName || provider.profile?.displayName || "the provider"}`,
    provider.profile?.rates
      ? `Rates on file: ${JSON.stringify(provider.profile.rates)}`
      : "Rates on file: none saved — do not quote any figure.",
    `Accepts request-to-book: ${settings.bookingSettings?.acceptsRequestToBook ? "yes" : "no"}`,
    `Accepts instant-book: ${settings.bookingSettings?.acceptsInstantBook ? "yes" : "no"}`,
    `Deposit required: ${settings.bookingSettings?.depositRequired ? `yes (${settings.bookingSettings.depositType === "percentage" ? settings.bookingSettings.depositAmount + "%" : "$" + settings.bookingSettings.depositAmount + " AUD"})` : "no"}`,
    settings.autoReplySettings?.houseRules
      ? `Provider's own house rules / boundaries, follow these exactly: ${settings.autoReplySettings.houseRules}`
      : null,
  ].filter(Boolean);

  return `${BASE_RULES.join("\n")}\n\nPROVIDER FACTS:\n${facts.map((f) => `- ${f}`).join("\n")}`;
};

const toAnthropicHistory = (messages) =>
  messages.slice(-12).map((m) => ({
    role: m.senderRole === "client" ? "user" : "assistant",
    content: String(m.body || "").slice(0, 2000),
  }));

// Returns:
//   { ok: true, replyText, intent: "schedule" | "general" }
//   { ok: false, reason: "not_configured" | "provider_error", detail }
async function generateReply({ provider, settings, messages }) {
  if (PROVIDER === "none") {
    return { ok: false, reason: "not_configured" };
  }

  if (PROVIDER === "dev") {
    const last = messages[messages.length - 1]?.body || "";
    const looksLikeBookingAsk = /\b(book|available|free|tonight|tomorrow|time|when)\b/i.test(last);
    return {
      ok: true,
      intent: looksLikeBookingAsk ? "schedule" : "general",
      replyText: looksLikeBookingAsk
        ? "Thanks for reaching out! I'm an automated assistant — the provider is away right now. If you'd like to book, let me know your preferred date, time, duration, and whether you'd like incall or outcall, and I'll pass it on as a request for them to confirm."
        : "Thanks for your message! I'm an automated assistant filling in while the provider is away — they'll follow up personally soon. In the meantime, let me know if you'd like to check availability for a booking.",
    };
  }

  if (PROVIDER === "anthropic") {
    if (!API_KEY) {
      return { ok: false, reason: "provider_error", detail: "ANTHROPIC_API_KEY not set." };
    }

    try {
      const system = buildSystemPrompt({ provider, settings });
      const body = JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system,
        messages: toAnthropicHistory(messages),
      });

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { ok: false, reason: "provider_error", detail: `Anthropic API ${res.status}: ${detail.slice(0, 300)}` };
      }

      const data = await res.json();
      const replyText = (data.content || [])
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      if (!replyText) {
        return { ok: false, reason: "provider_error", detail: "Empty response from model." };
      }

      const lastClientMessage = [...messages].reverse().find((m) => m.senderRole === "client")?.body || "";
      const intent = /\b(book|available|free|tonight|tomorrow|schedule|time|when)\b/i.test(lastClientMessage)
        ? "schedule"
        : "general";

      return { ok: true, replyText, intent };
    } catch (error) {
      return { ok: false, reason: "provider_error", detail: error.message || String(error) };
    }
  }

  return { ok: false, reason: "provider_error", detail: `Unknown AI_AUTOREPLY_PROVIDER "${PROVIDER}".` };
}

module.exports = { PROVIDER, isConfigured, generateReply };
