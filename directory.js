const filterForm = document.querySelector(".directory-filters");
const cardsContainer = document.querySelector("#directoryCards");
let cards = [...document.querySelectorAll(".directory-card")];
const count = document.querySelector("#directoryCount");
const emptyState = document.querySelector("#directoryEmpty");
const search = document.querySelector("#directorySearch");
const locationFilter = document.querySelector("#directoryLocation");
const categoryFilter = document.querySelector("#directoryCategory");
const attributeFilter = document.querySelector("#directoryAttribute");
const priceFilter = document.querySelector("#directoryPrice");
const priceValue = document.querySelector("#directoryPriceValue");
const pricePoaFilter = document.querySelector("#directoryPricePoa");
const identityFilter = document.querySelector("#directoryIdentity");
const availabilityFilter = document.querySelector("#directoryAvailability");
const verifiedFilter = document.querySelector("#directoryVerified");
const sortFilter = document.querySelector("#directorySort");
const resetButton = document.querySelector("#resetDirectory");
const menuButton = document.querySelector(".directory-menu-button");
const nav = document.querySelector("#directoryNav");
const openFilters = document.querySelector("#openFilters");
const closeFilters = document.querySelector("#closeFilters");
const pageTitle = document.querySelector("#directoryPageTitle");
const pageIntro = document.querySelector("#directoryPageIntro");
const defaultPageTitle = pageTitle.textContent;
const defaultPageIntro = pageIntro.textContent;
const defaultDocumentTitle = document.title;

const normalise = (value) => value.trim().toLowerCase();
const customSelects = [];
const supportsHoverDropdowns = window.matchMedia("(hover: hover) and (pointer: fine)");
let hoverCloseTimer = null;

const clearHoverCloseTimer = () => {
  if (!hoverCloseTimer) return;
  window.clearTimeout(hoverCloseTimer);
  hoverCloseTimer = null;
};

const openCustomSelect = (shell, button) => {
  clearHoverCloseTimer();
  closeCustomSelects(shell);
  shell.classList.add("is-open");
  button.setAttribute("aria-expanded", "true");
};

const closeCustomSelects = (activeShell = null) => {
  clearHoverCloseTimer();
  customSelects.forEach(({ shell, button }) => {
    if (shell === activeShell) return;
    shell.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
  });
};

const closeCustomSelectsWithGrace = () => {
  clearHoverCloseTimer();
  hoverCloseTimer = window.setTimeout(() => {
    hoverCloseTimer = null;
    closeCustomSelects();
  }, 280);
};

const syncCustomSelect = ({ select, button, valueLabel, items }) => {
  const selectedOption = select.options[select.selectedIndex] || select.options[0];
  valueLabel.textContent = selectedOption ? selectedOption.textContent : "";
  items.forEach((item) => {
    const isSelected = item.dataset.value === select.value;
    item.classList.toggle("is-selected", isSelected);
    item.setAttribute("aria-selected", String(isSelected));
  });
};

const enhanceDirectorySelects = () => {
  document.querySelectorAll(".directory-filters select").forEach((select) => {
    if (select.dataset.customSelect === "true") return;
    if (select.dataset.noEnhance !== undefined) return;
    select.dataset.customSelect = "true";

    const shell = document.createElement("div");
    shell.className = "directory-custom-select";
    select.parentNode.insertBefore(shell, select);
    shell.appendChild(select);
    select.classList.add("directory-native-select");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "directory-custom-select-button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");

    const valueLabel = document.createElement("span");
    valueLabel.className = "directory-custom-select-value";
    const arrow = document.createElement("span");
    arrow.className = "directory-custom-select-arrow";
    arrow.setAttribute("aria-hidden", "true");
    button.append(valueLabel, arrow);

    const menu = document.createElement("div");
    menu.className = "directory-custom-select-menu";
    menu.setAttribute("role", "listbox");

    const items = [...select.options].map((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "directory-custom-select-option";
      item.textContent = option.textContent;
      item.dataset.value = option.value;
      item.setAttribute("role", "option");
      item.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncCustomSelect({ select, button, valueLabel, items });
        closeCustomSelects();
      });
      menu.appendChild(item);
      return item;
    });

    button.addEventListener("click", () => {
      const willOpen = !shell.classList.contains("is-open");
      closeCustomSelects(willOpen ? shell : null);
      shell.classList.toggle("is-open", willOpen);
      button.setAttribute("aria-expanded", String(willOpen));
    });

    shell.addEventListener("mouseenter", () => {
      if (supportsHoverDropdowns.matches) openCustomSelect(shell, button);
    });

    shell.addEventListener("mouseleave", () => {
      if (supportsHoverDropdowns.matches) closeCustomSelectsWithGrace();
    });

    select.addEventListener("change", () => syncCustomSelect({ select, button, valueLabel, items }));
    shell.append(button, menu);
    const customSelect = { select, shell, button, valueLabel, items };
    customSelects.push(customSelect);
    syncCustomSelect(customSelect);
  });
};

