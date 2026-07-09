const bizCards    = document.querySelector("#bizCards");
const bizEmpty    = document.querySelector("#bizEmpty");
const bizCount    = document.querySelector("#bizCount");
const searchInput = document.querySelector("#bizSearch");
const catFilter   = document.querySelector("#bizCategory");
const locInput    = document.querySelector("#bizLocation");
const svcInput    = document.querySelector("#bizServices");
const resetBtn    = document.querySelector("#resetBizFilters");

const normalise = (value) => String(value || "").trim().toLowerCase();

const titleCase = (value) =>
  String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const parseServices = (raw) => {
  if (Array.isArray(raw)) return raw.map((s) => String(s || "").trim()).filter(Boolean);
  return String(raw || "").split(",").map((s) => s.trim()).filter(Boolean);
};

const truncate = (text, max) => {
  const str = String(text || "").trim();
  return str.length > max ? `${str.slice(0, max).trimEnd()}…` : str;
};

// All fetched + approved businesses stored here for filtering
let allBusinesses = [];

// ── Card builder ──────────────────────────────────────────────────────────────
const buildCard = (business) => {
  const profile   = business.businessProfile || {};
  const name      = String(business.workingName || "Business").trim();
  const category  = titleCase(business.accountCategory) || "Business";
  const location  = String(profile.location || "").trim();
  const desc      = truncate(profile.description, 160);
  const services  = parseServices(profile.services);

  const card = document.createElement("article");
  card.className = "directory-card";
  // Store normalised data-attributes for filtering
  card.dataset.name     = normalise(name);
  card.dataset.category = normalise(business.accountCategory || "");
  card.dataset.location = normalise(location);
  card.dataset.services = normalise(services.join(" "));

  const servicesHtml = services.length
    ? services.slice(0, 6).map((s) => {
        const span = document.createElement("span");
        span.className = "dir-tag";
        span.textContent = s;
        return span.outerHTML;
      }).join("")
    : "";

  // No media/portrait for businesses — use an initial placeholder
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();

  card.innerHTML = `
    <a class="dir-card-link" href="business-public.html?id=${encodeURIComponent(business.id)}" aria-label="View profile for ${name}">
      <div class="dir-card-media">
        <div class="dir-card-placeholder dir-card-placeholder--1" aria-hidden="true">
          <span class="dir-card-initial">${initials}</span>
        </div>
        <span class="dir-card-badge dir-card-badge--verified">✦ Approved</span>
      </div>

      <div class="dir-card-info">
        <div class="dir-card-name-row">
          <h2 class="dir-card-name">${name}</h2>
        </div>

        <p class="dir-card-location">
          <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true">
            <path d="M5 0C2.79 0 1 1.79 1 4c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4Z" stroke="currentColor" stroke-width="1.3" fill="none"/>
            <circle cx="5" cy="4" r="1.3" fill="currentColor"/>
          </svg>
          ${location ? location : category}
        </p>

        ${desc ? `<p class="dir-card-bio">${desc}</p>` : ""}

        ${servicesHtml ? `<p class="dir-card-bio" style="font-size:0.72rem;opacity:0.7">${servicesHtml}</p>` : ""}

        <div class="dir-card-footer">
          <span class="dir-card-verified-mark">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ${category}
          </span>
          <span class="dir-card-cta">
            View profile
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </div>
      </div>
    </a>
  `;

  return card;
};

// ── Filtering ─────────────────────────────────────────────────────────────────
const applyFilters = () => {
  const query   = normalise(searchInput.value);
  const cat     = normalise(catFilter.value);
  const loc     = normalise(locInput.value);
  const svc     = normalise(svcInput.value);

  const cardEls = [...bizCards.querySelectorAll(".directory-card")];
  let visible = 0;

  cardEls.forEach((card) => {
    const matchQuery = !query ||
      card.dataset.name.includes(query) ||
      card.dataset.category.includes(query) ||
      card.dataset.location.includes(query) ||
      card.dataset.services.includes(query);

    const matchCat = !cat || card.dataset.category === cat;
    const matchLoc = !loc || card.dataset.location.includes(loc);
    const matchSvc = !svc || card.dataset.services.includes(svc);

    const show = matchQuery && matchCat && matchLoc && matchSvc;
    card.hidden = !show;
    if (show) visible++;
  });

  updateCount(visible);
  bizEmpty.hidden = visible > 0 || allBusinesses.length === 0;
};

const updateCount = (n) => {
  const total = allBusinesses.length;
  if (total === 0) {
    bizCount.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="8" y="1" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="1" y="8" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="8" y="8" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/></svg> No approved businesses`;
    return;
  }
  const label = n === total
    ? `<span>${total}</span> ${total === 1 ? "business" : "businesses"}`
    : `<span>${n}</span> of ${total} ${total === 1 ? "business" : "businesses"}`;
  bizCount.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="8" y="1" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="1" y="8" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="8" y="8" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/></svg> ${label}`;
};

// ── Data fetch & render ───────────────────────────────────────────────────────
const loadBusinesses = async () => {
  bizCount.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="8" y="1" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="1" y="8" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="8" y="8" width="5" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/></svg> Loading…`;

  try {
    const response = await fetch("/api/directory/businesses");
    if (!response.ok) throw new Error("API error");
    const result = await response.json();
    // API already filters to role=business + applicationStatus=approved — safe to use directly
    allBusinesses = Array.isArray(result?.businesses) ? result.businesses : [];
  } catch {
    allBusinesses = [];
  }

  bizCards.replaceChildren();
  allBusinesses.forEach((biz) => bizCards.appendChild(buildCard(biz)));

  bizEmpty.hidden = allBusinesses.length > 0;
  updateCount(allBusinesses.length);
};

// ── Event listeners ───────────────────────────────────────────────────────────
[searchInput, locInput, svcInput].forEach((el) => {
  if (el) el.addEventListener("input", applyFilters);
});
if (catFilter) catFilter.addEventListener("change", applyFilters);

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (catFilter)   catFilter.value   = "";
    if (locInput)    locInput.value    = "";
    if (svcInput)    svcInput.value    = "";
    applyFilters();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadBusinesses();
