require("dotenv").config();
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
const membershipsFile = path.join(dataDirectory, "memberships.json");
const subscriptionsFile = path.join(dataDirectory, "subscriptions.json");
const transactionsFile = path.join(dataDirectory, "transactions.json");
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
if (!fs.existsSync(membershipsFile)) {
  fs.writeFileSync(membershipsFile, "[]\n");
}

if (!fs.existsSync(subscriptionsFile)) {
  fs.writeFileSync(subscriptionsFile, "[]\n");
}

if (!fs.existsSync(transactionsFile)) {
  fs.writeFileSync(transactionsFile, "[]\n");
}
let serverSecret;
if (process.env.SERVER_SECRET) {
  serverSecret = process.env.SERVER_SECRET.trim();
} else if (fs.existsSync(serverSecretFile)) {
  console.warn("[WARN] SERVER_SECRET env var not set — falling back to data/server-secret file. Set SERVER_SECRET in production.");
  serverSecret = fs.readFileSync(serverSecretFile, "utf8").trim();
} else {
  serverSecret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(serverSecretFile, serverSecret, { mode: 0o600 });
  console.warn("[WARN] No SERVER_SECRET env var or secret file found. Generated a new secret and saved to data/server-secret. Set SERVER_SECRET env var before deploying to production.");
}

// Write to a .tmp file then rename — rename(2) is atomic on POSIX, preventing
// readers from ever seeing a half-written file if the process crashes mid-write.
const atomicWrite = (filePath, data) => {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
};

// Serial write queue — guarantees that only one read-modify-write runs at a time,
// eliminating the last-writer-wins race that occurs when two concurrent requests
// each read the same snapshot, modify it independently, then both flush.
const makeQueue = () => {
  let tail = Promise.resolve();
  return (task) => {
    const result = tail.then(task);
    tail = result.catch(() => {});
    return result;
  };
};

const readUsers = () => JSON.parse(fs.readFileSync(usersFile, "utf8"));
const writeUsers = (users) => atomicWrite(usersFile, `${JSON.stringify(users, null, 2)}\n`);
const readReports = () => JSON.parse(fs.readFileSync(reportsFile, "utf8"));
const writeReports = (reports) => atomicWrite(reportsFile, `${JSON.stringify(reports, null, 2)}\n`);
const readMemberships = () =>
  JSON.parse(fs.readFileSync(membershipsFile, "utf8"));

const writeMemberships = (memberships) =>
  atomicWrite(
    membershipsFile,
    `${JSON.stringify(memberships, null, 2)}\n`
  );

const readSubscriptions = () =>
  JSON.parse(fs.readFileSync(subscriptionsFile, "utf8"));

const writeSubscriptions = (subscriptions) =>
  atomicWrite(
    subscriptionsFile,
    `${JSON.stringify(subscriptions, null, 2)}\n`
  );
const getMembership = (userId) => {
  const memberships = readMemberships();

  return (
    memberships.find(
      (membership) =>
        membership.userId === userId &&
        membership.status === "active"
    ) || null
  );
};

const setMembership = (userId, tier, extra = {}) =>
  usersQueue(async () => {
    const memberships = readMemberships();
    const now = new Date().toISOString();

    const existingIndex = memberships.findIndex(
      (membership) => membership.userId === userId
    );

    const membership = {
      userId,
      tier,
      status: "active",
      startedAt: extra.startedAt || now,
      updatedAt: now,
      expiresAt: extra.expiresAt || null,
      source: extra.source || "manual"
    };

    if (existingIndex >= 0) {
      memberships[existingIndex] = {
        ...memberships[existingIndex],
        ...membership,
        startedAt:
          memberships[existingIndex].startedAt || membership.startedAt
      };
    } else {
      memberships.push(membership);
    }

    writeMemberships(memberships);
    return membership;
  });

const readTransactions = () =>
  JSON.parse(fs.readFileSync(transactionsFile, "utf8"));

const writeTransactions = (transactions) =>
  atomicWrite(
    transactionsFile,
    `${JSON.stringify(transactions, null, 2)}\n`
  );
const usersQueue = makeQueue();
const reportsQueue = makeQueue();

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
const accountRole = (role) => (["client", "creator", "provider", "business"].includes(role) ? role : null);
const isEmailAccount = (role) => role === "provider" || role === "creator" || role === "business";
const workerCategories = new Set([
  "escorts",
  "fetisher",
  "couples",
  "swingers",
  "content creators",
  "companions"
]);
const businessCategories = new Set([
  "brothel",
  "escort agency",
  "adult venue",
  "adult business",
  "photography",
  "support services",
  "other"
]);
const normaliseAbn = (abn) => String(abn || "").replace(/\D/g, "");
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

