const businessId = new URLSearchParams(window.location.search).get("id");

const statusMessage = document.querySelector("#businessPublicStatus");
const profileContent = document.querySelector("#businessPublicContent");
const nameElement = document.querySelector("#businessPublicName");
const categoryElement = document.querySelector("#businessPublicCategory");
const descriptionElement = document.querySelector("#businessPublicDescription");
const locationElement = document.querySelector("#businessPublicLocation");
const openingHoursElement = document.querySelector("#businessPublicOpeningHours");
const priceRangeElement = document.querySelector("#businessPublicPriceRange");
const websiteRow = document.querySelector("#businessWebsiteRow");
const websiteLink = document.querySelector("#businessPublicWebsite");
const approvedBadge = document.querySelector("#businessApprovedBadge");
const servicesList = document.querySelector("#businessPublicServicesList");

const titleCase = (value) =>
  String(value || "")
    .trim()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const parseServices = (rawServices) => {
  if (Array.isArray(rawServices)) {
    return rawServices.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(rawServices || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const renderUnavailable = () => {
  if (statusMessage) {
    statusMessage.hidden = false;
    statusMessage.textContent = "Business profile not available";
  }
  if (profileContent) {
    profileContent.hidden = true;
  }
  document.title = "Business profile not available | TEMPTX";
};

const safeText = (value, fallback = "Not provided") => {
  const nextValue = String(value || "").trim();
  return nextValue || fallback;
};

const normaliseWebsite = (website) => {
  const raw = String(website || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

const renderBusiness = (business) => {
  const profile = business.businessProfile || {};
  const displayName = safeText(business.workingName, "Business");
  const category = titleCase(business.accountCategory) || "Business";
  const services = parseServices(profile.services);
  const website = normaliseWebsite(profile.website);

  if (statusMessage) statusMessage.hidden = true;
  if (profileContent) profileContent.hidden = false;

  if (nameElement) nameElement.textContent = displayName;
  if (categoryElement) categoryElement.textContent = category;
  if (descriptionElement) descriptionElement.textContent = safeText(profile.description);
  if (locationElement) locationElement.textContent = safeText(profile.location);
  if (openingHoursElement) openingHoursElement.textContent = safeText(profile.openingHours);
  if (priceRangeElement) priceRangeElement.textContent = safeText(profile.priceRange);

  if (approvedBadge) {
    approvedBadge.hidden = business.applicationStatus !== "approved";
  }

  if (websiteRow && websiteLink) {
    if (website) {
      websiteRow.hidden = false;
      websiteLink.href = website;
      websiteLink.textContent = website;
    } else {
      websiteRow.hidden = true;
      websiteLink.removeAttribute("href");
      websiteLink.textContent = "";
    }
  }

  if (servicesList) {
    servicesList.replaceChildren();
    if (services.length) {
      services.forEach((service) => {
        const item = document.createElement("li");
        item.textContent = service;
        servicesList.appendChild(item);
      });
    } else {
      const item = document.createElement("li");
      item.textContent = "Not provided";
      servicesList.appendChild(item);
    }
  }

  document.title = `${displayName} | TEMPTX`;
};

const loadBusinessProfile = async () => {
  if (!businessId) {
    renderUnavailable();
    return;
  }

  try {
    const response = await fetch("/api/directory/businesses");
    if (!response.ok) {
      renderUnavailable();
      return;
    }

    const result = await response.json();
    const businesses = Array.isArray(result?.businesses) ? result.businesses : [];
    const business = businesses.find((item) => item.id === businessId);

    if (!business) {
      renderUnavailable();
      return;
    }

    renderBusiness(business);
  } catch {
    renderUnavailable();
  }
};

loadBusinessProfile();
