// City landing pages (/directory/<city>) and provider URLs (/providers/<slug>).
//
// Both are driven by the same data the directory API returns, so they never
// show a provider the directory would hide. A city page is indexable only
// while at least one real provider lists that city; an empty one is served
// noindex and left out of the sitemap, so search engines never see thin pages.

const { SITE_NAME, pagePath, absoluteUrl } = require("./config");
const { escapeHtml, breadcrumbSchema } = require("./head");
const { renderHeader, renderFooter, renderAgeGate, renderDocument } = require("./layout");

const slugify = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ---- Providers --------------------------------------------------------------
// The slug is derived from the display name plus the first 8 characters of
// the account id. Nothing is stored: the id part finds the provider, and a
// stale name part (after a rename) redirects to the current slug.

const providerSlug = (provider) => `${slugify(provider.name) || "provider"}-${String(provider.id).slice(0, 8)}`;
const providerPath = (provider) => `/providers/${providerSlug(provider)}`;

const findProviderBySlug = (providers, slug) => {
  const idPrefix = String(slug || "").slice(-8).toLowerCase();
  if (!/^[a-z0-9]{8}$/.test(idPrefix)) return null;
  const matches = providers.filter((provider) => String(provider.id).toLowerCase().startsWith(idPrefix));
  return matches.length === 1 ? matches[0] : null;
};

const providerMeta = (provider) => {
  const where = provider.locations.length ? provider.locations.join(", ") : "Australia";
  const services = provider.services.slice(0, 4).join(", ");
  const title = `${provider.name} in ${where} | ${SITE_NAME}`;
  const description = `${provider.name} is listed on ${SITE_NAME} in ${where}.${
    services ? ` Services include ${services}.` : ""
  } View the profile, availability and booking details.`;
  const path = providerPath(provider);

  return {
    title,
    description,
    canonicalPath: path,
    adult: true,
    ogType: "profile",
    htmlAttributes: `data-provider-id="${escapeHtml(provider.id)}"`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        name: title,
        mainEntity: {
          "@type": "Person",
          name: provider.name,
          ...(provider.locations.length
            ? {
                workLocation: provider.locations.map((city) => ({
                  "@type": "City",
                  name: city,
                  containedInPlace: { "@type": "Country", name: "Australia" }
                }))
              }
            : {})
        }
      },
      breadcrumbSchema([
        ["Home", "/"],
        ["Directory", pagePath("directory")],
        [provider.name, path]
      ])
    ]
  };
};

// ---- Cities -----------------------------------------------------------------

const cityPath = (city) => `${pagePath("directory")}/${slugify(city)}`;
const findCity = (cities, slug) => cities.find((city) => slugify(city) === slug) || null;
const providersInCity = (providers, city) => providers.filter((provider) => provider.locations.includes(city));

const pinSvg =
  '<svg width="9" height="11" viewBox="0 0 9 11" fill="none" aria-hidden="true"><path d="M4.5 0C2.57 0 1 1.57 1 3.5 1 6.38 4.5 11 4.5 11S8 6.38 8 3.5C8 1.57 6.43 0 4.5 0Zm0 4.9a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z" fill="currentColor"/></svg>';

const providerCard = (provider, index) => {
  const initial = escapeHtml((provider.name || "?").charAt(0).toUpperCase());
  const locations = provider.locations.length ? provider.locations.join(", ") : "Location on request";
  const bio = provider.services.length ? provider.services.slice(0, 3).join(", ") : "Services listed on profile";

  return `
          <article class="directory-card directory-card-live">
            <div class="dir-card-media">
              <div class="dir-card-placeholder dir-card-placeholder--${(index % 6) + 1}" aria-hidden="true"><span class="dir-card-initial">${initial}</span></div>
              <div class="dir-card-overlay">
                <div class="dir-card-name-row">
                  <h3 class="dir-card-name">${escapeHtml(provider.name.toUpperCase())}</h3>
                </div>
                <p class="dir-card-location">${pinSvg} ${escapeHtml(locations)}</p>
              </div>
            </div>
            <div class="dir-card-info">
              <p class="dir-card-bio">${escapeHtml(bio)}</p>
              <div class="dir-card-footer">
                <a href="${providerPath(provider)}" class="dir-card-cta">View Profile</a>
              </div>
            </div>
          </article>`;
};