const syncCustomSelects = () => {
  customSelects.forEach(syncCustomSelect);
};

const updatePriceReadout = () => {
  if (!priceFilter || !priceValue) return;
  const price = Number(priceFilter.value);
  const max = Number(priceFilter.max);
  priceValue.textContent = price >= max ? "Any price" : `$${price.toLocaleString("en-AU")}`;
};

const cardMatchesPrice = (card, maxPrice, includePoa) => {
  const rawPrice = card.dataset.price || "";
  if (!rawPrice || rawPrice === "poa") return includePoa;
  const numericPrice = Number(rawPrice);
  if (!Number.isFinite(numericPrice)) return includePoa;
  return numericPrice <= maxPrice;
};

const applyUrlFilters = () => {
  const params = new URLSearchParams(window.location.search);
  const location = params.get("location");
  const status = params.get("status");
  const availability = params.get("availability");
  const service = params.get("service");
  const attribute = params.get("attribute");
  const query = params.get("search");

  if (query) {
    search.value = query;
  }

  if (location && [...locationFilter.options].some((option) => option.value === location)) {
    locationFilter.value = location;
  }

  if (status && [...verifiedFilter.options].some((option) => option.value === status)) {
    verifiedFilter.value = status;
  }

  if (availability && [...availabilityFilter.options].some((option) => option.value === availability)) {
    availabilityFilter.value = availability;
  }

  if (service && [...categoryFilter.options].some((option) => option.value === service)) {
    categoryFilter.value = service;
  }

  if (attribute && [...attributeFilter.options].some((option) => option.value === attribute)) {
    attributeFilter.value = attribute;
  }

  const activePage = location || service || attribute || query;
  if (activePage) {
    pageTitle.textContent = `${activePage} providers`;
    pageIntro.textContent = `Browse profiles that have selected ${activePage} as part of their public directory information.`;
    document.title = `${activePage} Providers | TemptX`;
  }
};

const clearDirectoryUrlFilters = () => {
  if (!window.location.search) return;
  window.history.replaceState({}, "", window.location.pathname);
  pageTitle.textContent = defaultPageTitle;
  pageIntro.textContent = defaultPageIntro;
  document.title = defaultDocumentTitle;
};

const clearUrlParam = (name) => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has(name)) return;
  params.delete(name);
  const nextUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);
  if (!params.toString()) {
    pageTitle.textContent = defaultPageTitle;
    pageIntro.textContent = defaultPageIntro;
    document.title = defaultDocumentTitle;
  }
};

