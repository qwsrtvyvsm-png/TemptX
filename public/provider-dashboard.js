const dashboardContent = document.querySelector("#dashboardContent");

if (dashboardContent) {
  const signedOutPanel = document.querySelector("#dashboardSignedOut");
  const viewPublicProfileLink = document.querySelector("#viewPublicProfileLink");
  const bookingsTabButton = document.querySelector("#bookingsTabButton");
  const clientsTabButton = document.querySelector("#clientsTabButton");
  const bookingsTab = document.querySelector("#bookingsTab");
  const clientsTab = document.querySelector("#clientsTab");
  const pendingBanner = document.querySelector("#pendingBanner");
  const filterChips = document.querySelectorAll(".filter-chip");
  const bookingsList = document.querySelector("#bookingsList");
  const bookingsEmptyState = document.querySelector("#bookingsEmptyState");
  const clientSearchInput = document.querySelector("#clientSearchInput");
  const crmUpsellNote = document.querySelector("#crmUpsellNote");
  const clientsList = document.querySelector("#clientsList");
  const clientsEmptyState = document.querySelector("#clientsEmptyState");

  const TERMINAL_STATUSES = new Set([
    "COMPLETED", "DISPUTE_WINDOW", "CLOSED", "NO_SHOW",
    "CANCELLED_BY_CLIENT", "CANCELLED_BY_PROVIDER", "DECLINED", "EXPIRED"
  ]);
  const ACTIVE_STATUSES = new Set(["REQUESTED", "CONFIRMED", "AWAITING_DEPOSIT", "SCHEDULED", "AWAITING_CHECKIN"]);

  const STATUS_LABELS = {
    REQUESTED: "Requested",
    CONFIRMED: "Confirmed",
    AWAITING_DEPOSIT: "Awaiting deposit",
    SCHEDULED: "Scheduled",
    AWAITING_CHECKIN: "Check-in open",
    COMPLETED: "Completed",
    DISPUTE_WINDOW: "Awaiting close",
    DISPUTED: "Disputed",
    NO_SHOW: "No-show",
    DECLINED: "Declined",
    EXPIRED: "Expired",
    CANCELLED_BY_CLIENT: "Cancelled by client",
    CANCELLED_BY_PROVIDER: "Cancelled by you",
    CLOSED: "Closed"
  };

  const statusPillClass = (status) => {
    if (status === "DISPUTED") return "is-red";
    if (TERMINAL_STATUSES.has(status)) return "is-grey";
    if (status === "REQUESTED" || status === "AWAITING_DEPOSIT") return "is-amber";
    return "is-green";
  };

  const formatDateTime = (iso) =>
    new Date(iso).toLocaleString("en-AU", {
      weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"
    });

  const formatRelativeTime = (iso) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffHours = Math.round(diffMs / (60 * 60 * 1000));
    if (diffHours < 1) return "moments ago";
    if (diffHours < 24) return `${diffHours}hr${diffHours === 1 ? "" : "s"} ago`;
    return `${Math.round(diffHours / 24)}d ago`;
  };

  let currentUser = null;
  let allBookings = [];
  let allClients = [];
  let fullCrmAccess = false;
  let activeFilter = "today";

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const filterBookings = (filter) => {
    const now = new Date();
    switch (filter) {
      case "today":
        return allBookings.filter((b) => isSameDay(new Date(b.scheduledFor), now) && !TERMINAL_STATUSES.has(b.status));
      case "upcoming":
        return allBookings.filter((b) => new Date(b.scheduledFor) > now && ACTIVE_STATUSES.has(b.status));
      case "pending":
        return allBookings.filter((b) => b.status === "REQUESTED");
      case "past":
        return allBookings
          .filter((b) => TERMINAL_STATUSES.has(b.status))
          .sort((a, b) => new Date(b.scheduledFor) - new Date(a.scheduledFor));
      case "disputed":
        return allBookings.filter((b) => b.status === "DISPUTED");
      default:
        return allBookings;
    }
  };

  const patchBookingStatus = async (bookingId, toStatus, reason) => {
    const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, reason })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Couldn't update this booking.");
    return result.booking;
  };

  const buildActionButton = (label, className, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  };

  const withBusy = (container, task) => async () => {
    container.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await task();
      await loadBookings();
    } catch (error) {
      window.alert(error.message || "Something went wrong.");
    } finally {
      container.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  };

  const renderBookingCard = (booking) => {
    const card = document.createElement("article");
    card.className = "booking-card";

    const top = document.createElement("div");
    top.className = "booking-card-top";

    const titleWrap = document.createElement("div");
    const title = document.createElement("p");
    title.className = "booking-card-title";
    title.textContent = `${booking.clientLabel || "Client"} · ${booking.service?.name || "Session"} · ${formatDateTime(booking.scheduledFor)}`;
    titleWrap.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "booking-card-meta";
    const rateText = booking.service?.rateSnapshot || "Rate not set";
    meta.textContent = `${booking.location?.type === "incall" ? "Incall" : "Outcall"} · ${rateText} · Requested ${formatRelativeTime(booking.createdAt)}`;
    titleWrap.appendChild(meta);

    top.appendChild(titleWrap);

    const pill = document.createElement("span");
    pill.className = `status-pill ${statusPillClass(booking.status)}`;
    pill.textContent = STATUS_LABELS[booking.status] || booking.status;
    top.appendChild(pill);

    card.appendChild(top);

    if (booking.deposit?.required) {
      const depositLine = document.createElement("p");
      depositLine.className = "booking-card-meta";
      depositLine.textContent = `Deposit ${booking.deposit.status === "paid" ? "paid ✓" : "pending"}`;
      card.appendChild(depositLine);
    }

    const actions = document.createElement("div");
    actions.className = "booking-card-actions";

    if (booking.status === "REQUESTED") {
      actions.appendChild(buildActionButton("Decline", "btn-decline", withBusy(actions, () => patchBookingStatus(booking.id, "DECLINED"))));
      actions.appendChild(buildActionButton("Accept →", "btn-accept", withBusy(actions, () => patchBookingStatus(booking.id, "CONFIRMED"))));
    } else if (["CONFIRMED", "AWAITING_DEPOSIT", "SCHEDULED"].includes(booking.status)) {
      actions.appendChild(buildActionButton("Cancel", "btn-cancel", withBusy(actions, () => patchBookingStatus(booking.id, "CANCELLED_BY_PROVIDER"))));
    } else if (booking.status === "AWAITING_CHECKIN") {
      if (!booking.checkIn?.providerCheckedInAt) {
        actions.appendChild(buildActionButton("Check in", "btn-checkin", withBusy(actions, async () => {
          const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/checkin`, { method: "POST" });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || "Couldn't check in.");
        })));
      }
      actions.appendChild(buildActionButton("Mark completed", "btn-accept", withBusy(actions, () => patchBookingStatus(booking.id, "COMPLETED"))));
    } else if (booking.status === "COMPLETED" || booking.status === "DISPUTE_WINDOW" || booking.status === "NO_SHOW") {
      actions.appendChild(buildActionButton("Raise dispute", "btn-decline", withBusy(actions, async () => {
        const reason = window.prompt("Describe the issue you're disputing:");
        if (!reason) throw new Error("Dispute cancelled.");
        const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/dispute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Couldn't raise dispute.");
      })));
    }

    if (actions.childNodes.length) card.appendChild(actions);

    return card;
  };

  const renderBookings = () => {
    const filtered = filterBookings(activeFilter);
    bookingsList.innerHTML = "";
    filtered.forEach((booking) => bookingsList.appendChild(renderBookingCard(booking)));
    bookingsEmptyState.hidden = filtered.length > 0;
  };

  const renderPendingBanner = () => {
    const pendingCount = allBookings.filter((b) => b.status === "REQUESTED").length;
    if (pendingCount > 0) {
      pendingBanner.hidden = false;
      pendingBanner.textContent = `⚠ ${pendingCount} pending request${pendingCount === 1 ? "" : "s"} need${pendingCount === 1 ? "s" : ""} a response`;
    } else {
      pendingBanner.hidden = true;
    }
  };

  const loadBookings = async () => {
    const response = await fetch("/api/bookings");
    if (!response.ok) return;
    const result = await response.json();
    allBookings = result.bookings || [];
    renderPendingBanner();
    renderBookings();
  };

  const renderClientCard = (client) => {
    const card = document.createElement("article");
    card.className = `client-card${client.blocked ? " is-blocked" : ""}`;

    const top = document.createElement("div");
    top.className = "client-card-top";

    const nameLine = document.createElement("p");
    nameLine.className = "booking-card-title";
    nameLine.textContent = client.clientLabel || client.clientId;
    top.appendChild(nameLine);

    if (fullCrmAccess && client.tags?.length) {
      const tags = document.createElement("div");
      tags.className = "client-tags";
      client.tags.forEach((tag) => {
        const tagEl = document.createElement("span");
        tagEl.className = "client-tag";
        tagEl.textContent = tag;
        tags.appendChild(tagEl);
      });
      top.appendChild(tags);
    }

    card.appendChild(top);

    const stats = document.createElement("p");
    stats.className = "booking-card-meta";
    if (fullCrmAccess) {
      const signals = client.trustSignals || {};
      const lastSeen = signals.lastBookingAt
        ? new Date(signals.lastBookingAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
        : "—";
      stats.textContent = `${signals.totalBookings || 0} bookings · ${signals.noShowCount || 0} no-shows · last seen ${lastSeen}`;
    } else {
      stats.textContent = `${client.totalBookings || 0} booking${client.totalBookings === 1 ? "" : "s"}`;
    }
    card.appendChild(stats);

    if (fullCrmAccess && client.privateNote) {
      const noteBox = document.createElement("div");
      noteBox.className = "client-note-box";
      noteBox.textContent = `Note: ${client.privateNote}`;
      card.appendChild(noteBox);
    }

    if (fullCrmAccess) {
      const actions = document.createElement("div");
      actions.className = "client-card-actions";

      actions.appendChild(buildActionButton("Edit", "btn-edit", withBusyClient(actions, async () => {
        const note = window.prompt("Private note for this client:", client.privateNote || "");
        if (note === null) return;
        const tagsInput = window.prompt("Tags (comma separated):", (client.tags || []).join(", "));
        if (tagsInput === null) return;
        const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
        const response = await fetch(`/api/providers/${encodeURIComponent(currentUser.id)}/clients/${encodeURIComponent(client.clientId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ privateNote: note, tags })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Couldn't update this client.");
      })));

      if (!client.blocked) {
        actions.appendChild(buildActionButton("Block", "btn-block", withBusyClient(actions, async () => {
          if (!window.confirm("Block this client? Any pending requests from them will be declined.")) return;
          const response = await fetch(`/api/providers/${encodeURIComponent(currentUser.id)}/clients/${encodeURIComponent(client.clientId)}/block`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "" })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || "Couldn't block this client.");
        })));
      }

      card.appendChild(actions);
    }

    return card;
  };

  function withBusyClient(container, task) {
    return async () => {
      container.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        await task();
        await loadClients();
      } catch (error) {
        window.alert(error.message || "Something went wrong.");
      } finally {
        container.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    };
  }

  const renderClients = () => {
    const query = clientSearchInput.value.trim().toLowerCase();
    const filtered = allClients.filter((client) => {
      if (!query) return true;
      return (client.clientLabel || client.clientId || "").toLowerCase().includes(query) ||
        (client.tags || []).some((t) => t.toLowerCase().includes(query));
    });
    clientsList.innerHTML = "";
    filtered.forEach((client) => clientsList.appendChild(renderClientCard(client)));
    clientsEmptyState.hidden = filtered.length > 0;
  };

  const loadClients = async () => {
    const response = await fetch(`/api/providers/${encodeURIComponent(currentUser.id)}/clients`);
    if (!response.ok) return;
    const result = await response.json();
    allClients = result.clients || [];
    fullCrmAccess = Boolean(result.fullAccess);
    crmUpsellNote.hidden = fullCrmAccess;
    renderClients();
  };

  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filterChips.forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      activeFilter = chip.dataset.filter;
      renderBookings();
    });
  });

  const switchTab = (tab) => {
    const showBookings = tab === "bookings";
    bookingsTab.hidden = !showBookings;
    clientsTab.hidden = showBookings;
    bookingsTabButton.classList.toggle("is-active", showBookings);
    clientsTabButton.classList.toggle("is-active", !showBookings);
    bookingsTabButton.setAttribute("aria-selected", String(showBookings));
    clientsTabButton.setAttribute("aria-selected", String(!showBookings));
  };

  bookingsTabButton.addEventListener("click", () => switchTab("bookings"));
  clientsTabButton.addEventListener("click", () => switchTab("clients"));
  clientSearchInput.addEventListener("input", renderClients);

  const syncTabFromHash = () => {
    if (window.location.hash === "#clientsTab") {
      switchTab("clients");
    }
  };

  syncTabFromHash();
  window.addEventListener("hashchange", syncTabFromHash);

  const init = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) throw new Error("not signed in");
      const result = await response.json();
      if (result.user?.role !== "provider") throw new Error("wrong role");

      currentUser = result.user;
      signedOutPanel.hidden = true;
      dashboardContent.hidden = false;
      viewPublicProfileLink.href = `profile.html?provider=${encodeURIComponent(currentUser.id)}`;
      viewPublicProfileLink.hidden = false;

      await Promise.all([loadBookings(), loadClients()]);
    } catch {
      signedOutPanel.hidden = false;
      dashboardContent.hidden = true;
    }
  };

  init();
}
