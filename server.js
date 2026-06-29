const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const host = "127.0.0.1";
const port = Number(process.env.PORT || 5510);
const root = __dirname;
const dataDirectory = path.join(root, "data");
const usersFile = path.join(dataDirectory, "users.json");
const reportsFile = path.join(dataDirectory, "reports.json");
const serverSecretFile = path.join(dataDirectory, "server-secret");
const sessions = new Map();
const resetTokens = new Map();
const reportRateLimits = new Map();
const authRateLimits = new Map();
const clientIdFailures = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

fs.mkdirSync(dataDirectory, { recursive: true });
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, "[]\n");
}
if (!fs.existsSync(reportsFile)) {
  fs.writeFileSync(reportsFile, "[]\n");
}
if (!fs.existsSync(serverSecretFile)) {
  fs.writeFileSync(serverSecretFile, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
}
const serverSecret = fs.readFileSync(serverSecretFile, "utf8").trim();

const readUsers = () => JSON.parse(fs.readFileSync(usersFile, "utf8"));
const writeUsers = (users) => fs.writeFileSync(usersFile, `${JSON.stringify(users, null, 2)}\n`);
const readReports = () => JSON.parse(fs.readFileSync(reportsFile, "utf8"));
const writeReports = (reports) => fs.writeFileSync(reportsFile, `${JSON.stringify(reports, null, 2)}\n`);

const json = (response, status, payload, headers = {}) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    ...headers
  });
  response.end(JSON.stringify(payload));
};

const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
    request.on("error", reject);
  });

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
};

const verifyPassword = (password, user) => {
  const candidate = Buffer.from(hashPassword(password, user.salt).hash, "hex");
  const saved = Buffer.from(user.passwordHash, "hex");
  return candidate.length === saved.length && crypto.timingSafeEqual(candidate, saved);
};

const validPassword = (password) =>
  typeof password === "string" &&
  password.length >= 12 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password);

const normaliseEmail = (email) => String(email || "").trim().toLowerCase();
const normaliseClientId = (clientId) => String(clientId || "").trim().toUpperCase();
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const accountRole = (role) => (["client", "creator", "provider"].includes(role) ? role : null);
const isEmailAccount = (role) => role === "provider" || role === "creator";
const workerCategories = new Set([
  "escorts",
  "fetisher",
  "couples",
  "swingers",
  "content creators",
  "companions"
]);
const hashPrivateValue = (value) =>
  crypto.createHmac("sha256", serverSecret).update(String(value)).digest("hex");

const cleanText = (value, maxLength) =>
  String(value || "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, maxLength);

const makeRecoveryCode = () => {
  const raw = crypto.randomBytes(9).toString("hex").toUpperCase();
  return `TXK-${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}`;
};

const rateLimit = (store, key, limit, windowMs) => {
  const now = Date.now();
  const attempts = (store.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (attempts.length >= limit) return false;
  attempts.push(now);
  store.set(key, attempts);
  return true;
};

const requireAuthRateLimit = (request, response, action, identifier = "") => {
  const key = `${action}:${hashPrivateValue(`${getClientIp(request)}:${identifier}`)}`;
  const limits = {
    signup: [5, 60 * 60 * 1000],
    login: [10, 15 * 60 * 1000],
    forgot: [5, 60 * 60 * 1000],
    reset: [5, 60 * 60 * 1000]
  };
  const [limit, windowMs] = limits[action];
  if (rateLimit(authRateLimits, key, limit, windowMs)) return true;
  json(response, 429, { error: "Too many attempts. Wait before trying again." });
  return false;
};

const CLIENT_ID_LOCKOUT_LIMIT = 5;
const CLIENT_ID_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

const isClientIdLocked = (clientId) => {
  const now = Date.now();
  const attempts = (clientIdFailures.get(clientId) || []).filter((t) => now - t < CLIENT_ID_LOCKOUT_WINDOW_MS);
  clientIdFailures.set(clientId, attempts);
  return attempts.length >= CLIENT_ID_LOCKOUT_LIMIT;
};

const recordClientIdFailure = (clientId) => {
  const now = Date.now();
  const attempts = (clientIdFailures.get(clientId) || []).filter((t) => now - t < CLIENT_ID_LOCKOUT_WINDOW_MS);
  attempts.push(now);
  clientIdFailures.set(clientId, attempts);
};

const clearClientIdFailures = (clientId) => {
  clientIdFailures.delete(clientId);
};

const getCookie = (request, name) => {
  const cookie = request.headers.cookie || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] || null;
};

const getClientIp = (request) => {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = request.headers["x-forwarded-for"];
    if (forwarded) return String(forwarded).split(",")[0].trim();
  }
  return request.socket.remoteAddress || "unknown";
};

