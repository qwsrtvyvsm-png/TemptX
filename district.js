const cards = document.querySelector("#districtBusinessCards");
const results = document.querySelector("#districtResults");
const empty = document.querySelector("#districtEmpty");
const search = document.querySelector("#districtSearch");
const location = document.querySelector("#districtLocation");
const sideLocation = document.querySelector("#districtSideLocation");
const category = document.querySelector("#districtCategory");
const services = document.querySelector("#districtServices");
const verified = document.querySelector("#districtVerified");
const form = document.querySelector("#districtSearchForm");
const filters = document.querySelector("#districtFilters");
const featured = document.querySelector("#districtFeatured");
const featuredBanner = document.querySelector("#districtFeaturedBanner");
let businesses = [];
const normalise = (value) => String(value || "").trim().toLowerCase();
const serviceList = (value) => Array.isArray(value) ? value : String(value || "").split(",");
const titleCase = (value) => String(value || "Business").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const initialsFor = (name) => name.split(/\s+/).map((word) => word[0] || "").slice(0, 2).join("").toUpperCase();
const toneFor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % 5;
  return String(hash + 1);
};
const categoryLabel = (business) => {
  const raw = normalise(business.accountCategory);
  if (raw.includes("venue")) return "Venues";
  if (raw.includes("photo") || raw.includes("media") || raw.includes("studio")) return "Creative";
  if (raw.includes("support") || raw.includes("legal") || raw.includes("professional")) return "Professional";
  if (raw.includes("wellness") || raw.includes("health") || raw.includes("beauty")) return "Wellness";
  if (raw.includes("service")) return "Services";
  return "Retail";
};
const shortDescription = (profile, business) => {
  const text = String(profile.description || "").trim();
  if (text) return text.length > 96 ? text.slice(0, 93).trim() + "…" : text;
  return titleCase(business.accountCategory) + " storefront in the District";
};

const syncLocation = (source) => { if (source === location && sideLocation) sideLocation.value = location.value; if (source === sideLocation && location) location.value = sideLocation.value; };
const matches = (business) => {
  const profile = business.businessProfile || {};
  const query = normalise([search.value, services.value].filter(Boolean).join(" "));
  const selectedLocation = normalise(location.value || sideLocation.value);
  const selectedCategory = normalise(category.value);
  const haystack = normalise([business.workingName, business.accountCategory, profile.location, profile.description, serviceList(profile.services).join(" ")].join(" "));
  return (!query || haystack.includes(query)) && (!selectedLocation || normalise(profile.location).includes(selectedLocation)) && (!selectedCategory || normalise(business.accountCategory) === selectedCategory) && (!verified.checked || business.applicationStatus === "approved");
};

const pinIcon = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z"/><circle cx="12" cy="11" r="2.2"/></svg>';
const shieldIcon = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3 5 6v5c0 5 3.2 8.4 7 9.8 3.8-1.4 7-4.8 7-9.8V6l-7-3Z"/><path d="m9.2 12 1.9 1.9 3.7-3.8"/></svg>';

const cardFor = (business) => {
  const profile = business.businessProfile || {};
  const name = String(business.workingName || "Business").trim();
  const card = document.createElement("article");
  card.className = "district-business-card";
  card.dataset.tone = toneFor(name);
  const link = document.createElement("a");
  link.href = "business-public.html?id=" + encodeURIComponent(business.id);
  link.setAttribute("aria-label", "View " + name + " storefront");
  const media = document.createElement("div");
  media.className = "district-business-media";
  media.innerHTML = "<span>" + initialsFor(name) + "</span>";
  const body = document.createElement("div");
  body.className = "district-business-body";
  const titleRow = document.createElement("div");
  titleRow.className = "district-business-title-row";
  const heading = document.createElement("h3");
  heading.textContent = name;
  titleRow.append(heading);
  if (business.applicationStatus === "approved") {
    const verifiedMark = document.createElement("span");
    verifiedMark.className = "district-verified-mark";
    verifiedMark.setAttribute("aria-label", "Verified business");
    verifiedMark.innerHTML = shieldIcon;
    titleRow.append(verifiedMark);
  }
  const tagline = document.createElement("p");
  tagline.className = "district-business-kind";
  tagline.textContent = shortDescription(profile, business);
  const footer = document.createElement("div");
  footer.className = "district-business-meta";
  const place = document.createElement("span");
  place.className = "district-business-place";
  place.innerHTML = pinIcon + " <span>" + (profile.location || "Australia") + "</span>";
  const kind = document.createElement("span");
  kind.className = "district-business-pill";
  kind.textContent = categoryLabel(business);
  footer.append(place, kind);
  body.append(titleRow, tagline, footer);
  link.append(media, body);
  card.append(link);
  return card;
};

