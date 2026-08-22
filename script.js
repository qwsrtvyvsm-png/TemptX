/* ── Logo-flip preloader + quick page transitions ──
   Full splash plays once per browser session (sessionStorage), on
   whichever page a visitor lands on first. Every internal nav click
   after that gets a quick flip/fade instead of the full splash again —
   see style.css "LOGO FLIP + PAGE-LOAD PRELOADER" section for the
   animations these elements drive. Injected here (rather than pasted
   into every .html file) because script.js is the one file every page
   already loads. */
/* ── Bracket wordmark — nav logo ──
   Adds the "[" / "]" glyphs from the approved logo design around the
   TEMPTX wordmark in the persistent header nav. Injected as real DOM
   spans (rather than a CSS ::before/::after) because ::after is
   already used as the tagline slot on the large hero brand-mark
   variant elsewhere on the site — reusing it here would collide with
   that on pages using both. See style.css "Bracket wordmark" rules
   for how these are styled/coloured. */
(() => {
  document.querySelectorAll(".site-header .site-header-bar .brand-mark").forEach((mark) => {
    if (mark.querySelector(".brand-bracket")) return;
    const open = document.createElement("span");
    open.className = "brand-bracket brand-bracket-l";
    open.setAttribute("aria-hidden", "true");
    open.textContent = "[";
    const close = document.createElement("span");
    close.className = "brand-bracket brand-bracket-r";
    close.setAttribute("aria-hidden", "true");
    close.textContent = "]";
    mark.insertBefore(open, mark.firstChild);
    mark.appendChild(close);
  });
})();

(() => {
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SEEN_KEY = "temptxSeenPreloader";

  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div id="tx-loader"><div class="tx-loader-mark"><span class="brand-bracket brand-bracket-l" aria-hidden="true">[</span><span class="brand-word">TEMPT</span><span class="brand-x">X</span><span class="brand-bracket brand-bracket-r" aria-hidden="true">]</span></div></div>` +
    `<div id="tx-exit-overlay"><span class="brand-x">X</span></div>`
  );

  const loader = document.querySelector("#tx-loader");
  const exitOverlay = document.querySelector("#tx-exit-overlay");
  let seenThisSession = null;
  try {
    seenThisSession = sessionStorage.getItem(SEEN_KEY);
  } catch (error) {
    seenThisSession = null;
  }

  if (seenThisSession || REDUCED_MOTION) {
    loader.classList.add("tx-skip");
  } else {
    loader.addEventListener("animationend", (event) => {
      if (event.animationName === "tx-loader-out") {
        loader.remove();
      }
    });
  }
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch (error) {
    // sessionStorage unavailable (e.g. private mode) — treat as unseen next load.
  }

  const isTransitionableLink = (link) => {
    if (!link) return false;
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;
    const rawHref = link.getAttribute("href") || "";
    if (rawHref === "" || rawHref.startsWith("#")) return false;

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch {
      return false;
    }
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
    return true;
  };

  document.addEventListener("click", (event) => {
    // No "was this the first page" guard needed here: while the splash is
    // still up it's a full-screen fixed element with default pointer-events,
    // so it already absorbs any click itself — nav links underneath simply
    // can't be reached until it's gone. Once it's gone (or was skipped),
    // every internal link click gets the quick transition.
    if (REDUCED_MOTION) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest ? event.target.closest("a[href]") : null;
    if (!isTransitionableLink(link)) return;

    event.preventDefault();
    const destination = link.href;
    exitOverlay.classList.add("tx-exit-active");
    window.setTimeout(() => {
      window.location.href = destination;
    }, 320);
  });
})();

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
const headerInteractiveItems = document.querySelectorAll(".site-header .store-nav a, .site-header .header-tool");
const favouritesStorageKey = "temptxFavouriteProviders";

const normalisePath = (path) => {
  const cleanPath = String(path || "").replace(/\/+$/, "");
  return cleanPath.endsWith("/index.html") || cleanPath === "" ? "/" : cleanPath;
};

document.querySelectorAll(".site-header .store-nav a[href]").forEach((link) => {
  const linkPath = normalisePath(new URL(link.href, window.location.href).pathname);
  const currentPath = normalisePath(window.location.pathname);
  const isCurrent = linkPath === currentPath;

  link.classList.toggle("nav-current", isCurrent);
  if (isCurrent) {
    link.setAttribute("aria-current", "page");
  } else if (link.getAttribute("aria-current") === "page") {
    link.removeAttribute("aria-current");
  }
});

headerInteractiveItems.forEach((item) => {
  const clearPressed = () => item.classList.remove("is-pressed");

  item.addEventListener("pointerdown", () => {
    item.classList.add("is-pressed");
  });
  item.addEventListener("pointerup", clearPressed);
  item.addEventListener("pointerleave", clearPressed);
  item.addEventListener("blur", clearPressed);
});

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

const ageConfirmed = localStorage.getItem("temptxAgeConfirmed") === "true";

if (ageGate && enterSite && leaveSite) {
  if (ageConfirmed) {
    ageGate.classList.add("hidden");
  } else {
    document.body.classList.add("gate-open");
  }

  enterSite.addEventListener("click", () => {
    localStorage.setItem("temptxAgeConfirmed", "true");
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

  // Authenticated-only nav items (e.g. Messages) — hidden for logged-out visitors
  document.querySelectorAll("[data-authenticated]").forEach((el) => {
    el.hidden = !isLoggedIn;
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

/* ── Hero parallax — subtle layered depth on scroll ── */
(() => {
  const hero = document.querySelector(".collection-hero");
  if (!hero || !hero.querySelector(".hero-panel")) {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let ticking = false;

  const applyParallax = () => {
    ticking = false;

    if (reduceMotion.matches) {
      hero.style.setProperty("--hero-scroll", "0");
      return;
    }

    const rect = hero.getBoundingClientRect();
    const viewH = window.innerHeight || 1;
    // -1…1 while hero is near the viewport center
    const progress = (viewH * 0.5 - (rect.top + rect.height * 0.5)) / viewH;
    const clamped = Math.max(-1, Math.min(1, progress));
    hero.style.setProperty("--hero-scroll", clamped.toFixed(4));
  };

  const onScrollOrResize = () => {
    if (ticking) {
      return;
    }
    ticking = true;
    window.requestAnimationFrame(applyParallax);
  };

  applyParallax();
  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });

  if (typeof reduceMotion.addEventListener === "function") {
    reduceMotion.addEventListener("change", applyParallax);
  } else if (typeof reduceMotion.addListener === "function") {
    reduceMotion.addListener(applyParallax);
  }
})();
