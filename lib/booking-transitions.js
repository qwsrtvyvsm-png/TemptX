// Single source of truth for booking status transitions — imported by both the
// PATCH /api/bookings/:id/status route and the background sweep job in server.js,
// so the two can never drift out of sync on what moves are legal.
//
// Protected file (same tier as auth/verification/billing in AGENTS.md) — a bad
// transition here silently corrupts booking integrity.

const TRANSITIONS = {
  REQUESTED:              { allowedTo: ["CONFIRMED", "DECLINED", "EXPIRED"], actor: ["provider", "system"] },
  CONFIRMED:              { allowedTo: ["AWAITING_DEPOSIT", "SCHEDULED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_PROVIDER"], actor: ["provider", "client", "system"] },
  AWAITING_DEPOSIT:       { allowedTo: ["SCHEDULED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_PROVIDER", "EXPIRED"], actor: ["client", "provider", "system"] },
  SCHEDULED:              { allowedTo: ["AWAITING_CHECKIN", "CANCELLED_BY_CLIENT", "CANCELLED_BY_PROVIDER"], actor: ["client", "provider", "system"] },
  AWAITING_CHECKIN:       { allowedTo: ["COMPLETED", "NO_SHOW"], actor: ["provider", "system"] },
  COMPLETED:              { allowedTo: ["DISPUTE_WINDOW"], actor: ["system"] },
  DISPUTE_WINDOW:         { allowedTo: ["CLOSED", "DISPUTED"], actor: ["system", "client", "provider"] },
  DISPUTED:               { allowedTo: ["CLOSED"], actor: ["admin"] },
  NO_SHOW:                { allowedTo: ["DISPUTED", "CLOSED"], actor: ["client", "provider", "system"] },
  DECLINED:               { allowedTo: [], actor: [] },
  EXPIRED:                { allowedTo: [], actor: [] },
  CANCELLED_BY_CLIENT:    { allowedTo: [], actor: [] },
  CANCELLED_BY_PROVIDER:  { allowedTo: [], actor: [] },
  CLOSED:                 { allowedTo: [], actor: [] }
};

function canTransition(fromStatus, toStatus, actorRole) {
  const rule = TRANSITIONS[fromStatus];
  if (!rule) return { ok: false, reason: `Unknown status: ${fromStatus}` };
  if (!rule.allowedTo.includes(toStatus)) {
    return { ok: false, reason: `Cannot go from ${fromStatus} to ${toStatus}` };
  }
  if (!rule.actor.includes(actorRole)) {
    return { ok: false, reason: `${actorRole} not permitted to make this transition` };
  }
  return { ok: true };
}

module.exports = { TRANSITIONS, canTransition };