const renderFeatured = (business) => {
  if (!featured || !featuredBanner) return;
  if (!business) {
    featured.hidden = true;
    featuredBanner.replaceChildren();
    return;
  }
  const profile = business.businessProfile || {};
  const name = String(business.workingName || "Business").trim();
  const media = document.createElement("div");
  media.className = "district-featured-media";
  media.dataset.tone = toneFor(name);
  media.innerHTML = "<span>" + initialsFor(name) + "</span>";
  const body = document.createElement("div");
  body.className = "district-featured-body";
  const heading = document.createElement("h3");
  heading.textContent = name;
  const copy = document.createElement("p");
  copy.textContent = shortDescription(profile, business);
  const meta = document.createElement("div");
  meta.className = "district-featured-meta";
  const place = document.createElement("span");
  place.innerHTML = pinIcon + " <span>" + (profile.location || "Australia") + "</span>";
  meta.append(place);
  if (business.applicationStatus === "approved") {
    const badge = document.createElement("span");
    badge.className = "district-featured-verified";
    badge.innerHTML = shieldIcon + " <span>Verified Business</span>";
    meta.append(badge);
  }
  const actions = document.createElement("div");
  actions.className = "district-featured-actions";
  const pill = document.createElement("span");
  pill.className = "district-business-pill";
  pill.textContent = categoryLabel(business);
  const cta = document.createElement("a");
  cta.href = "business-public.html?id=" + encodeURIComponent(business.id);
  cta.className = "district-featured-cta";
  cta.textContent = "View storefront";
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = " →";
  cta.append(arrow);
  actions.append(pill, cta);
  body.append(heading, copy, meta, actions);
  featuredBanner.replaceChildren(media, body);
  featured.hidden = false;
};

const render = () => {
  const visible = businesses.filter(matches);
  cards.replaceChildren(...visible.map(cardFor));
  empty.hidden = visible.length !== 0;
  results.textContent = visible.length ? visible.length + (visible.length === 1 ? " business" : " businesses") + " in the District" : "No matching businesses";
  const featuredBusiness = visible.find((business) => business.applicationStatus === "approved") || visible[0] || null;
  renderFeatured(featuredBusiness);
};
const setStats = () => {
  const locations = new Set(), categories = new Set();
  businesses.forEach((business) => {
    const profile = business.businessProfile || {};
    if (profile.location) locations.add(profile.location);
    if (business.accountCategory) categories.add(business.accountCategory);
  });
  document.querySelector("#districtBusinessCount").textContent = businesses.length;
  document.querySelector("#districtCityCount").textContent = locations.size;
  document.querySelector("#districtCategoryCount").textContent = categories.size;
};
const runQuery = (value) => { search.value = value || ""; render(); document.querySelector("#businesses")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
form.addEventListener("submit", (event) => { event.preventDefault(); syncLocation(location); render(); document.querySelector("#businesses")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
[search, services].forEach((input) => input.addEventListener("input", render));
[location, sideLocation, category, verified].forEach((input) => input.addEventListener("change", () => { if (input === location || input === sideLocation) syncLocation(input); render(); }));
filters.addEventListener("reset", () => window.setTimeout(() => { location.value = ""; sideLocation.value = ""; render(); }, 0));
document.querySelectorAll("[data-district-query]").forEach((link) => link.addEventListener("click", (event) => { if (link.tagName === "A") event.preventDefault(); runQuery(link.dataset.districtQuery); }));
document.querySelectorAll("[data-district-category]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); category.value = link.dataset.districtCategory; document.querySelectorAll("[data-district-category]").forEach((item) => item.classList.toggle("is-current", item === link)); render(); document.querySelector("#businesses")?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
fetch("/api/directory/businesses").then((response) => response.ok ? response.json() : Promise.reject(new Error("Business directory unavailable"))).then((result) => { businesses = Array.isArray(result.businesses) ? result.businesses : []; setStats(); render(); }).catch(() => { businesses = []; setStats(); render(); });
