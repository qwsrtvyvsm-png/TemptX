// Pluggable identity/age verification provider — the third Trust Level channel
// alongside email and phone (see the TRUST_LEVEL_LABELS comment in server.js:
// "3-4 are reserved for future identity/face-match tiers so the integer space
// needs no migration when those ship" — this module is that tier).
//
// Design: TemptX never receives or stores a raw ID image or biometric template.
// The frontend opens the provider's own hosted verification flow (this is how
// Yoti, Persona, GBG etc. actually work — a redirect/iframe to *their* UI, not a
// file upload through our server), and the provider calls back to
// /api/verification/identity/webhook with a pass/fail result and a reference id.
// We store only: provider name, external reference, status, and a timestamp.
//
// Provider is selected with IDENTITY_VERIFICATION_PROVIDER:
//   "none" (default) — verification is honestly reported as not yet available.
//     Nothing pretends to work; the UI tells the member this channel isn't on yet.
//   "dev"  — local/testing only. Instantly "verifies" without calling anyone,
//     mirroring the existing PAYMENT_PROVIDER=dev pattern already in server.js.
//     Must never be set in production.
//   "yoti" / "persona" — real integrations. startVerification() below has the
//     request shape stubbed and commented; it needs to be finished against the
//     chosen vendor's actual current API docs and a real account before it will
//     work. Do not treat this file as "wired up" until that's done and tested.

const crypto = require("node:crypto");

const PROVIDER = (process.env.IDENTITY_VERIFICATION_PROVIDER || "none").trim().toLowerCase();
const API_KEY = process.env.IDENTITY_VERIFICATION_API_KEY || "";
const API_SECRET = process.env.IDENTITY_VERIFICATION_API_SECRET || "";
const WEBHOOK_SECRET = process.env.IDENTITY_VERIFICATION_WEBHOOK_SECRET || "";

const isConfigured = () => {
  if (PROVIDER === "none") return false;
  if (PROVIDER === "dev") return true;
  return Boolean(API_KEY && API_SECRET);
};

// Starts a verification session for a user. Returns either:
//   { ok: true, redirectUrl, externalReference }  — frontend opens redirectUrl
//   { ok: false, reason: "not_configured" }       — honest "not available yet"
//   { ok: false, reason: "provider_error", detail }
async function startVerification({ userId, returnUrl }) {
  if (PROVIDER === "none") {
    return { ok: false, reason: "not_configured" };
  }

  if (PROVIDER === "dev") {
    // Instant, no external call — for local testing of the trust-level/UI
    // plumbing only. Never enable in production (mirrors PAYMENT_PROVIDER=dev).
    const externalReference = `dev_${crypto.randomUUID()}`;
    return { ok: true, redirectUrl: null, externalReference, devInstantPass: true };
  }

  if (PROVIDER === "yoti" || PROVIDER === "persona") {
    if (!API_KEY || !API_SECRET) {
      return { ok: false, reason: "provider_error", detail: "Missing API credentials for configured provider." };
    }

    // TODO before this goes live: replace this stub with a real call to the
    // provider's session-creation endpoint using their current API docs and
    // your account's credentials. The shape below is illustrative only — it
    // has not been tested against a live Yoti or Persona account.
    //
    // Example (illustrative, not verified against current API docs):
    //   const session = await fetch("https://api.<provider>.com/v1/verification-sessions", {
    //     method: "POST",
    //     headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    //     body: JSON.stringify({ referenceId: userId, redirectUri: returnUrl })
    //   }).then((r) => r.json());
    //   return { ok: true, redirectUrl: session.url, externalReference: session.id };

    return {
      ok: false,
      reason: "provider_error",
      detail: `${PROVIDER} integration is scaffolded but not finished — see the TODO in lib/identity-verification.js.`
    };
  }

  return { ok: false, reason: "provider_error", detail: `Unknown IDENTITY_VERIFICATION_PROVIDER "${PROVIDER}".` };
}

// Verifies a webhook's authenticity. Most providers sign their webhook body
// with a shared secret (HMAC-SHA256 over the raw payload is the common shape);
// adjust to match the chosen provider's actual signature scheme before relying
// on this in production — this is a reasonable generic default, not a
// guarantee it matches Yoti's or Persona's specific implementation.
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (PROVIDER === "dev") return true; // no external calls in dev mode
  if (!WEBHOOK_SECRET || !signatureHeader) return false;
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(signatureHeader).replace(/^sha256=/, ""), "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Normalises a provider's webhook payload into { externalReference, status }.
// status is "verified" | "failed". Adjust field names to match the real
// provider payload once integrated — this assumes a generic shape.
function parseWebhookResult(body) {
  const externalReference = String(body?.externalReference || body?.reference || body?.id || "").trim();
  const rawStatus = String(body?.status || body?.result || "").toLowerCase();
  const status = ["verified", "approved", "pass", "passed"].includes(rawStatus) ? "verified" : "failed";
  return { externalReference, status };
}

module.exports = {
  PROVIDER,
  isConfigured,
  startVerification,
  verifyWebhookSignature,
  parseWebhookResult
};