const renderCityPage = (city, cities, providers) => {
  const listed = providersInCity(providers, city);
  const path = cityPath(city);
  const count = listed.length;
  const title = `${city} Escorts & Adult Providers | ${SITE_NAME}`;
  const description = `Browse independent escorts, companions and adult service providers in ${city} on ${SITE_NAME}, Australia's adult network built around safety, support and verification.`;

  const results = count
    ? `
        <div id="directoryCards" class="directory-cards">${listed.map(providerCard).join("")}
        </div>`
    : `
        <p class="directory-empty">No providers are listed in ${escapeHtml(city)} yet. ${SITE_NAME} is welcoming its first providers now.</p>
        <p class="city-actions">
          <a class="light-btn" href="${pagePath("join")}">List your profile</a>
          <a class="light-btn" href="${pagePath("directory")}">Browse the full directory</a>
        </p>`;

  const otherCities = cities
    .filter((other) => other !== city)
    .map((other) => `<a href="${cityPath(other)}">${escapeHtml(other)}</a>`)
    .join("\n            ");

  const html = renderDocument({
    title,
    description,
    bodyClass: "directory-body",
    body: `${renderHeader("directory")}
  <main class="directory-main city-page">
    <section class="dir-hero">
      <p class="dir-hero-eyebrow"><a href="${pagePath("directory")}">${SITE_NAME} Directory</a></p>
      <h1 class="dir-hero-title">${escapeHtml(city)} escorts and providers</h1>
      <div class="dir-hero-rule" aria-hidden="true">
        <span class="dir-hero-rule-line"></span>
        <span class="dir-hero-diamond">✦</span>
        <span class="dir-hero-rule-line"></span>
      </div>
      <p class="dir-hero-subtitle">Independent escorts, companions and adult service providers in ${escapeHtml(city)}.</p>
    </section>

    <section class="city-results" aria-labelledby="cityResultsTitle">
      <div class="dir-results-bar">
        <h2 id="cityResultsTitle" class="dir-results-count">${count} ${count === 1 ? "provider" : "providers"} in ${escapeHtml(city)}</h2>
        <a class="dir-card-cta" href="${pagePath("directory")}?location=${encodeURIComponent(city)}">Filter ${escapeHtml(city)} in the directory</a>
      </div>${results}
    </section>

    <section class="city-guide" aria-labelledby="cityGuideTitle">
      <h2 id="cityGuideTitle">Booking in ${escapeHtml(city)}</h2>
      <p>Each profile is written by the provider and sets out their services, rates, availability and boundaries. Read it in full before you make contact, and follow the screening steps the provider asks for.</p>
      <p>The <a href="${pagePath("safety-hub")}">Safety Hub</a> covers safer meeting, screening and consent. The <a href="${pagePath("client-standards")}">Client Standards</a> set out what ${SITE_NAME} expects from clients, and <a href="${pagePath("verification")}">Verification</a> explains what a verified profile does and does not confirm.</p>
      <p>Offering services in ${escapeHtml(city)}? <a href="${pagePath("join")}">Create a provider profile</a>.</p>
    </section>

    <section class="dir-quick-links city-links" aria-label="Other cities">
      <div class="dir-quick-links-inner">
        <div class="dir-quick-group">
          <p class="dir-quick-label">Other cities</p>
          <nav aria-label="Other cities">
            ${otherCities}
          </nav>
        </div>
      </div>
    </section>
  </main>
${renderAgeGate()}
${renderFooter()}`
  });

  return {
    html,
    indexable: count > 0,
    meta: {
      title,
      description,
      canonicalPath: path,
      noindex: count === 0,
      adult: true,
      jsonLd: [
        breadcrumbSchema([
          ["Home", "/"],
          ["Directory", pagePath("directory")],
          [city, path]
        ]),
        ...(count
          ? [
              {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: title,
                description,
                mainEntity: {
                  "@type": "ItemList",
                  numberOfItems: count,
                  itemListElement: listed.map((provider, index) => ({
                    "@type": "ListItem",
                    position: index + 1,
                    name: provider.name,
                    url: absoluteUrl(providerPath(provider))
                  }))
                }
              }
            ]
          : [])
      ]
    }
  };
};

module.exports = {
  slugify,
  providerSlug,
  providerPath,
  findProviderBySlug,
  providerMeta,
  cityPath,
  findCity,
  providersInCity,
  renderCityPage
};
