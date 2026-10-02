// Renders an information page (About, Safety Hub, Terms, ...) from
// content/info-pages.js into complete HTML, so the heading, body text and
// navigation are in the response that search engines and AI crawlers read.

const { pageContent } = require("../../content/info-pages");
const { SITE_NAME, pagePath, resolveHref } = require("./config");
const { escapeHtml, breadcrumbSchema } = require("./head");
const { renderHeader, renderFooter, renderDocument } = require("./layout");

const infoPageSlugs = () => Object.keys(pageContent);
const hasInfoPage = (slug) => Object.prototype.hasOwnProperty.call(pageContent, slug);

// Other pages in the same group, so every information page is reachable by
// a plain link from its siblings.
const relatedPages = (slug, isAvailable) => {
  const group = pageContent[slug].group;
  return Object.entries(pageContent)
    .filter(([key, entry]) => key !== slug && entry.group === group && isAvailable(key))
    .map(([key, entry]) => ({ slug: key, title: entry.title }));
};

const faqSchema = (content) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: content.sections.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer }
  }))
});

// isAvailable(slug) tells the renderer which sibling slugs resolve to a real page.
const renderInfoPage = (slug, { isAvailable = hasInfoPage } = {}) => {
  const content = pageContent[slug];
  if (!content) return null;

  const cards = content.sections
    .map(
      ([heading, copy], index) => `
      <article class="content-card">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <h2>${escapeHtml(heading)}</h2>
        <p>${escapeHtml(copy)}</p>
      </article>`
    )
    .join("");

  const action = content.action
    ? `<a class="light-btn content-action" href="${escapeHtml(resolveHref(content.action[1]))}">${escapeHtml(content.action[0])}</a>`
    : "";

  const related = relatedPages(slug, isAvailable);
  const relatedNav = related.length
    ? `
    <nav class="content-related" aria-label="More in ${escapeHtml(content.group)}">
      <h2>More in ${escapeHtml(content.group)}</h2>
      <ul>${related
        .map((page) => `
        <li><a href="${pagePath(page.slug)}">${escapeHtml(page.title)}</a></li>`)
        .join("")}
      </ul>
    </nav>`
    : "";

  const title = `${content.title} | ${SITE_NAME}`;
  const html = renderDocument({
    title,
    description: content.intro,
    bodyClass: "cinematic-background content-body",
    bodyAttributes: `data-info-page="${escapeHtml(slug)}"`,
    body: `  <div id="contentHeader">${renderHeader(slug)}</div>
  <main class="content-shell">
    <section class="content-hero">
      <p class="eyebrow" id="contentEyebrow">${escapeHtml(content.group)}</p>
      <h1 id="contentTitle">${escapeHtml(content.title)}</h1>
      <p id="contentIntro">${escapeHtml(content.intro)}</p>
      <div id="contentAction">${action}</div>
    </section>
    <section class="content-grid" id="contentCards">${cards}
    </section>${relatedNav}
  </main>
${renderFooter()}`
  });

  const jsonLd = [breadcrumbSchema([["Home", "/"], [content.title, pagePath(slug)]])];
  if (slug === "faq") jsonLd.push(faqSchema(content));

  return { html, meta: { title, description: content.intro, jsonLd } };
};

module.exports = { infoPageSlugs, hasInfoPage, renderInfoPage };