const applyFilters = () => {
  const query = normalise(search.value);
  const selectedLocation = normalise(locationFilter.value);
  const selectedCategory = normalise(categoryFilter.value);
  const selectedAttribute = normalise(attributeFilter.value);
  const selectedPrice = Number(priceFilter.value);
  const includePoa = pricePoaFilter.checked;
  const selectedIdentity = normalise(identityFilter.value);
  const selectedAvailability = normalise(availabilityFilter.value);
  const selectedStatus = normalise(verifiedFilter.value);

  const visibleCards = cards.filter((card) => {
    const searchable = normalise(
      `${card.dataset.name} ${card.dataset.location} ${card.dataset.category} ${card.dataset.attributes || ""} ${card.textContent}`
    );
    const matchesQuery = !query || searchable.includes(query);
    const matchesLocation = !selectedLocation || normalise(card.dataset.location).split("|").includes(selectedLocation);
    const matchesCategory = !selectedCategory || normalise(card.dataset.category).split("|").includes(selectedCategory);
    const matchesAttribute =
      !selectedAttribute || normalise(card.dataset.attributes || "").split("|").includes(selectedAttribute);
    const matchesPrice = cardMatchesPrice(card, selectedPrice, includePoa);
    const matchesIdentity = !selectedIdentity || normalise(card.dataset.identity || "") === selectedIdentity;
    const matchesAvailability = !selectedAvailability || normalise(card.dataset.availability) === selectedAvailability;
    const matchesStatus = !selectedStatus || normalise(card.dataset.status).includes(selectedStatus);
    const isVisible =
      matchesQuery &&
      matchesLocation &&
      matchesCategory &&
      matchesAttribute &&
      matchesPrice &&
      matchesIdentity &&
      matchesAvailability &&
      matchesStatus;
    card.hidden = !isVisible;
    return isVisible;
  });

  const sortMode = sortFilter.value;
  visibleCards
    .sort((first, second) => {
      if (sortMode === "name") return first.dataset.name.localeCompare(second.dataset.name);
      if (sortMode === "location") return first.dataset.location.localeCompare(second.dataset.location);
      return cards.indexOf(first) - cards.indexOf(second);
    })
    .forEach((card) => cardsContainer.appendChild(card));

  count.textContent = visibleCards.length;
  emptyState.hidden = visibleCards.length !== 0;
};

filterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  applyFilters();
  filterForm.classList.remove("is-open");
});

[search, locationFilter, categoryFilter, attributeFilter, identityFilter, availabilityFilter, verifiedFilter, sortFilter].forEach((control) => {
  control.addEventListener(control === search ? "input" : "change", applyFilters);
});

categoryFilter.addEventListener("change", () => {
  if (!categoryFilter.value) clearUrlParam("service");
});

priceFilter.addEventListener("input", () => {
  updatePriceReadout();
  applyFilters();
});

pricePoaFilter.addEventListener("change", applyFilters);

resetButton.addEventListener("click", () => {
  filterForm.reset();
  if (verifiedCheckbox) verifiedCheckbox.checked = false;
  clearDirectoryUrlFilters();
  syncCustomSelects();
  updatePriceReadout();
  applyFilters();
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((viewButton) => viewButton.classList.remove("is-active"));
    button.classList.add("is-active");
    cardsContainer.classList.toggle("is-list", button.dataset.view === "list");
  });
});

if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}

openFilters.addEventListener("click", () => filterForm.classList.add("is-open"));
closeFilters.addEventListener("click", () => filterForm.classList.remove("is-open"));

document.addEventListener("click", (event) => {
  if (!event.target.closest(".directory-custom-select")) closeCustomSelects();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCustomSelects();
});

const verifiedCheckbox = document.querySelector("#dir-verified-checkbox");
if (verifiedCheckbox && verifiedFilter) {
  verifiedCheckbox.addEventListener("change", () => {
    verifiedFilter.value = verifiedCheckbox.checked ? "verified" : "";
    applyFilters();
  });
}

const checkmarkSvg = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true"><path d="M10 5.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" fill="currentColor" opacity=".18"/><path d="M3.5 5.5 5 7l3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const pinSvg = `<svg width="9" height="11" viewBox="0 0 9 11" fill="none" aria-hidden="true"><path d="M4.5 0C2.57 0 1 1.57 1 3.5 1 6.38 4.5 11 4.5 11S8 6.38 8 3.5C8 1.57 6.43 0 4.5 0Zm0 4.9a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z" fill="currentColor"/></svg>`;

