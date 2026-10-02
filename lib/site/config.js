// Site-wide constants and the page registry for the public page layer.
//
// URL rules (one canonical URL per page):
//   Public pages    /<slug>          e.g. /directory, /safety-hub. /<slug>.html 301s here.
//   Home            /                /index.html 301s here.
//   App pages       /<slug>.html     signed-in or form pages. Never indexed.
//   City pages      /directory/<city>
//   Provider pages  /providers/<name>-<id8>
//
// A new public/<slug>.html file is public and indexable by default. Add its
// slug to APP_PAGES only when it is a signed-in or form page.

const SITE_URL = String(process.env.SITE_URL || "https://thetemptx.com").replace(/\/+$/, "");
const SITE_NAME = "TEMPTX";
const SITE_TAGLINE = "Australia's Adult Network";
const SITE_DESCRIPTION =
  "TEMPTX is Australia's adult network, built around safety, support, verification and genuine connection.";
const SHARE_IMAGE = "/assets/temptx-share.png";
const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

// Signed-in dashboards, account forms and report flows. They keep their
// .html URL (their scripts compare file names) and are served noindex.
const APP_PAGES = new Set([
  "auth",
  "blacklist",
  "business-dashboard",
  "business-profile",
  "business-signup",
  "chat",
  "client-login",
  "client-signin",
  "client-signup",
  "creator-dashboard",
  "creator-login",
  "creator-profile",
  "creator-signin",
  "creator-signup",
  "membership",
  "my-bookings",
  "provider-dashboard",
  "provider-login",
  "provider-profile",
  "provider-signin",
  "provider-signup",
  "report",
  "settings",
  "verification-centre",
  "xync"
]);

// Public pages whose content is filled in by JavaScript from a query string
// (?provider=, ?business=). The bare shell has nothing to index, so it is
// noindex; real providers get an indexable /providers/<slug> URL instead.
const SHELL_PAGES = new Set(["profile", "business-public"]);

// Public pages left out of search until they are linked from the site.
const UNLISTED_PAGES = new Set(["models"]);

// Pages that list or show adult services. They carry <meta name="rating"
// content="adult"> so SafeSearch filters them and leaves the safety,
// education and policy pages visible.
const ADULT_PAGES = new Set(["directory", "district", "models", "profile", "business-public"]);

const isAppPage = (slug) => APP_PAGES.has(slug);
const isIndexable = (slug) => !APP_PAGES.has(slug) && !SHELL_PAGES.has(slug) && !UNLISTED_PAGES.has(slug);
const isAdultPage = (slug) => ADULT_PAGES.has(slug);

// The one URL path a page slug is served from.
const pagePath = (slug) => {
  if (slug === "index") return "/";
  return APP_PAGES.has(slug) ? `/${slug}.html` : `/${slug}`;
};

const absoluteUrl = (pathname) => `${SITE_URL}${pathname.startsWith("/") ? "" : "/"}${pathname}`;

// Turns a site-relative link as written in page content ("safety-hub.html",
// "report.html?type=profile", "index.html#join") into its canonical path.
// External links, anchors and already-absolute paths pass through untouched.
const resolveHref = (href) => {
  const value = String(href || "");
  if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(value)) return value;
  const match = value.match(/^([a-z0-9-]+)\.html([?#].*)?$/i);
  if (!match) return value;
  return `${pagePath(match[1].toLowerCase())}${match[2] || ""}`;
};

module.exports = {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  SHARE_IMAGE,
  SHARE_IMAGE_SIZE,
  APP_PAGES,
  SHELL_PAGES,
  UNLISTED_PAGES,
  isAppPage,
  isIndexable,
  isAdultPage,
  pagePath,
  absoluteUrl,
  resolveHref
};
