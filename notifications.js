// Pluggable outbound notification senders for verification codes.
// Phase 1: console-log stub only, zero new dependencies. Swap the body of
// sendEmail/sendSms for a real provider call (SMTP/SES/Twilio HTTPS API) later —
// call signature and return shape stay stable so call sites in server.js don't change.

const sendEmail = async ({ to, subject, code }) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[notifications:email] to=${to} subject="${subject}" code=${code}`);
  } else {
    console.log(`[notifications:email] queued subject="${subject}"`);
  }
  return { ok: true, provider: "console-stub" };
};

const sendSms = async ({ to, code }) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[notifications:sms] to=${to} code=${code}`);
  } else {
    console.log("[notifications:sms] queued");
  }
  return { ok: true, provider: "console-stub" };
};

module.exports = { sendEmail, sendSms };