const cleanProfile = (body) => {
  const details = body.details || {};
  return {
    details: {
      location:       cleanText(details.location,       100),
      age:            cleanText(details.age,             20),
      height:         cleanText(details.height,          20),
      orientation:    cleanText(details.orientation,     40),
      hairColour:     cleanText(details.hairColour,      40),
      eyeColour:      cleanText(details.eyeColour,       40),
      bodyType:       cleanText(details.bodyType,        40),
      placeOfService: cleanText(details.placeOfService, 100),
    },
    profileNote: cleanText(body.profileNote, 500),
    rates: {
      incall: {
        oneHour:   cleanText(body.rates?.incall?.oneHour,   40),
        twoHours:  cleanText(body.rates?.incall?.twoHours,  40),
        overnight: cleanText(body.rates?.incall?.overnight, 40),
      },
      outcall: {
        oneHour:   cleanText(body.rates?.outcall?.oneHour,   40),
        twoHours:  cleanText(body.rates?.outcall?.twoHours,  40),
        overnight: cleanText(body.rates?.outcall?.overnight, 40),
      },
    },
    availability: Array.isArray(body.availability)
      ? body.availability.slice(0, 14).map((row) => ({
          day:          cleanText(row?.day,          40),
          availability: cleanText(row?.availability, 100),
          notes:        cleanText(row?.notes,        200),
        })).filter((row) => row.day || row.availability)
      : [],
    tours: Array.isArray(body.tours)
      ? body.tours.slice(0, 20).map((row) => ({
          to:    cleanText(row?.to,    80),
          from:  cleanText(row?.from,  20),
          until: cleanText(row?.until, 20),
        })).filter((row) => row.to || row.from)
      : [],
    photoNames: Array.isArray(body.photoNames)
      ? body.photoNames.slice(0, 8).map((n) => cleanText(n, 200)).filter(Boolean)
      : [],
  };
};

const cleanBusinessProfilePatch = (body) => {
  const source = body && typeof body === "object" ? body : {};
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(source, "website")) {
    updates.website = cleanText(source.website, 300);
  }
  if (Object.prototype.hasOwnProperty.call(source, "contactPhone")) {
    updates.contactPhone = cleanText(source.contactPhone, 40);
  }
  if (Object.prototype.hasOwnProperty.call(source, "description")) {
    updates.description = cleanText(source.description, 1200);
  }
  if (Object.prototype.hasOwnProperty.call(source, "services")) {
    updates.services = cleanText(source.services, 600);
  }
  if (Object.prototype.hasOwnProperty.call(source, "location")) {
    updates.location = cleanText(source.location, 200);
  }
  if (Object.prototype.hasOwnProperty.call(source, "openingHours")) {
    updates.openingHours = cleanText(source.openingHours, 200);
  }
  if (Object.prototype.hasOwnProperty.call(source, "priceRange")) {
    updates.priceRange = cleanText(source.priceRange, 200);
  }
  if (Object.prototype.hasOwnProperty.call(source, "logoDataUrl")) {
    updates.logoDataUrl = cleanText(source.logoDataUrl, 50000);
  }

  return updates;
};

