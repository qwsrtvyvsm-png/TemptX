// Builds the shared <head> block (canonical, robots, Open Graph, icons,
// structured data) and applies it to a page's HTML. Every HTML response goes
// through applyHead, so these tags exist in one place instead of 60 files.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_TAGLINE,
  SHARE_IMAGE,
  SHARE_IMAGE_SIZE,
  absoluteUrl
} = require("./config");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const decodeEntities = (value) =>
  String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// JSON-LD sits inside a <script> element, so "<" must not appear literally.
const jsonLdScript = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

// Reads the title and description a static page already declares.
const extractMeta = (html) => {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/i);
  return {
    title: title ? decodeEntities(title[1].trim()) : "",
    description: description ? decodeEntities(description[1].trim()) : ""
  };
};

// ---- Asset versioning -------------------------------------------------------
// Local .css and .js references get ?v=<content hash>, so the server can cache
// them for a year and a changed file is picked up on the next page load. This
// replaces hand-edited ?v=20260923-02 strings.

const versionCache = new Map();

const assetVersion = (publicRoot, relativePath) => {
  const filePath = path.join(publicRoot, relativePath);
  try {
    const stats = fs.statSync(filePath);
    const cached = versionCache.get(filePath);
    if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) return cached.version;
    const version = crypto.createHash("sha1").update(fs.readFileSync(filePath)).digest("hex").slice(0, 10);
    versionCache.set(filePath, { mtimeMs: stats.mtimeMs, size: stats.size, version });
    return version;
  } catch {
    return "";
  }
};

const assetUrl = (publicRoot, relativePath) => {
  const clean = String(relativePath).replace(/^\/+/, "");
  const version = assetVersion(publicRoot, clean);
  return version ? `/${clean}?v=${version}` : `/${clean}`;
};

// Rewrites href="style.css?v=old" / src="script.js" to root-absolute,
// content-hashed URLs. Root-absolute matters for nested routes such as
// /directory/adelaide, where a relative "style.css" would not resolve.
const versionAssetUrls = (html, publicRoot) =>
  html.replace(
    /\b(href|src)="\/?([a-z0-9][a-z0-9._/-]*\.(?:css|js))(?:\?v=[^"]*)?"/gi,
    (match, attribute, file) => {
      const version = assetVersion(publicRoot, file);
      return version ? `${attribute}="/${file}?v=${version}"` : match;
    }
  );

// ---- Structured data --------------------------------------------------------

const organizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${absoluteUrl("/")}#organization`,
  name: SITE_NAME,
  alternateName: "TemptX",
  url: absoluteUrl("/"),
  logo: absoluteUrl("/assets/temptx-icon-512.png"),
  description: SITE_DESCRIPTION,
  slogan: SITE_TAGLINE,
  areaServed: { "@type": "Country", name: "Australia" }
});

const websiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${absoluteUrl("/")}#website`,
  name: SITE_NAME,
  alternateName: "TemptX",
  url: absoluteUrl("/"),
  inLanguage: "en-AU",
  publisher: { "@id": `${absoluteUrl("/")}#organization` }
});

// trail: [[name, path], ...] from Home to the current page.
const breadcrumbSchema = (trail) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map(([name, pathname], index) => ({
    "@type": "ListItem",
    position: index + 1,
    name,
    item: absoluteUrl(pathname)
  }))
});

// ---- Search engine ownership ------------------------------------------------
// Set GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION to the code each
// webmaster tool gives you; the tag is added to the home page only.

const verificationTags = () =>
  [
    ["google-site-verification", process.env.GOOGLE_SITE_VERIFICATION],
    ["msvalidate.01", process.env.BING_SITE_VERIFICATION]
  ]
    .filter(([, value]) => value)
    .map(([name, value]) => `<meta name="${name}" content="${escapeHtml(String(value).trim())}">`);

// ---- Head block -------------------------------------------------------------

// meta: { title, description, canonicalPath, noindex, adult, ogType, jsonLd[] }
const buildHeadTags = (meta) => {
  const title = meta.title || SITE_NAME;
  const description = meta.description || SITE_DESCRIPTION;
  const canonical = meta.canonicalPath ? absoluteUrl(meta.canonicalPath) : "";
  const image = absoluteUrl(SHARE_IMAGE);
  const tags = [];

  if (meta.noindex) {
    tags.push('<meta name="robots" content="noindex, follow">');
  } else if (canonical) {
    tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}">`);
  }
  if (meta.adult) tags.push('<meta name="rating" content="adult">');
  if (meta.canonicalPath === "/") tags.push(...verificationTags());

  tags.push(
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta property="og:type" content="${escapeHtml(meta.ogType || "website")}">`,
    '<meta property="og:locale" content="en_AU">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`
  );
  if (canonical) tags.push(`<meta property="og:url" content="${escapeHtml(canonical)}">`);
  tags.push(
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:image:width" content="${SHARE_IMAGE_SIZE.width}">`,
    `<meta property="og:image:height" content="${SHARE_IMAGE_SIZE.height}">`,
    `<meta property="og:image:alt" content="${escapeHtml(`${SITE_NAME}, ${SITE_TAGLINE}`)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    '<link rel="icon" href="/favicon.ico" sizes="32x32">',
    '<link rel="icon" href="/assets/temptx-app-icon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/assets/temptx-icon-192.png" sizes="192x192">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<meta name="theme-color" content="#15100d">',
    // Must match the URL style.css requests exactly, or the font downloads twice.
    '<link rel="preload" href="/assets/fonts/Anton-Regular.woff2" as="font" type="font/woff2" crossorigin>'
  );

  for (const data of meta.jsonLd || []) tags.push(jsonLdScript(data));
  return tags.map((tag) => `  ${tag}`).join("\n");
};

// Applies page metadata to a complete HTML document.
const applyHead = (html, meta, publicRoot) => {
  let output = html;
  const existing = extractMeta(output);
  const title = meta.title || existing.title;
  const description = meta.description || existing.description;

  if (meta.title && meta.title !== existing.title) {
    output = output.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  }

  const descriptionTag = `<meta name="description" content="${escapeHtml(description)}">`;
  let extraTags = "";
  if (description && !existing.description) {
    extraTags = `  ${descriptionTag}\n`;
  } else if (meta.description && meta.description !== existing.description) {
    output = output.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, descriptionTag);
  }

  if (meta.htmlAttributes) {
    output = output.replace(/<html\b/i, `<html ${meta.htmlAttributes}`);
  }

  const headTags = buildHeadTags({ ...meta, title, description });
  output = output.replace(/<\/head>/i, `${extraTags}${headTags}\n</head>`);
  return versionAssetUrls(output, publicRoot);
};

module.exports = {
  escapeHtml,
  extractMeta,
  assetUrl,
  assetVersion,
  applyHead,
  organizationSchema,
  websiteSchema,
  breadcrumbSchema
};