const PLACEHOLDER_CLASSES = [
  "dir-card-placeholder--1",
  "dir-card-placeholder--2",
  "dir-card-placeholder--3",
  "dir-card-placeholder--4",
  "dir-card-placeholder--5",
  "dir-card-placeholder--6",
];

let liveCardIndex = 0;

const createProviderCard = (provider) => {
  const card = document.createElement("article");
  const locations = provider.locations || [];
  const services = provider.services || [];
  const attributes = provider.attributes || [];
  const locationText = locations.length ? locations.join(", ") : "Location on request";
  const bioText = services.length
    ? services.slice(0, 3).join(", ")
    : "Services listed on profile";
  const placeholderClass = PLACEHOLDER_CLASSES[liveCardIndex % PLACEHOLDER_CLASSES.length];
  liveCardIndex++;
  const initial = (provider.name || "?").charAt(0).toUpperCase();
  const profileHref = `profile.html?provider=${encodeURIComponent(provider.id)}`;

  card.className = "directory-card directory-card-live";
  card.dataset.name = provider.name;
  card.dataset.location = locations.join("|");
  card.dataset.category = services.join("|");
  card.dataset.attributes = attributes.join("|");
  card.dataset.price = "";
  card.dataset.identity = "";
  card.dataset.availability = "";
  card.dataset.status = "";
  card.dataset.tag = "new";

  card.innerHTML = `
    <div class="dir-card-media">
      ${provider.photo
        ? `<img src="${provider.photo}" alt="${provider.name}" loading="lazy" />`
        : `<div class="dir-card-placeholder ${placeholderClass}" aria-hidden="true"><span class="dir-card-initial">${initial}</span></div>`
      }
      <span class="dir-card-badge dir-card-badge--new">New</span>
    </div>
    <div class="dir-card-info">
      <div class="dir-card-name-row">
        <h3 class="dir-card-name">${provider.name.toUpperCase()}</h3>
        <span class="dir-card-verified-mark">${checkmarkSvg} Verified</span>
      </div>
      <p class="dir-card-location">${pinSvg} ${locationText}</p>
      <p class="dir-card-bio">${bioText}</p>
      <div class="dir-card-footer">
        <span class="dir-card-status">
          <span class="dir-status-dot"></span>Available
        </span>
        <a href="${profileHref}" class="dir-card-cta">View Profile →</a>
      </div>
    </div>
  `;

  return card;
};

const loadProviders = async () => {
  try {
    const response = await fetch("/api/directory/providers");
    if (!response.ok) throw new Error("Directory API unavailable");
    const result = await response.json();
    const providers = Array.isArray(result?.providers) ? result.providers : [];

    if (providers.length) {
      providers.forEach((provider) => cardsContainer.prepend(createProviderCard(provider)));
      cards = [...document.querySelectorAll(".directory-card")];
      return;
    }
  } catch {
    // Fall back to demo providers when the local account server is offline or returns no data.
  }

  const fallbackProviders = [
    {
      id: "demo-1",
      name: "Luna Wellness",
      locations: ["London"],
      services: ["Massage", "Reflexology"],
      attributes: ["Verified", "In-person"],
      photo: ""
    },
    {
      id: "demo-2",
      name: "Aurora Studio",
      locations: ["Manchester", "Birmingham"],
      services: ["Facial", "Bodywork"],
      attributes: ["Luxury", "Mobile"],
      photo: ""
    },
    {
      id: "demo-3",
      name: "Solstice Retreat",
      locations: ["Brighton"],
      services: ["Sauna", "Private Sessions"],
      attributes: ["Couples", "Evening"],
      photo: ""
    }
  ];

  fallbackProviders.forEach((provider) => cardsContainer.prepend(createProviderCard(provider)));
  cards = [...document.querySelectorAll(".directory-card")];
};

const initialiseDirectory = async () => {
  enhanceDirectorySelects();
  await loadProviders();
  applyUrlFilters();
  syncCustomSelects();
  updatePriceReadout();
  applyFilters();
};

initialiseDirectory();
