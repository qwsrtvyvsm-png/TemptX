// The public page layer: every non-API request ends up here.
//
// It serves only what is inside public/, gives each page one canonical URL,
// adds the shared <head> tags, and answers /robots.txt and /sitemap.xml.
// URL rules are documented in ./config.js.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  SITE_NAME,
  APP_PAGES,
  isAppPage,
  isIndexable,
  isAdultPage,
  pagePath,
  absoluteUrl
} = require("./config");
const { applyHead, extractMeta, organizationSchema, websiteSchema, breadcrumbSchema, escapeHtml } = require("./head");
const { renderHeader, renderFooter, renderDocument } = require("./layout");
const { hasInfoPage, infoPageSlugs, renderInfoPage } = require("./info-page");
const {
  slugify,
  providerPath,
  providerSlug,
  findProviderBySlug,
  providerMeta,
  cityPath,
  findCity,
  providersInCity,
  renderCityPage
} = require("./directory-pages");
const { fillProfile } = require("./profile-page");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf"
};

const CONTENT_SECURITY_POLICY =
  "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

const ONE_YEAR = "public, max-age=31536000, immutable";
const ONE_WEEK = "public, max-age=604800, stale-while-revalidate=86400";
const REVALIDATE = "no-cache";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// options:
//   publicRoot      absolute path of public/
//   listProviders   () => [{ id, name, locations, services, attributes, profile }]
//                   the providers the directory API shows, and no others
//   cities          directory location names
const createSite = ({ publicRoot, listProviders, cities }) => {
  const isHttps = (request) =>
    String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";

  const baseHeaders = (request) => ({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    ...(isHttps(request) ? { "Strict-Transport-Security": "max-age=31536000" } : {})
  });

  const send = (request, response, status, headers, body) => {
    response.writeHead(status, { ...baseHeaders(request), ...headers });
    response.end(request.method === "HEAD" ? undefined : body);
  };

  const redirect = (request, response, location) =>
    send(request, response, 301, { Location: location, "Cache-Control": "public, max-age=3600" }, "");

  // Sends a body with an ETag and answers If-None-Match with 304.
  const sendWithEtag = (request, response, status, headers, body) => {
    const etag = `"${crypto.createHash("sha1").update(body).digest("base64url").slice(0, 20)}"`;
    if (status === 200 && request.headers["if-none-match"] === etag) {
      return send(request, response, 304, { ETag: etag, "Cache-Control": headers["Cache-Control"] }, "");
    }
    return send(request, response, status, { ...headers, ETag: etag }, body);
  };

  const sendHtml = (request, response, status, html, { noindex = false, privatePage = false } = {}) =>
    sendWithEtag(
      request,
      response,
      status,
      {
        "Content-Type": MIME_TYPES[".html"],
        "Cache-Control": privatePage ? "no-store" : REVALIDATE,
        ...(noindex ? { "X-Robots-Tag": "noindex, follow" } : {})
      },
      html
    );

  // ---- Pages ----------------------------------------------------------------

  const staticPagePath = (slug) => path.join(publicRoot, `${slug}.html`);
  const hasStaticPage = (slug) => {
    try {
      return fs.statSync(staticPagePath(slug)).isFile();
    } catch {
      return false;
    }
  };
  const pageExists = (slug) => hasStaticPage(slug) || hasInfoPage(slug);

  // Every page slug the site can serve.
  const allPageSlugs = () => {
    const slugs = new Set(infoPageSlugs());
    for (const file of fs.readdirSync(publicRoot)) {
      if (file.endsWith(".html")) slugs.add(file.slice(0, -5));
    }
    return [...slugs];
  };

  const breadcrumbName = (title) => title.split("|")[0].trim() || SITE_NAME;

  const renderPage = (slug) => {
    const indexable = isIndexable(slug);
    const base = {
      canonicalPath: pagePath(slug),
      noindex: !indexable,
      adult: isAdultPage(slug)
    };

    if (hasStaticPage(slug)) {
      const html = fs.readFileSync(staticPagePath(slug), "utf8");
      const jsonLd =
        slug === "index"
          ? [organizationSchema(), websiteSchema()]
          : indexable
            ? [breadcrumbSchema([["Home", "/"], [breadcrumbName(extractMeta(html).title), pagePath(slug)]])]
            : [];
      return applyHead(html, { ...base, jsonLd }, publicRoot);
    }

    const rendered = renderInfoPage(slug, { isAvailable: pageExists });
    return applyHead(rendered.html, { ...base, ...rendered.meta }, publicRoot);
  };

  const servePage = (request, response, slug) =>
    sendHtml(request, response, 200, renderPage(slug), {
      noindex: !isIndexable(slug),
      privatePage: isAppPage(slug)
    });

  const serveNotFound = (request, response) => {
    const title = `Page not found | ${SITE_NAME}`;
    const description = "This page does not exist or has moved.";
    const html = renderDocument({
      title,
      description,
      bodyClass: "cinematic-background content-body",
      body: `  <div id="contentHeader">${renderHeader()}</div>
  <main class="content-shell">
    <section class="content-hero">
      <p class="eyebrow">Error 404</p>
      <h1>Page not found</h1>
      <p>This page does not exist or has moved. Try one of these instead.</p>
      <div class="content-action not-found-actions">
        <a class="light-btn" href="/">Home</a>
        <a class="light-btn" href="${pagePath("directory")}">Directory</a>
        <a class="light-btn" href="${pagePath("safety-hub")}">Safety Hub</a>
      </div>
    </section>
  </main>
${renderFooter()}`
    });
    return sendHtml(request, response, 404, applyHead(html, { title, description, noindex: true }, publicRoot), {
      noindex: true
    });
  };

  const serveCity = (request, response, city) => {
    const page = renderCityPage(city, cities, listProviders());
    return sendHtml(request, response, 200, applyHead(page.html, page.meta, publicRoot), {
      noindex: !page.indexable
    });
  };

  const serveProvider = (request, response, provider) => {
    const template = fs.readFileSync(staticPagePath("profile"), "utf8");
    const html = applyHead(fillProfile(template, provider), providerMeta(provider), publicRoot);
    return sendHtml(request, response, 200, html);
  };

  // ---- robots.txt and sitemap.xml -------------------------------------------

  const serveRobots = (request, response) =>
    sendWithEtag(
      request,
      response,
      200,
      { "Content-Type": MIME_TYPES[".txt"], "Cache-Control": "public, max-age=3600" },
      ["User-agent: *", "Allow: /", "Disallow: /api/", "", `Sitemap: ${absoluteUrl("/sitemap.xml")}`, ""].join("\n")
    );

  // Indexable URLs only: public pages, cities with a listed provider, providers.
  const sitemapPaths = () => {
    const providers = listProviders();
    return [
      "/",
      ...allPageSlugs()
        .filter((slug) => slug !== "index" && isIndexable(slug))
        .sort()
        .map(pagePath),
      ...cities.filter((city) => providersInCity(providers, city).length > 0).map(cityPath),
      ...providers.map(providerPath)
    ];
  };

  const serveSitemap = (request, response) => {
    const urls = sitemapPaths()
      .map((pathname) => `  <url><loc>${escapeHtml(absoluteUrl(pathname))}</loc></url>`)
      .join("\n");
    return sendWithEtag(
      request,
      response,
      200,
      { "Content-Type": MIME_TYPES[".xml"], "Cache-Control": "public, max-age=3600" },
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
    );
  };

  // ---- Static files ---------------------------------------------------------

  const serveFile = (request, response, pathname, url) => {
    const filePath = path.resolve(publicRoot, `.${pathname}`);
    const extension = path.extname(filePath).toLowerCase();
    const notFound = () =>
      send(request, response, 404, { "Content-Type": MIME_TYPES[".txt"], "Cache-Control": "no-store" }, "Not found");

    // Only known file types, and never a path that leaves public/.
    if (!filePath.startsWith(`${publicRoot}${path.sep}`) || !MIME_TYPES[extension]) return notFound();

    fs.stat(filePath, (error, stats) => {
      if (error || !stats.isFile()) return notFound();

      const etag = `W/"${stats.size.toString(16)}-${Math.round(stats.mtimeMs).toString(16)}"`;
      let cacheControl = REVALIDATE;
      if (url.searchParams.has("v")) cacheControl = ONE_YEAR;
      else if (pathname.startsWith("/assets/") || pathname === "/favicon.ico") cacheControl = ONE_WEEK;

      const headers = { "Content-Type": MIME_TYPES[extension], "Cache-Control": cacheControl, ETag: etag };
      if (request.headers["if-none-match"] === etag) return send(request, response, 304, headers, "");

      response.writeHead(200, { ...baseHeaders(request), ...headers, "Content-Length": stats.size });
      if (request.method === "HEAD") return response.end();
      return fs.createReadStream(filePath).pipe(response);
    });
  };

  // ---- Request handler ------------------------------------------------------

  const handle = (request, response, url) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return send(request, response, 405, { Allow: "GET, HEAD", "Content-Type": MIME_TYPES[".txt"] }, "Method not allowed");
    }

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return serveNotFound(request, response);
    }

    // Dotfiles (.git, .env) and odd paths are never served.
    if (pathname.includes("\0") || pathname.includes("//") || /(^|\/)\./.test(pathname)) {
      return serveNotFound(request, response);
    }

    if (pathname === "/robots.txt") return serveRobots(request, response);
    if (pathname === "/sitemap.xml") return serveSitemap(request, response);
    if (pathname === "/") return servePage(request, response, "index");
    if (pathname === "/providers") return redirect(request, response, pagePath("directory"));

    if (pathname.length > 1 && pathname.endsWith("/")) {
      return redirect(request, response, `${pathname.replace(/\/+$/, "")}${url.search}`);
    }

    // /<slug>.html — app pages live here; public pages redirect to /<slug>.
    const htmlMatch = pathname.match(/^\/([a-z0-9-]+)\.html$/i);
    if (htmlMatch) {
      const slug = htmlMatch[1].toLowerCase();
      if (!pageExists(slug)) return serveNotFound(request, response);
      if (isAppPage(slug)) return servePage(request, response, slug);
      return redirect(request, response, publicPageLocation(slug, url));
    }

    // /<slug> — public pages live here; app pages redirect to /<slug>.html.
    const slugMatch = pathname.match(/^\/([a-z0-9-]+)$/i);
    if (slugMatch) {
      const slug = slugMatch[1].toLowerCase();
      if (!pageExists(slug)) return serveNotFound(request, response);
      if (slug === "index") return redirect(request, response, `/${url.search}`);
      if (isAppPage(slug)) return redirect(request, response, `${pagePath(slug)}${url.search}`);
      const location = publicPageLocation(slug, url);
      if (location !== `${pathname}${url.search}`) return redirect(request, response, location);
      return servePage(request, response, slug);
    }

    const cityMatch = pathname.match(/^\/directory\/([a-z0-9-]+)$/i);
    if (cityMatch) {
      const city = findCity(cities, cityMatch[1].toLowerCase());
      return city ? serveCity(request, response, city) : serveNotFound(request, response);
    }

    const providerMatch = pathname.match(/^\/providers\/([a-z0-9-]+)$/i);
    if (providerMatch) {
      const provider = findProviderBySlug(listProviders(), providerMatch[1].toLowerCase());
      if (!provider) return serveNotFound(request, response);
      if (providerMatch[1] !== providerSlug(provider)) return redirect(request, response, providerPath(provider));
      return serveProvider(request, response, provider);
    }

    // Anything else is a file in public/. Extension-less paths are pages that do not exist.
    if (!path.extname(pathname)) return serveNotFound(request, response);
    return serveFile(request, response, pathname, url);
  };

  // Where a public page request should end up. A profile link for a real
  // provider (?provider=<account id>) goes to that provider's own URL.
  const publicPageLocation = (slug, url) => {
    if (slug === "index") return `/${url.search}`;
    if (slug === "profile") {
      const providerId = url.searchParams.get("provider") || "";
      if (UUID.test(providerId)) {
        const provider = listProviders().find((entry) => entry.id === providerId);
        if (provider) return providerPath(provider);
      }
    }
    return `${pagePath(slug)}${url.search}`;
  };

  return { handle, sitemapPaths };
};

module.exports = { createSite, APP_PAGES, slugify };
