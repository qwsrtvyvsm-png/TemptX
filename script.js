const ageGate = document.querySelector("#ageGate");
const pwaScript = document.createElement("script");
pwaScript.src = "pwa.js";
document.head.appendChild(pwaScript);

const enterSite = document.querySelector("#enterSite");
const leaveSite = document.querySelector("#leaveSite");
const joinForm = document.querySelector(".join-form");
const formNote = document.querySelector(".form-note");
const searchInput = document.querySelector(".search-trigger");
const directorySection = document.querySelector("#directory");
const directoryStatus = document.querySelector(".directory-search-status");
const searchableCards = document.querySelectorAll(".category-card, .advertiser-card");
const directoryLinks = document.querySelectorAll('.dropdown-menu a[href*="#directory"]');
const loginLinks = document.querySelectorAll("[data-login]");
const logoutLinks = document.querySelectorAll("[data-logout]");
const favouriteProviderButtons = document.querySelectorAll("[data-favourite-provider]");
const favouritesStorageKey = "temptxFavouriteProviders";

const getFavouriteProviders = () => {
  try {
    return JSON.parse(localStorage.getItem(favouritesStorageKey)) || {};
  } catch {
    return {};
  }
};

const updateFavouriteProviderButtons = () => {
  const favourites = getFavouriteProviders();

  favouriteProviderButtons.forEach((button) => {
    const isFavourite = Boolean(favourites[button.dataset.favouriteProvider]);
    button.classList.toggle("is-favourite", isFavourite);
    button.textContent = isFavourite ? "Saved to Favourites" : "Save to Favourites";
    button.setAttribute("aria-pressed", String(isFavourite));
  });
};

favouriteProviderButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const favourites = getFavouriteProviders();
    const providerId = button.dataset.favouriteProvider;

    if (favourites[providerId]) {
      delete favourites[providerId];
    } else {
      favourites[providerId] = {
        id: providerId,
        name: button.dataset.providerName || "Provider"
      };
    }

    localStorage.setItem(favouritesStorageKey, JSON.stringify(favourites));
    updateFavouriteProviderButtons();
  });
});

const ageConfirmed = sessionStorage.getItem("temptxAgeConfirmed") === "true";

if (ageGate && enterSite && leaveSite) {
  if (ageConfirmed) {
    ageGate.classList.add("hidden");
  } else {
    document.body.classList.add("gate-open");
  }

  enterSite.addEventListener("click", () => {
    sessionStorage.setItem("temptxAgeConfirmed", "true");
    ageGate.classList.add("hidden");
    document.body.classList.remove("gate-open");
  });

  leaveSite.addEventListener("click", () => {
    window.location.href = "https://www.google.com";
  });
}

if (joinForm && formNote) {
  joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    joinForm.reset();
    formNote.textContent = "Thanks. Your interest has been noted privately on this device.";
    formNote.classList.add("success");
  });
}

const normaliseSearch = (value) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const filterDirectory = (query) => {
  if (!searchableCards.length) {
    return;
  }

  const cleanedQuery = normaliseSearch(query);
  let visibleCount = 0;

  searchableCards.forEach((card) => {
    const searchText = normaliseSearch(`${card.textContent} ${card.dataset.search || ""}`);
    const isVisible = !cleanedQuery || searchText.includes(cleanedQuery);

    card.classList.toggle("is-hidden", !isVisible);
    if (isVisible) {
      visibleCount += 1;
    }
  });

  if (directoryStatus) {
    if (!cleanedQuery) {
      directoryStatus.textContent = "Showing all options.";
    } else if (visibleCount === 1) {
      directoryStatus.textContent = `Showing 1 result for "${query}".`;
    } else {
      directoryStatus.textContent = `Showing ${visibleCount} results for "${query}".`;
    }
  }
};

const applyDirectorySearch = (query, shouldScroll = true) => {
  if (searchInput) {
    searchInput.value = query;
  }

  filterDirectory(query);

  if (shouldScroll && directorySection) {
    directorySection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

if (searchInput) {
  searchInput.addEventListener("input", () => {
    applyDirectorySearch(searchInput.value, false);
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyDirectorySearch(searchInput.value);
    }
  });
}

directoryLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const query = link.textContent.trim();

    if (directorySection) {
      event.preventDefault();
      applyDirectorySearch(query);
      history.replaceState(null, "", `#directory?search=${encodeURIComponent(query)}`);
      return;
    }

    const url = new URL(link.href);
    url.hash = `directory?search=${encodeURIComponent(query)}`;
    link.href = url.toString();
  });
});

const initialSearch = new URLSearchParams(window.location.hash.split("?")[1] || "").get("search");

if (initialSearch) {
  applyDirectorySearch(initialSearch);
}

const updateAccountActions = (isLoggedIn) => {
  loginLinks.forEach((link) => {
    link.hidden = isLoggedIn;
  });

  logoutLinks.forEach((link) => {
    link.hidden = !isLoggedIn;
  });
};

if (loginLinks.length || logoutLinks.length || favouriteProviderButtons.length) {
  fetch("/api/auth/me")
    .then(async (response) => {
      updateAccountActions(response.ok);
      if (!response.ok) {
        throw new Error("Not signed in");
      }

      const { user } = await response.json();
      favouriteProviderButtons.forEach((button) => {
        button.hidden = user?.role !== "client";
      });
      updateFavouriteProviderButtons();
    })
    .catch(() => {
      updateAccountActions(false);
      favouriteProviderButtons.forEach((button) => {
        button.hidden = true;
      });
    });
}

logoutLinks.forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "auth.html";
    }
  });
});