const publicUser = (user) => ({
  id: user.id,
  role: user.role,
  email: user.email || null,
  clientId: user.clientId || null,
  workingName: user.workingName || null,
  gender: user.gender || null,
  accountCategory: user.accountCategory || null,
  applicationStatus: user.applicationStatus || null,
  businessProfile: user.businessProfile || null,
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

const publicDirectoryBusiness = (user) => ({
  id: user.id,
  workingName: user.workingName || null,
  accountCategory: user.accountCategory || null,
  applicationStatus: user.applicationStatus || null,
  businessProfile: {
    website: user.businessProfile?.website || "",
    description: user.businessProfile?.description || "",
    services: user.businessProfile?.services || "",
    location: user.businessProfile?.location || "",
    openingHours: user.businessProfile?.openingHours || "",
    priceRange: user.businessProfile?.priceRange || "",
    logoDataUrl: user.businessProfile?.logoDataUrl || ""
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

const requireSession = (request) => getAuthenticatedUser(request);

const requireRole = (request, role, user = null) => {
  const authenticatedUser = user || requireSession(request);
  return Boolean(authenticatedUser && authenticatedUser.role === role);
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
      await reportsQueue(() => {
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
      });
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

} // <-- route ends here

// PASTE NEW BLOCK HERE
if (pathname === "/api/dev/grant-membership" && request.method === "POST") {
  if (process.env.PAYMENT_PROVIDER !== "dev") {
    return json(response, 403, { error: "Dev membership grant disabled." });
  }

  const body = await readJsonBody(request);
  const userId = String(body.userId || "").trim();
  const tier = String(body.tier || "premium").trim();

  if (!userId) {
    return json(response, 400, { error: "Missing userId." });
  }

  const membership = await setMembership(userId, tier, {
    source: "dev"
  });

  return json(response, 200, {
    message: "Membership granted.",
    membership
  });
}
    if (pathname === "/api/auth/signup" && request.method === "POST") {
      const body = await readJsonBody(request);
      const role = accountRole(body.role);
      const password = String(body.password || "");

      if (!requireAuthRateLimit(request, response, "signup", role || "unknown")) return;
      if (!role) return json(response, 400, { error: "Choose a client, creator, provider, or business account." });
      if (body.acceptedPolicies !== true) {
        return json(response, 400, { error: "Confirm the adult-only Terms and Privacy Notice to create an account." });
      }
      if (!validPassword(password)) {
        return json(response, 400, {
          error: "Use at least 12 characters with upper and lowercase letters and a number."
        });
      }

      // Validate email-account fields before the expensive scrypt call.
      let email, workingName, gender, accountCategory, businessAbn;
      let businessWebsite = "";
      let businessPhone = "";
      let businessDescription = "";
      let servicesOffered = "";
      let businessLocation = "";
      let openingHours = "";
      let priceRange = "";
      let logoDataUrl = "";
      if (isEmailAccount(role)) {
        email = normaliseEmail(body.email);
        workingName = cleanText(body.workingName, 80);
        accountCategory = cleanText(body.accountCategory, 40).toLowerCase();
        if (!validEmail(email)) return json(response, 400, { error: "Enter a valid email address." });
        if (!workingName) {
          return json(response, 400, {
            error: role === "business" ? "Enter your business name." : "Enter your working name."
          });
        }

        if (role === "business") {
          businessAbn = normaliseAbn(body.businessAbn);
          if (businessAbn.length !== 11) return json(response, 400, { error: "Enter a valid 11 digit ABN." });
          if (!businessCategories.has(accountCategory)) {
            return json(response, 400, { error: "Choose a valid business category." });
          }
          businessWebsite = cleanText(body.website, 300);
          businessPhone = cleanText(body.businessPhone, 40);
          businessDescription = cleanText(body.businessDescription, 2000);
          servicesOffered = cleanText(body.services, 2000);
          businessLocation = cleanText(body.businessLocation, 200);
          openingHours = cleanText(body.openingHours, 200);
          priceRange = cleanText(body.priceRange, 200);
          logoDataUrl = cleanText(body.logoDataUrl, 5000);
        } else {
          gender = cleanText(body.gender, 60);
          if (!gender) return json(response, 400, { error: "Enter your gender." });
          if (!workerCategories.has(accountCategory)) {
            return json(response, 400, { error: "Choose a valid provider or creator category." });
          }
        }
      }

      // Hash password outside the queue — scrypt takes ~100 ms and must not hold the write lock.
      const credentials = hashPassword(password);
      const recoveryCode = makeRecoveryCode();

      // Atomic read-check-write: duplicate detection, unique-ID generation, and persist are
      // serialised so two concurrent signups cannot both pass the duplicate check or collide on clientId.
      const signup = await usersQueue(() => {
        const users = readUsers();

        if (isEmailAccount(role) && users.some((item) => item.email === email)) {
          return { status: 409, error: "A TEMPTX account already uses that email." };
        }

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
          user.email = email;
          user.workingName = workingName;
          user.accountCategory = accountCategory;
          if (role === "business") {
            user.businessAbn = businessAbn;
            user.applicationStatus = "pending_review";
            user.businessProfile = {
              website: businessWebsite,
              contactPhone: businessPhone,
              description: businessDescription,
              services: servicesOffered,
              location: businessLocation,
              openingHours,
              priceRange,
              logoDataUrl
            };
          } else {
            user.gender = gender;
          }
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
        return { user, pendingDeviceToken };
      });

      if (signup.error) return json(response, signup.status, { error: signup.error });

      const token = createSession(signup.user);
      return json(
        response,
        201,
        {
          message: "Account created.",
          user: publicUser(signup.user),
          clientId: signup.user.clientId || null,
          recoveryCode
        },
        {
          "Set-Cookie":
            role === "client"
              ? [sessionCookie(token), deviceCookie(signup.pendingDeviceToken)]
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
      }

      // Only enter the queue if a write is actually needed; re-read inside for freshness.
      if (ipChanged || wasDeactivated) {
        await usersQueue(() => {
          const freshUsers = readUsers();
          const freshUser = freshUsers.find((u) => u.id === user.id);
          if (!freshUser) return;
          if (ipChanged) {
            freshUser.lastIpHash = hashPrivateValue(getClientIp(request));
            freshUser.lastIpChangedAt = new Date().toISOString();
          }
          if (wasDeactivated) {
            freshUser.deactivatedAt = null;
            freshUser.reactivatedAt = new Date().toISOString();
          }
          writeUsers(freshUsers);
        });
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

      // Hash outside the queue — scrypt must not hold the write lock.
      const credentials = hashPassword(body.password);

      const reset = await usersQueue(() => {
        const users = readUsers();
        const user = users.find((item) => item.id === record.userId);
        if (!user) return { notFound: true };
        user.passwordHash = credentials.hash;
        user.salt = credentials.salt;
        user.passwordUpdatedAt = new Date().toISOString();
        writeUsers(users);
        return { userId: user.id };
      });

      if (reset.notFound) return json(response, 404, { error: "Account not found." });
      resetTokens.delete(body.resetToken);
      clearUserSessions(reset.userId);
      return json(response, 200, { message: "Password updated. You can now log in." });
    }

    if (pathname === "/api/auth/me" && request.method === "GET") {
      const user = getAuthenticatedUser(request);
      if (!user) return json(response, 401, { error: "Not signed in." });
      return json(response, 200, { user: publicUser(user) });
    }

    if (pathname === "/api/business/profile" && request.method === "GET") {
      const user = requireSession(request);
      if (!user) return json(response, 401, { error: "Sign in to view your business profile." });
      if (!requireRole(request, "business", user)) {
        return json(response, 403, { error: "Only business accounts can view this profile." });
      }

      return json(response, 200, {
        user: publicUser(user),
        businessProfile: user.businessProfile || {},
        applicationStatus: user.applicationStatus || "pending_review"
      });
    }

    if (pathname === "/api/business/profile" && request.method === "PATCH") {
      const authenticatedUser = requireSession(request);
      if (!authenticatedUser) return json(response, 401, { error: "Sign in to update your business profile." });
      if (!requireRole(request, "business", authenticatedUser)) {
        return json(response, 403, { error: "Only business accounts can update this profile." });
      }

      const body = await readJsonBody(request);
      const businessProfileSource =
        body?.businessProfile && typeof body.businessProfile === "object" ? body.businessProfile : body;
      const profileUpdates = cleanBusinessProfilePatch(businessProfileSource);
      const hasDisplayNameUpdate =
        body?.settings &&
        typeof body.settings === "object" &&
        Object.prototype.hasOwnProperty.call(body.settings, "displayName");
      const nextDisplayName = hasDisplayNameUpdate ? cleanText(body.settings.displayName, 50) : "";

      if (!Object.keys(profileUpdates).length && !hasDisplayNameUpdate) {
        return json(response, 400, {
          error:
            "No supported business profile fields were provided. You can update website, contactPhone, description, services, location, openingHours, priceRange, logoDataUrl, or settings.displayName."
        });
      }

      const saved = await usersQueue(() => {
        const users = readUsers();
        const user = users.find((item) => item.id === authenticatedUser.id);
        if (!user) return { notFound: true };
        if (user.role !== "business") return { forbidden: true };

        user.businessProfile = {
          ...(user.businessProfile && typeof user.businessProfile === "object" ? user.businessProfile : {}),
          ...profileUpdates
        };
        user.businessProfileUpdatedAt = new Date().toISOString();

        if (hasDisplayNameUpdate) {
          user.settings = {
            ...(user.settings && typeof user.settings === "object" ? user.settings : {}),
            displayName: nextDisplayName
          };
          user.settingsUpdatedAt = new Date().toISOString();
        }

        writeUsers(users);
        return { user };
      });

      if (saved.notFound) return json(response, 404, { error: "Account not found." });
      if (saved.forbidden) {
        return json(response, 403, { error: "Only business accounts can update this profile." });
      }
      return json(response, 200, {
        message: "Business profile saved.",
        user: publicUser(saved.user),
        businessProfile: saved.user.businessProfile || {},
        applicationStatus: saved.user.applicationStatus || "pending_review"
      });
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

    if (pathname === "/api/directory/businesses" && request.method === "GET") {
      const businesses = readUsers()
        .filter(
          (user) =>
            user.role === "business" &&
            user.applicationStatus === "approved" &&
            !user.deactivatedAt &&
            user.businessProfile &&
            typeof user.businessProfile === "object"
        )
        .map((user) => publicDirectoryBusiness(user));

      return json(response, 200, { businesses });
    }

    if (pathname === "/api/auth/settings" && request.method === "PATCH") {
      const authenticatedUser = getAuthenticatedUser(request);
      if (!authenticatedUser) return json(response, 401, { error: "Sign in to change settings." });

      const body = await readJsonBody(request);

      const saved = await usersQueue(() => {
        const users = readUsers();
        const user = users.find((item) => item.id === authenticatedUser.id);
        if (!user) return { notFound: true };

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
        return { user };
      });

      if (saved.notFound) return json(response, 404, { error: "Account not found." });
      return json(response, 200, {
        message: "Settings saved.",
        user: publicUser(saved.user)
      });
    }

    if (pathname === "/api/auth/deactivate" && request.method === "POST") {
      const authenticatedUser = getAuthenticatedUser(request);
      if (!authenticatedUser) return json(response, 401, { error: "Sign in to deactivate your account." });

      const body = await readJsonBody(request);
      const password = String(body.password || "");

      const deactivate = await usersQueue(() => {
        const users = readUsers();
        const user = users.find((item) => item.id === authenticatedUser.id);
        if (!user || !verifyPassword(password, user)) return { unauthorized: true };
        user.deactivatedAt = new Date().toISOString();
        writeUsers(users);
        return { userId: user.id };
      });

      if (deactivate.unauthorized) return json(response, 401, { error: "Your password is incorrect." });
      clearUserSessions(deactivate.userId);
      clearUserResetTokens(deactivate.userId);

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
      const password = String(body.password || "");

      if (String(body.confirmation || "").trim().toUpperCase() !== "DELETE") {
        return json(response, 400, { error: "Type DELETE to confirm permanent account removal." });
      }

      const deletion = await usersQueue(() => {
        const users = readUsers();
        const user = users.find((item) => item.id === authenticatedUser.id);
        if (!user || !verifyPassword(password, user)) return { unauthorized: true };
        writeUsers(users.filter((item) => item.id !== user.id));
        return { userId: user.id };
      });

      if (deletion.unauthorized) return json(response, 401, { error: "Your password is incorrect." });
      clearUserSessions(deletion.userId);
      clearUserResetTokens(deletion.userId);

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

    if (pathname === "/api/profile" && request.method === "GET") {
      const user = getAuthenticatedUser(request);
      if (!user) return json(response, 401, { error: "Sign in to view your profile." });
      if (user.role !== "provider") return json(response, 403, { error: "Only providers have a profile." });
      return json(response, 200, { profile: user.profile || {} });
    }

    if (pathname === "/api/profile" && request.method === "PATCH") {
      const authenticatedUser = getAuthenticatedUser(request);
      if (!authenticatedUser) return json(response, 401, { error: "Sign in to save your profile." });
      if (authenticatedUser.role !== "provider") return json(response, 403, { error: "Only providers can save a profile." });

      const body = await readJsonBody(request);

      const saved = await usersQueue(() => {
        const users = readUsers();
        const user = users.find((item) => item.id === authenticatedUser.id);
        if (!user) return { notFound: true };
        user.profile = cleanProfile(body);
        user.profileUpdatedAt = new Date().toISOString();
        writeUsers(users);
        return { profile: user.profile };
      });

      if (saved.notFound) return json(response, 404, { error: "Account not found." });
      return json(response, 200, { message: "Profile saved.", profile: saved.profile });
    }

    const providerProfileMatch = pathname.match(/^\/api\/providers\/([^/]+)\/profile$/);
    if (providerProfileMatch && request.method === "GET") {
      const targetId = providerProfileMatch[1];
      const user = readUsers().find(
        (u) =>
          u.id === targetId &&
          u.role === "provider" &&
          !u.deactivatedAt &&
          u.settings?.profileVisible !== false &&
          String(u.settings?.displayName || "").trim()
      );
      if (!user) return json(response, 404, { error: "Provider not found." });
      return json(response, 200, {
        profile: user.profile || {},
        provider: {
          id: user.id,
          name: String(user.settings.displayName).trim().slice(0, 50),
          locations: cleanDirectorySelections(user.settings?.locations, DIRECTORY_OPTIONS.locations),
          services: cleanDirectorySelections(user.settings?.services, DIRECTORY_OPTIONS.services),
          attributes: cleanDirectorySelections(user.settings?.attributes, DIRECTORY_OPTIONS.attributes),
        },
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

    const ext = path.extname(filePath).toLowerCase();
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const isVersioned = url.searchParams.has("v");
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": isVersioned ? "public, max-age=31536000, immutable" : "no-store",
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