const secureCookie = process.env.NODE_ENV === "production" ? "; Secure" : "";
const deviceCookie = (token) =>
  `temptx_device=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24 * 365 * 2}${secureCookie}`;

const getDeviceToken = (request) => getCookie(request, "temptx_device");

const makeClientId = (users) => {
  let clientId;
  do {
    clientId = `TX-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  } while (users.some((user) => user.clientId === clientId));
  return clientId;
};

const DIRECTORY_OPTIONS = {
  locations: [
    "Adelaide",
    "Brisbane",
    "Canberra",
    "Darwin",
    "Gold Coast",
    "Hobart",
    "Melbourne",
    "Newcastle",
    "Perth",
    "Sydney"
  ],
  services: [
    "Anal play",
    "Anal sex",
    "ATM",
    "Bi twin",
    "BJ",
    "BBBJ",
    "BBBJTC",
    "BLS",
    "B & D",
    "BDSM",
    "Bondage",
    "Brazilian",
    "BS",
    "CBT",
    "CIM",
    "CIMWS",
    "CBJ",
    "COB",
    "COF",
    "Costumes and role play",
    "Couples",
    "DATY",
    "DATO",
    "DFK",
    "Dinner companion",
    "Dirty talk",
    "DP",
    "DDP",
    "DT",
    "Doggy style",
    "Erotic sensual massage",
    "Facial",
    "FE",
    "Fetish",
    "Filming",
    "Fire and ice",
    "Fisting",
    "FK",
    "Foot fetish",
    "French",
    "FS",
    "Gagging",
    "GFE",
    "Greek",
    "GS",
    "Happy ending",
    "HJ",
    "Italian",
    "LK",
    "MFF",
    "MMF",
    "Multiple positions",
    "Masturbation",
    "Mutual masturbation",
    "Mutual French",
    "Mutual natural French",
    "MSOG",
    "Natural bush",
    "OWO",
    "Overnight stays",
    "Photography",
    "Prostate massage",
    "PSE",
    "Role play",
    "Rimming",
    "Sex toy",
    "Snowballing",
    "Spanish",
    "Spanking",
    "Spit roasting",
    "Squirting",
    "Strap on",
    "Strip tease",
    "Tea bagging",
    "Toy show",
    "Tromboning",
    "TTM",
    "Water sports"
  ],
  attributes: ["Independent", "Agency", "Incall", "Outcall", "Touring", "Discreet", "LGBTQ+ friendly"]
};

const cleanDirectorySelections = (values, allowedValues) => {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => allowedValues.includes(value)))].slice(0, 80);
};

const publicUser = (user) => ({
  id: user.id,
  role: user.role,
  email: user.email || null,
  clientId: user.clientId || null,
  workingName: user.workingName || null,
  gender: user.gender || null,
  accountCategory: user.accountCategory || null,
  settings: {
    displayName: user.settings?.displayName || "",
    directMessages: user.settings?.directMessages !== false,
    groupInvites: user.settings?.groupInvites !== false,
    messagePreviews: user.settings?.messagePreviews !== false,
    activityStatus: user.settings?.activityStatus !== false,
    emailNotifications: Boolean(user.settings?.emailNotifications),
    profileVisible: user.settings?.profileVisible !== false,
    locations: cleanDirectorySelections(user.settings?.locations, DIRECTORY_OPTIONS.locations),
    services: cleanDirectorySelections(user.settings?.services, DIRECTORY_OPTIONS.services),
    attributes: cleanDirectorySelections(user.settings?.attributes, DIRECTORY_OPTIONS.attributes)
  }
});

const createSession = (user) => {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    userId: user.id,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7
  });
  return token;
};

const clearUserSessions = (userId) => {
  sessions.forEach((session, token) => {
    if (session.userId === userId) sessions.delete(token);
  });
};

const clearUserResetTokens = (userId) => {
  resetTokens.forEach((record, token) => {
    if (record.userId === userId) resetTokens.delete(token);
  });
};

const sessionCookie = (token, remember = true) =>
  `temptx_session=${token}; HttpOnly; SameSite=Strict; Path=/${
    remember ? `; Max-Age=${60 * 60 * 24 * 7}` : ""
  }${secureCookie}`;

const getSessionToken = (request) => getCookie(request, "temptx_session");

const getAuthenticatedUser = (request) => {
  const token = getSessionToken(request);
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return readUsers().find((user) => user.id === session.userId) || null;
};

const handleApi = async (request, response, pathname) => {
  try {
    if (pathname === "/api/reports" && request.method === "POST") {
      const clientKey = hashPrivateValue(getClientIp(request));
      const now = Date.now();
      const recentReports = (reportRateLimits.get(clientKey) || []).filter(
        (timestamp) => now - timestamp < 60 * 60 * 1000
      );
      if (recentReports.length >= 5) {
        return json(response, 429, {
          error: "Too many reports were submitted from this connection. Try again later."
        });
      }

      const body = await readJsonBody(request);
      const allowedTypes = new Set(["profile", "conversation", "account", "technical", "other"]);
      const allowedCategories = new Set(["harassment", "coercion", "scam", "privacy", "underage", "other"]);
      const type = cleanText(body.type, 40);
      const category = cleanText(body.category, 40);
      const details = cleanText(body.details, 2000);
      const contact = normaliseEmail(body.contact);

      if (!allowedTypes.has(type) || !allowedCategories.has(category)) {
        return json(response, 400, { error: "Choose a valid report type and concern." });
      }
      if (details.length < 20) {
        return json(response, 400, { error: "Please provide at least 20 characters about the concern." });
      }
      if (contact && !validEmail(contact)) {
        return json(response, 400, { error: "Enter a valid contact email or leave it blank." });
      }

      const reference = `TXR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const accessCode = crypto.randomBytes(6).toString("hex").toUpperCase();
      const priority =
        category === "underage" || category === "coercion"
          ? "urgent"
          : category === "privacy" || category === "scam"
          ? "high"
          : "standard";
      const reports = readReports();
      reports.push({
        id: crypto.randomUUID(),
        reference,
        type,
        category,
        subjectReference: cleanText(body.reference, 120),
        details,
        contact: contact || null,
        reporterIpHash: clientKey,
        accessCodeHash: hashPrivateValue(accessCode),
        priority,
        status: "received",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      writeReports(reports);
      recentReports.push(now);
      reportRateLimits.set(clientKey, recentReports);

      return json(response, 201, {
        message: "Safety report received.",
        reference,
        accessCode
      });
    }

    if (pathname === "/api/reports/status" && request.method === "POST") {
      const clientKey = hashPrivateValue(`status:${getClientIp(request)}`);
      if (!rateLimit(reportRateLimits, clientKey, 20, 60 * 60 * 1000)) {
        return json(response, 429, { error: "Too many status checks. Try again later." });
      }
      const body = await readJsonBody(request);
      const reference = cleanText(body.reference, 20).toUpperCase();
      const accessCodeHash = hashPrivateValue(cleanText(body.accessCode, 30).toUpperCase());
      const report = readReports().find(
        (item) => item.reference === reference && item.accessCodeHash === accessCodeHash
      );
      if (!report) {
        return json(response, 404, { error: "Those private report details do not match." });
      }
      return json(response, 200, {
        report: {
          reference: report.reference,
          status: report.status,
          priority: report.priority,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt
        }
      });
    }

    if (pathname === "/api/auth/signup" && request.method === "POST") {
      const body = await readJsonBody(request);
      const role = accountRole(body.role);
      const password = String(body.password || "");
      const users = readUsers();

      if (!requireAuthRateLimit(request, response, "signup", role || "unknown")) return;
      if (!role) return json(response, 400, { error: "Choose a client, creator, or provider account." });
      if (body.acceptedPolicies !== true) {
        return json(response, 400, { error: "Confirm the adult-only Terms and Privacy Notice to create an account." });
      }
      if (!validPassword(password)) {
        return json(response, 400, {
          error: "Use at least 12 characters with upper and lowercase letters and a number."
        });
      }

      const credentials = hashPassword(password);
      const recoveryCode = makeRecoveryCode();
      const user = {
        id: crypto.randomUUID(),
        role,
        passwordHash: credentials.hash,
        salt: credentials.salt,
        recoveryCodeHash: hashPrivateValue(recoveryCode),
        policiesAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      if (isEmailAccount(role)) {
        const email = normaliseEmail(body.email);
        const workingName = cleanText(body.workingName, 80);
        const gender = cleanText(body.gender, 60);
        const accountCategory = cleanText(body.accountCategory, 40).toLowerCase();
        if (!validEmail(email)) return json(response, 400, { error: "Enter a valid email address." });
        if (!workingName) return json(response, 400, { error: "Enter your working name." });
        if (!gender) return json(response, 400, { error: "Enter your gender." });
        if (!workerCategories.has(accountCategory)) {
          return json(response, 400, { error: "Choose a valid provider or creator category." });
        }
        if (users.some((item) => item.email === email)) {
          return json(response, 409, { error: "A TEMPTX account already uses that email." });
        }
        user.email = email;
        user.workingName = workingName;
        user.gender = gender;
        user.accountCategory = accountCategory;
      } else {
        user.clientId = makeClientId(users);
        user.safetyStatus = "active";
        user.riskScore = 0;
        user.reportsCount = 0;
        const deviceToken = crypto.randomBytes(32).toString("hex");
        user.deviceTokenHash = hashPrivateValue(deviceToken);
        user.signupIpHash = hashPrivateValue(getClientIp(request));
        user.lastIpHash = user.signupIpHash;
        user.lastIpChangedAt = null;
        user.pendingDeviceToken = deviceToken;
      }

      const pendingDeviceToken = user.pendingDeviceToken;
      delete user.pendingDeviceToken;
      users.push(user);
      writeUsers(users);
      const token = createSession(user);
      return json(
        response,
        201,
        {
          message: "Account created.",
          user: publicUser(user),
          clientId: user.clientId || null,
          recoveryCode
        },
        {
          "Set-Cookie":
            role === "client"
              ? [sessionCookie(token), deviceCookie(pendingDeviceToken)]
              : sessionCookie(token)
        }
      );
    }

    if (pathname === "/api/auth/login" && request.method === "POST") {
      const body = await readJsonBody(request);
      const role = accountRole(body.role);
      const identifier = isEmailAccount(role) ? normaliseEmail(body.email) : normaliseClientId(body.clientId);
      if (!requireAuthRateLimit(request, response, "login", `${role}:${identifier}`)) return;

      if (role === "client" && identifier && isClientIdLocked(identifier)) {
        return json(response, 401, { error: "Those login details do not match an account." });
      }

      const users = readUsers();
      const user =
        isEmailAccount(role)
          ? users.find((item) => item.role === role && item.email === normaliseEmail(body.email))
          : users.find((item) => item.role === role && item.clientId === normaliseClientId(body.clientId));

      if (!user || !verifyPassword(String(body.password || ""), user)) {
        if (role === "client" && identifier) recordClientIdFailure(identifier);
        return json(response, 401, { error: "Those login details do not match an account." });
      }

      if (role === "client" && identifier) clearClientIdFailures(identifier);

      const wasDeactivated = Boolean(user.deactivatedAt);
      let ipChanged = false;
      if (role === "client") {
        const deviceToken = getDeviceToken(request);
        if (!deviceToken || hashPrivateValue(deviceToken) !== user.deviceTokenHash) {
          return json(response, 403, {
            error: "This client account is assigned to another device. Use account recovery on the original device."
          });
        }

        const currentIpHash = hashPrivateValue(getClientIp(request));
        ipChanged = currentIpHash !== user.lastIpHash;
        if (ipChanged) {
          user.lastIpHash = currentIpHash;
          user.lastIpChangedAt = new Date().toISOString();
          writeUsers(users);
        }
      }

      if (wasDeactivated) {
        user.deactivatedAt = null;
        user.reactivatedAt = new Date().toISOString();
        writeUsers(users);
      }

      const token = createSession(user);
      return json(response, 200, {
        message: wasDeactivated
          ? "Your account has been reactivated. Welcome back."
          : ipChanged
          ? "Welcome back. Your network address has changed, but this trusted device was recognised."
          : "Welcome back.",
        user: publicUser(user),
        ipChanged
      }, {
        "Set-Cookie": sessionCookie(token, Boolean(body.remember))
      });
    }

    if (pathname === "/api/auth/forgot" && request.method === "POST") {
      const body = await readJsonBody(request);
      const role = accountRole(body.role);
      const identifier = isEmailAccount(role) ? normaliseEmail(body.email) : normaliseClientId(body.clientId);
      if (!requireAuthRateLimit(request, response, "forgot", `${role}:${identifier}`)) return;
      const users = readUsers();
      const user =
        isEmailAccount(role)
          ? users.find((item) => item.role === role && item.email === normaliseEmail(body.email))
          : users.find((item) => item.role === role && item.clientId === normaliseClientId(body.clientId));

      if (!user) {
        return json(response, 400, { error: "The account or recovery key could not be verified." });
      }
      const recoveryCode = cleanText(body.recoveryCode, 30).toUpperCase();
      if (!user.recoveryCodeHash || hashPrivateValue(recoveryCode) !== user.recoveryCodeHash) {
        return json(response, 400, {
          error: "The account or recovery key could not be verified. Use the account-recovery report if the key is unavailable."
        });
      }

      const resetToken = crypto.randomBytes(24).toString("hex");
      resetTokens.set(resetToken, {
        userId: user.id,
        expiresAt: Date.now() + 1000 * 60 * 15
      });

      return json(response, 200, {
        message: "Recovery key verified. Choose a new password.",
        resetToken
      });
    }

    if (pathname === "/api/auth/reset" && request.method === "POST") {
      const body = await readJsonBody(request);
      if (!requireAuthRateLimit(request, response, "reset")) return;
      const record = resetTokens.get(String(body.resetToken || ""));
      if (!record || record.expiresAt < Date.now()) {
        return json(response, 400, { error: "That reset code is invalid or has expired." });
      }
      if (!validPassword(String(body.password || ""))) {
        return json(response, 400, {
          error: "Use at least 12 characters with upper and lowercase letters and a number."
        });
      }

      const users = readUsers();
      const user = users.find((item) => item.id === record.userId);
      if (!user) return json(response, 404, { error: "Account not found." });

      const credentials = hashPassword(body.password);
      user.passwordHash = credentials.hash;
      user.salt = credentials.salt;
      user.passwordUpdatedAt = new Date().toISOString();
      writeUsers(users);
      resetTokens.delete(body.resetToken);
      clearUserSessions(user.id);
      return json(response, 200, { message: "Password updated. You can now log in." });
    }

    if (pathname === "/api/auth/me" && request.method === "GET") {
      const user = getAuthenticatedUser(request);
      if (!user) return json(response, 401, { error: "Not signed in." });
      return json(response, 200, { user: publicUser(user) });
    }

    if (pathname === "/api/directory/providers" && request.method === "GET") {
      const providers = readUsers()
        .filter(
          (user) =>
            user.role === "provider" &&
            !user.deactivatedAt &&
            user.settings?.profileVisible !== false &&
            String(user.settings?.displayName || "").trim()
        )
        .map((user) => ({
          id: user.id,
          name: String(user.settings.displayName).trim().slice(0, 50),
          locations: cleanDirectorySelections(user.settings?.locations, DIRECTORY_OPTIONS.locations),
          services: cleanDirectorySelections(user.settings?.services, DIRECTORY_OPTIONS.services),
          attributes: cleanDirectorySelections(user.settings?.attributes, DIRECTORY_OPTIONS.attributes)
        }));

      return json(response, 200, {
        providers,
        options: DIRECTORY_OPTIONS
      });
    }

    if (pathname === "/api/auth/settings" && request.method === "PATCH") {
      const authenticatedUser = getAuthenticatedUser(request);
      if (!authenticatedUser) return json(response, 401, { error: "Sign in to change settings." });

      const body = await readJsonBody(request);
      const users = readUsers();
      const user = users.find((item) => item.id === authenticatedUser.id);
      if (!user) return json(response, 404, { error: "Account not found." });

      user.settings = {
        displayName: String(body.displayName || "").trim().slice(0, 50),
        directMessages: body.directMessages !== false,
        groupInvites: body.groupInvites !== false,
        messagePreviews: body.messagePreviews !== false,
        activityStatus: body.activityStatus !== false,
        emailNotifications: Boolean(body.emailNotifications),
        profileVisible: user.role === "provider" ? body.profileVisible !== false : true,
        locations:
          user.role === "provider"
            ? cleanDirectorySelections(body.locations, DIRECTORY_OPTIONS.locations)
            : [],
        services:
          user.role === "provider"
            ? cleanDirectorySelections(body.services, DIRECTORY_OPTIONS.services)
            : [],
        attributes:
          user.role === "provider"
            ? cleanDirectorySelections(body.attributes, DIRECTORY_OPTIONS.attributes)
            : []
      };
      user.settingsUpdatedAt = new Date().toISOString();
      writeUsers(users);

      return json(response, 200, {
        message: "Settings saved.",
        user: publicUser(user)
      });
    }

    if (pathname === "/api/auth/deactivate" && request.method === "POST") {
      const authenticatedUser = getAuthenticatedUser(request);
      if (!authenticatedUser) return json(response, 401, { error: "Sign in to deactivate your account." });

      const body = await readJsonBody(request);
      const users = readUsers();
      const user = users.find((item) => item.id === authenticatedUser.id);
      if (!user || !verifyPassword(String(body.password || ""), user)) {
        return json(response, 401, { error: "Your password is incorrect." });
      }

      user.deactivatedAt = new Date().toISOString();
      writeUsers(users);
      clearUserSessions(user.id);
      clearUserResetTokens(user.id);

      return json(response, 200, {
        message: "Account deactivated. Logging in again will reactivate it."
      }, {
        "Set-Cookie": `temptx_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}`
      });
    }

    if (pathname === "/api/auth/delete" && request.method === "DELETE") {
      const authenticatedUser = getAuthenticatedUser(request);
      if (!authenticatedUser) return json(response, 401, { error: "Sign in to delete your account." });

      const body = await readJsonBody(request);
      const users = readUsers();
      const user = users.find((item) => item.id === authenticatedUser.id);
      if (!user || !verifyPassword(String(body.password || ""), user)) {
        return json(response, 401, { error: "Your password is incorrect." });
      }
      if (String(body.confirmation || "").trim().toUpperCase() !== "DELETE") {
        return json(response, 400, { error: "Type DELETE to confirm permanent account removal." });
      }

      writeUsers(users.filter((item) => item.id !== user.id));
      clearUserSessions(user.id);
      clearUserResetTokens(user.id);

      return json(response, 200, { message: "Account permanently deleted." }, {
        "Set-Cookie": [
          `temptx_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}`,
          `temptx_device=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}`
        ]
      });
    }

    if (pathname === "/api/auth/logout" && request.method === "POST") {
      const token = getSessionToken(request);
      if (token) sessions.delete(token);
      return json(response, 200, { message: "Logged out." }, {
        "Set-Cookie": `temptx_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}`
      });
    }

    return json(response, 404, { error: "API route not found." });
  } catch (error) {
    console.error(error);
    return json(response, 500, { error: "Something went wrong on the server." });
  }
};

const serveStatic = (request, response, pathname) => {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = path.resolve(root, `.${decodedPath}`);

  if (!filePath.startsWith(`${root}${path.sep}`) || filePath.startsWith(dataDirectory)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return response.end("Not found");
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    });
    fs.createReadStream(filePath).pipe(response);
  });
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
  if (url.pathname.startsWith("/api/")) {
    if (["POST", "PATCH", "DELETE"].includes(request.method)) {
      const origin = request.headers.origin;
      const expectedOrigin = `${url.protocol}//${url.host}`;
      if (origin && origin !== expectedOrigin) {
        return json(response, 403, { error: "Cross-site request blocked." });
      }
    }
    return handleApi(request, response, url.pathname);
  }

  if (url.pathname === "/chat.html" || url.pathname === "/chat") {
    const user = getAuthenticatedUser(request);
    if (!user) {
      const next = encodeURIComponent(`${url.pathname}${url.search}`);
      response.writeHead(302, {
        Location: `/auth.html?mode=login&next=${next}`,
        "Cache-Control": "no-store"
      });
      return response.end();
    }
  }

  return serveStatic(request, response, url.pathname);
});

server.listen(port, host, () => {
  console.log(`TEMPTX running at http://${host}:${port}`);
});
