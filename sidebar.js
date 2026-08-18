/* ══════════════════════════════════════════════════
   DASHBOARD SIDEBAR — shared nav for provider / creator /
   business dashboard, profile, and account pages.

   Usage: add a mount point to the page —
     <aside id="app-sidebar" data-active="dashboard"></aside>
   — and include this script. Role is resolved from
   /api/auth/me, so the same markup works on pages shared
   across roles (chat.html, settings.html, membership.html).
   ══════════════════════════════════════════════════ */

(() => {
  const ICONS = {
    dashboard: '<path d="M3 3h6v6H3V3Zm8 0h6v6h-6V3ZM3 11h6v6H3v-6Zm8 0h6v6h-6v-6Z" fill="currentColor"/>',
    billing: '<rect x="2.5" y="4.5" width="15" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 8h15" stroke="currentColor" stroke-width="1.4"/>',
    profile: '<circle cx="10" cy="6.5" r="3.25" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 17c1-3.4 4-5 6.5-5s5.5 1.6 6.5 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    engagement: '<path d="M3 4.5h14v8H8.5L5 15.5V12.5H3v-8Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    marketing: '<path d="M3 8v4l3 .6V7.4L3 8Zm3 4.6 1 3.4h1.5l-.7-3M6 7.4l9-3.4v12l-9-3.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>',
  };

  const chevronSvg = () =>
    '<svg class="sidebar-group-chevron" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const iconSvg = (key) =>
    key && ICONS[key]
      ? `<svg class="sidebar-item-icon" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">${ICONS[key]}</svg>`
      : "";

  const NAV_CONFIG = {
    provider: [
      { key: "dashboard", label: "Dashboard", href: "provider-dashboard.html", icon: "dashboard" },
      { key: "billing", label: "Subscriptions & Billing", href: "membership.html", icon: "billing" },
      {
        key: "profile",
        label: "Profile",
        icon: "profile",
        items: [
          { key: "profile-general", label: "General", href: "provider-profile.html#detail-basics" },
          { key: "profile-photos", label: "Photos", href: "provider-profile.html#photo-upload" },
          { key: "profile-rates", label: "Rates", href: "provider-profile.html#rates" },
          { key: "profile-availability", label: "Availability", href: "provider-profile.html#availability" },
          { key: "profile-tours", label: "Tours", href: "provider-profile.html#tours" },
          { key: "profile-doubles", label: "Doubles", soon: true },
          { key: "profile-reviews", label: "Reviews", soon: true },
          { key: "profile-analytics", label: "Analytics", soon: true },
        ],
      },
      {
        key: "engagement",
        label: "Client engagement",
        icon: "engagement",
        items: [
          { key: "engagement-messages", label: "Direct messages", href: "chat.html" },
          { key: "engagement-clients", label: "Client lookup", href: "provider-dashboard.html#clientsTab" },
          { key: "engagement-blacklist", label: "Blacklist & reports", href: "blacklist.html" },
          { key: "engagement-followers", label: "Followers", soon: true },
        ],
      },
      {
        key: "marketing",
        label: "Marketing tools",
        icon: "marketing",
        items: [
          { key: "marketing-spotlight", label: "Spotlight", soon: true },
          { key: "marketing-homepage", label: "Homepage", soon: true },
          { key: "marketing-promotions", label: "Promotions", soon: true },
          { key: "marketing-announcements", label: "Announcements", soon: true },
          { key: "marketing-loyalty", label: "Loyalty & perks", soon: true },
        ],
      },
    ],
    creator: [
      { key: "dashboard", label: "Dashboard", href: "creator-dashboard.html", icon: "dashboard" },
      { key: "billing", label: "Subscriptions & Billing", href: "membership.html", icon: "billing" },
      {
        key: "profile",
        label: "Profile",
        icon: "profile",
        items: [
          { key: "profile-general", label: "General", href: "creator-profile.html#basics" },
          { key: "profile-bio", label: "Bio", href: "creator-profile.html#bio" },
          { key: "profile-content", label: "Content", href: "creator-profile.html#content-formats" },
          { key: "profile-pricing", label: "Pricing", href: "creator-pricing.html" },
          { key: "profile-visibility", label: "Visibility", href: "creator-profile.html#visibility" },
          { key: "profile-reviews", label: "Reviews", soon: true },
          { key: "profile-analytics", label: "Analytics", soon: true },
        ],
      },
      {
        key: "engagement",
        label: "Client engagement",
        icon: "engagement",
        items: [
          { key: "engagement-messages", label: "Direct messages", href: "chat.html" },
          { key: "engagement-subscribers", label: "Subscribers", href: "creator-dashboard.html#subscribers" },
          { key: "engagement-clients", label: "Client lookup", soon: true },
        ],
      },
      {
        key: "marketing",
        label: "Marketing tools",
        icon: "marketing",
        items: [
          { key: "marketing-spotlight", label: "Spotlight", soon: true },
          { key: "marketing-homepage", label: "Homepage", soon: true },
          { key: "marketing-promotions", label: "Promotions", soon: true },
          { key: "marketing-announcements", label: "Announcements", soon: true },
          { key: "marketing-loyalty", label: "Loyalty & perks", soon: true },
        ],
      },
    ],
    business: [
      { key: "dashboard", label: "Dashboard", href: "business-dashboard.html", icon: "dashboard" },
      { key: "billing", label: "Subscriptions & Billing", href: "membership.html", icon: "billing" },
      {
        key: "profile",
        label: "Profile",
        icon: "profile",
        items: [
          { key: "profile-general", label: "General", href: "business-profile.html#business-details" },
          { key: "profile-description", label: "Description", href: "business-profile.html#business-description" },
          { key: "profile-services", label: "Services", href: "business-profile.html#services" },
          { key: "profile-hours", label: "Hours & pricing", href: "business-profile.html#hours" },
          { key: "profile-logo", label: "Logo & photos", href: "business-profile.html#logo" },
          { key: "profile-reviews", label: "Reviews", soon: true },
          { key: "profile-analytics", label: "Analytics", soon: true },
        ],
      },
      {
        key: "engagement",
        label: "Client engagement",
        icon: "engagement",
        items: [
          { key: "engagement-leads", label: "Leads", href: "business-dashboard.html#leads" },
          { key: "engagement-clients", label: "Client lookup", soon: true },
          { key: "engagement-messages", label: "Direct messages", soon: true },
        ],
      },
      {
        key: "marketing",
        label: "Marketing tools",
        icon: "marketing",
        items: [
          { key: "marketing-friendly", label: "Friendly Businesses directory", href: "friendly-businesses.html" },
          { key: "marketing-spotlight", label: "Spotlight", soon: true },
          { key: "marketing-promotions", label: "Promotions", soon: true },
          { key: "marketing-announcements", label: "Announcements", soon: true },
        ],
      },
    ],
  };

  const ROLE_LABELS = {
    provider: "Provider account",
    creator: "Creator account",
    business: "Business account",
  };

  const initials = (name) =>
    (name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "TX";

  const buildSoonItem = (item) => {
    const el = document.createElement("span");
    el.className = "sidebar-link is-soon";
    el.dataset.navKey = item.key;
    el.setAttribute("aria-disabled", "true");
    el.innerHTML = `${iconSvg(item.icon)}<span>${item.label}</span><span class="sidebar-soon-tag">Soon</span>`;
    return el;
  };

  const buildLinkItem = (item, activeKey) => {
    const el = document.createElement("a");
    el.className = "sidebar-link";
    el.href = item.href;
    el.dataset.navKey = item.key;
    el.dataset.navHref = item.href;
    if (item.key === activeKey) {
      el.classList.add("is-active");
      el.setAttribute("aria-current", "page");
    }
    el.innerHTML = `${iconSvg(item.icon)}<span>${item.label}</span>`;
    return el;
  };

  const buildItem = (item, activeKey) => (item.soon ? buildSoonItem(item) : buildLinkItem(item, activeKey));

  const buildGroup = (group, activeKey, storageKey) => {
    const containsActive = group.items.some((item) => item.key === activeKey);

    const wrap = document.createElement("div");
    wrap.className = "sidebar-group";

    const stored = window.localStorage.getItem(`${storageKey}:${group.key}`);
    const isOpen = stored === null ? containsActive : stored === "1";
    wrap.classList.toggle("is-open", isOpen);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "sidebar-group-trigger";
    trigger.setAttribute("aria-expanded", String(isOpen));
    trigger.innerHTML = `<span>${group.label}</span>${chevronSvg()}`;
    trigger.addEventListener("click", () => {
      const nowOpen = !wrap.classList.contains("is-open");
      wrap.classList.toggle("is-open", nowOpen);
      trigger.setAttribute("aria-expanded", String(nowOpen));
      window.localStorage.setItem(`${storageKey}:${group.key}`, nowOpen ? "1" : "0");
    });

    const items = document.createElement("div");
    items.className = "sidebar-group-items";
    group.items.forEach((item) => items.appendChild(buildItem(item, activeKey)));

    wrap.appendChild(trigger);
    wrap.appendChild(items);
    return wrap;
  };

  const findKeyByHref = (role, href) => {
    for (const entry of NAV_CONFIG[role] || []) {
      if (entry.href === href) return entry.key;
      for (const item of entry.items || []) {
        if (item.href === href) return item.key;
      }
    }
    return null;
  };

  const resolveActiveKey = (mount, role) => {
    const currentFile = window.location.pathname.split("/").pop() || "index.html";
    const hash = window.location.hash;
    if (hash) {
      const key = findKeyByHref(role, `${currentFile}${hash}`);
      if (key) return key;
    }
    return mount.dataset.active || "";
  };

  const applyActiveKey = (mount, key) => {
    mount.querySelectorAll("[data-nav-key]").forEach((el) => {
      const isActive = el.dataset.navKey === key;
      el.classList.toggle("is-active", isActive);
      if (el.tagName === "A") {
        if (isActive) el.setAttribute("aria-current", "page");
        else el.removeAttribute("aria-current");
      }
      if (isActive) {
        const group = el.closest(".sidebar-group");
        if (group && !group.classList.contains("is-open")) {
          group.classList.add("is-open");
          const trigger = group.querySelector(".sidebar-group-trigger");
          if (trigger) trigger.setAttribute("aria-expanded", "true");
        }
      }
    });
  };

  const buildNav = (role, activeKey) => {
    const nav = document.createElement("nav");
    nav.className = "sidebar-nav";
    nav.setAttribute("aria-label", "Dashboard navigation");

    (NAV_CONFIG[role] || []).forEach((entry) => {
      if (entry.items) {
        nav.appendChild(buildGroup(entry, activeKey, `sidebar:${role}`));
      } else {
        nav.appendChild(buildItem(entry, activeKey));
      }
    });

    return nav;
  };

  const buildFooter = (user) => {
    const footer = document.createElement("div");
    footer.className = "sidebar-footer";

    const name = user?.settings?.displayName || user?.workingName || user?.email || "TEMPTX account";
    const roleLabel = ROLE_LABELS[user?.role] || "Account";

    footer.innerHTML = `
      <button type="button" class="sidebar-account-btn" aria-haspopup="true" aria-expanded="false">
        <span class="sidebar-avatar">${initials(name)}</span>
        <span class="sidebar-account-meta">
          <span class="sidebar-account-name">${name}</span>
          <span class="sidebar-account-role">${roleLabel}</span>
        </span>
        <svg class="sidebar-account-chevron" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 6.5 5 3l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="sidebar-account-menu">
        <a href="settings.html">Settings</a>
        <a href="verification-centre.html">Verification</a>
        <a href="auth.html" data-logout>Log Out</a>
      </div>
    `;

    const btn = footer.querySelector(".sidebar-account-btn");
    btn.addEventListener("click", () => {
      const nowOpen = !footer.classList.contains("is-open");
      footer.classList.toggle("is-open", nowOpen);
      btn.setAttribute("aria-expanded", String(nowOpen));
    });

    // Injected after script.js's own static querySelectorAll("[data-logout]")
    // runs, so it needs its own handler rather than relying on that one.
    footer.querySelector("[data-logout]").addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } finally {
        window.location.href = "auth.html";
      }
    });

    document.addEventListener("click", (event) => {
      if (!footer.contains(event.target)) {
        footer.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });

    return footer;
  };

  const buildMobileChrome = (sidebar) => {
    const scrim = document.createElement("div");
    scrim.className = "sidebar-scrim";
    document.body.appendChild(scrim);

    const closeDrawer = () => {
      sidebar.classList.remove("is-open");
      scrim.classList.remove("is-open");
    };

    scrim.addEventListener("click", closeDrawer);

    document.querySelectorAll("[data-sidebar-toggle]").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const nowOpen = !sidebar.classList.contains("is-open");
        sidebar.classList.toggle("is-open", nowOpen);
        scrim.classList.toggle("is-open", nowOpen);
      });
    });

    sidebar.querySelectorAll("a.sidebar-link").forEach((link) => {
      link.addEventListener("click", closeDrawer);
    });
  };

  const renderSidebar = (mount, role, user) => {
    const activeKey = resolveActiveKey(mount, role);

    mount.innerHTML = "";
    mount.classList.add("app-sidebar");

    const brand = document.createElement("a");
    brand.className = "sidebar-brand";
    brand.href = NAV_CONFIG[role]?.[0]?.href || "index.html";
    brand.innerHTML = `<span>
      <span class="sidebar-brand-wordmark">TEMPT<span class="brand-x">X</span></span>
      <small>${ROLE_LABELS[role] || "Account"}</small>
    </span>`;

    mount.appendChild(brand);
    mount.appendChild(buildNav(role, activeKey));
    mount.appendChild(buildFooter(user));

    buildMobileChrome(mount);

    // Shared pages (chat/settings/membership) carry a fallback brand + nav in
    // the topbar for roles with no sidebar config (e.g. clients). Once a real
    // sidebar renders, that fallback is redundant — hide it.
    document.querySelectorAll("[data-topbar-fallback]").forEach((el) => {
      el.hidden = true;
    });

    window.addEventListener("hashchange", () => {
      applyActiveKey(mount, resolveActiveKey(mount, role));
    });
  };

  const init = () => {
    const mount = document.getElementById("app-sidebar");
    if (!mount) return;

    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) throw new Error("not signed in");
        const { user } = await response.json();
        if (!NAV_CONFIG[user.role]) throw new Error("unsupported role");
        renderSidebar(mount, user.role, user);
      })
      .catch(() => {
        mount.closest(".app-layout")?.classList.add("no-sidebar");
        mount.remove();
      });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
