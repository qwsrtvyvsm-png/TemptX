// Shared header, footer and document shell for server-rendered pages
// (information pages, city pages, the 404 page). Static pages in public/
// carry their own copy of this header and footer markup.

const { SITE_NAME, SITE_TAGLINE, pagePath } = require("./config");
const { escapeHtml } = require("./head");

const SUPPORT_PAGES = new Set([
  "safety-hub",
  "educational-hub",
  "sex-work-resources",
  "sex-work-abbreviations",
  "friendly-businesses",
  "moderation",
  "report",
  "verification"
]);
const COMMUNITY_PAGES = new Set(["community-support", "community-standards", "news", "links", "developments"]);
const JOIN_PAGES = new Set([
  "why-temptx",
  "creator-standards",
  "provider-standards",
  "client-standards",
  "pricing",
  "creator-pricing",
  "client-pricing",
  "membership"
]);

const CURRENT = ' class="nav-current" aria-current="page"';

// activeKey: the page slug, or "directory" for directory and city pages.
const renderHeader = (activeKey = "") => `
  <header class="site-header">
    <div class="announcement">
      <div class="tx-banner-track">
        <span class="tx-banner-set">A Place to Connect <span class="tx-dot">&middot;</span> A Space to Create <span class="tx-dot">&middot;</span> A Community to Belong <span class="tx-dot">&middot;</span> A Future to Build <span class="tx-dot">&middot;</span></span>
        <span class="tx-banner-set">A Place to Connect <span class="tx-dot">&middot;</span> A Space to Create <span class="tx-dot">&middot;</span> A Community to Belong <span class="tx-dot">&middot;</span> A Future to Build <span class="tx-dot">&middot;</span></span>
      </div>
    </div>
    <div class="site-header-bar">
      <div class="tx-nav-left">
        <a class="brand-mark" href="/">
          <span class="brand-word">TEMPT</span>
          <span class="brand-x">X</span>
        </a>
        <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="siteNav" aria-label="Open menu">
        <span class="nav-toggle-bar"></span>
        <span class="nav-toggle-bar"></span>
        <span class="nav-toggle-bar"></span>
      </button>
      <nav class="store-nav home-nav" id="siteNav" aria-label="Main navigation">
          <a href="/">Home</a>
          <a href="${pagePath("directory")}"${activeKey === "directory" ? CURRENT : ""}>Directory</a>
          <a href="${pagePath("district")}">District</a>
          <a href="${pagePath("safety-hub")}"${SUPPORT_PAGES.has(activeKey) ? CURRENT : ""}>Support</a>
          <a href="${pagePath("community")}"${COMMUNITY_PAGES.has(activeKey) ? CURRENT : ""}>Community</a>
          <a href="${pagePath("chat")}" data-authenticated hidden>Messages</a>
        </nav>
      </div>
      <div class="site-header-actions">
        <div class="account-dropdown hover-dropdown">
          <a href="${pagePath("profile")}" class="tx-signin-link">Sign In</a>
          <div class="dropdown-menu account-menu">
            <a href="${pagePath("provider-login")}" data-login>Provider Log In</a>
            <a href="${pagePath("client-login")}" data-login>Client Log In</a>
            <a href="${pagePath("auth")}" data-logout hidden>Log Out</a>
          </div>
        </div>
        <a href="${pagePath("join")}" class="tx-join-btn"${JOIN_PAGES.has(activeKey) ? ' aria-current="page"' : ""}>Join</a>
      </div>
    </div>
  </header>`;

const renderFooter = () => `
  <footer class="footer home-footer">
    <div class="home-footer-brand">
      <div class="logo">Tempt<span>X</span></div>
      <p class="home-footer-tagline">${escapeHtml(SITE_TAGLINE)}</p>
    </div>
    <div class="home-footer-columns">
      <div class="home-footer-col">
        <span class="home-footer-col-title">Support</span>
        <a href="${pagePath("safety-hub")}">Safety Hub</a>
        <a href="${pagePath("community-support")}">Community Support</a>
        <a href="${pagePath("report")}?type=profile">Report a Profile</a>
      </div>
      <div class="home-footer-col">
        <span class="home-footer-col-title">Resources</span>
        <a href="${pagePath("educational-hub")}">Educational Hub</a>
        <a href="${pagePath("sex-work-resources")}">Sex Work Resources</a>
        <a href="${pagePath("friendly-businesses")}">Friendly Businesses</a>
      </div>
      <div class="home-footer-col">
        <span class="home-footer-col-title">Community</span>
        <a href="${pagePath("community-standards")}">Community Guidelines</a>
        <a href="${pagePath("verification")}">Verification</a>
        <a href="${pagePath("news")}">News &amp; Announcements</a>
      </div>
      <div class="home-footer-col">
        <span class="home-footer-col-title">Policies</span>
        <a href="${pagePath("terms")}">Terms of Service</a>
        <a href="${pagePath("privacy")}">Privacy Policy</a>
        <a href="${pagePath("provider-standards")}">Provider Standards</a>
        <a href="${pagePath("client-standards")}">Client Standards</a>
      </div>
    </div>
    <div class="home-footer-bottom">
      <p class="home-footer-legal">&copy; ${new Date().getFullYear()} ${escapeHtml(SITE_NAME)}. All rights reserved. For adults aged 18+ only.</p>
      <div class="home-footer-links">
        <a href="${pagePath("privacy")}">Privacy</a>
        <a href="${pagePath("terms")}">Terms</a>
        <a href="${pagePath("safety-hub")}">Safety</a>
      </div>
    </div>
  </footer>`;

// The 18+ gate shown on pages that list adult services. Same markup as the
// static pages; public/script.js shows or hides it. It sits after <main> so
// the page's own content comes first in the HTML.
const renderAgeGate = () => `
  <div id="ageGate" class="age-gate" role="dialog" aria-modal="true" aria-labelledby="ageGateTitle">
    <div class="age-box">
      <p class="age-title" id="ageGateTitle">Tempt<span>X</span></p>
      <p>This website is intended for adults aged 18+ only.</p>
      <p class="small-text">
        By entering, you confirm you are at least 18 years old and agree to view adult industry related content.
      </p>
      <p class="age-policy-links">
        <a href="${pagePath("privacy")}">Privacy</a>
        <a href="${pagePath("terms")}">Terms</a>
        <a href="${pagePath("safety-hub")}">Safety</a>
      </p>

      <div class="age-buttons">
        <button id="enterSite">I am 18+</button>
        <button id="leaveSite" class="outline-btn">Leave</button>
      </div>
    </div>
  </div>`;

// A complete HTML document. applyHead adds canonical, Open Graph and schema
// tags afterwards, and versions the stylesheet and script URLs.
const renderDocument = ({ title, description, bodyClass, bodyAttributes = "", stylesheets = [], body }) => `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="stylesheet" href="/style.css">
${stylesheets.map((href) => `  <link rel="stylesheet" href="${escapeHtml(href)}">`).join("\n")}
</head>
<body class="${escapeHtml(bodyClass)}"${bodyAttributes ? ` ${bodyAttributes}` : ""}>
${body}
  <script src="/script.js"></script>
</body>
</html>
`;

module.exports = { renderHeader, renderFooter, renderAgeGate, renderDocument };
