// Pluggable outbound notification senders for verification codes.
// Phase 1: console-log stub only, zero new dependencies. Swap the body of
// sendEmail/sendSms for a real provider call (SMTP/SES/Twilio HTTPS API) later —
// call signature and return shape stay stable so call sites in server.js don't change.

const sendEmail = async ({ to, subject, code }) => {
  console.log(`[notifications:email] to=${to} subject="${subject}" code=${code}`);
  return { ok: true, provider: "console-stub" };
};

const sendSms = async ({ to, code }) => {
  console.log(`[notifications:sms] to=${to} code=${code}`);
  return { ok: true, provider: "console-stub" };
};

module.exports = { sendEmail, sendSms };
