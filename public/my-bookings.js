const myBookingsContent = document.querySelector("#myBookingsContent");

if (myBookingsContent) {
  const signedOutPanel = document.querySelector("#bookingsSignedOut");
  const upcomingList = document.querySelector("#upcomingBookingsList");
  const upcomingEmptyState = document.querySelector("#upcomingEmptyState");
  const pastList = document.querySelector("#pastBookingsList");
  const pastEmptyState = document.querySelector("#pastEmptyState");

  const TERMINAL_STATUSES = new Set([
    "COMPLETED", "DISPUTE_WINDOW", "CLOSED", "NO_SHOW",
    "CANCELLED_BY_CLIENT", "CANCELLED_BY_PROVIDER", "DECLINED", "EXPIRED"
  ]);

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
    CANCELLED_BY_CLIENT: "Cancelled by you",
    CANCELLED_BY_PROVIDER: "Cancelled by provider",
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

  const buildActionButton = (label, className, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  };

  const withBusy = (container, task, onDone) => async () => {
    container.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await task();
      if (onDone) await onDone();
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
    title.textContent = `with ${booking.providerLabel || "your provider"} · ${formatDateTime(booking.scheduledFor)}`;
    titleWrap.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "booking-card-meta";
    meta.textContent = `${booking.service?.name || "Session"} · ${booking.location?.type === "incall" ? "Incall" : "Outcall"}${booking.deposit?.required ? ` · Deposit ${booking.deposit.status === "paid" ? "paid ✓" : "pending"}` : ""}`;
    titleWrap.appendChild(meta);

    top.appendChild(titleWrap);

    const pill = document.createElement("span");
    pill.className = `status-pill ${statusPillClass(booking.status)}`;
    pill.textContent = STATUS_LABELS[booking.status] || booking.status;
    top.appendChild(pill);

    card.appendChild(top);

    const actions = document.createElement("div");
    actions.className = "booking-card-actions";

    if (["REQUESTED", "CONFIRMED", "AWAITING_DEPOSIT", "SCHEDULED"].includes(booking.status)) {
      actions.appendChild(buildActionButton("Cancel", "btn-cancel", withBusy(actions, async () => {
        const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toStatus: "CANCELLED_BY_CLIENT" })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Couldn't cancel this booking.");
      }, loadBookings)));

      if (booking.deposit?.required && booking.deposit.status !== "paid") {
        actions.appendChild(buildActionButton("Mark deposit sent", "btn-accept", withBusy(actions, async () => {
          const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/deposit`, { method: "POST" });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || "Couldn't record the deposit.");
        }, loadBookings)));
      }

      actions.appendChild(buildActionButton("Message", "btn-message", () => {
        window.location.href = "chat.html";
      }));
    } else if (booking.status === "CLOSED") {
      actions.appendChild(buildActionButton("Leave a review", "btn-accept", () => {
        window.alert("Reviews are coming soon.");
      }));
    }

    if (actions.childNodes.length) card.appendChild(actions);

    return card;
  };

  let allBookings = [];

  async function loadBookings() {
    const response = await fetch("/api/bookings");
    if (!response.ok) return;
    const result = await response.json();
    allBookings = result.bookings || [];

    const upcoming = allBookings
      .filter((b) => !TERMINAL_STATUSES.has(b.status))
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
    const past = allBookings
      .filter((b) => TERMINAL_STATUSES.has(b.status))
      .sort((a, b) => new Date(b.scheduledFor) - new Date(a.scheduledFor));

    upcomingList.innerHTML = "";
    upcoming.forEach((b) => upcomingList.appendChild(renderBookingCard(b)));
    upcomingEmptyState.hidden = upcoming.length > 0;

    pastList.innerHTML = "";
    past.forEach((b) => pastList.appendChild(renderBookingCard(b)));
    pastEmptyState.hidden = past.length > 0;
  }

  const init = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) throw new Error("not signed in");
      const result = await response.json();
      if (result.user?.role !== "client") throw new Error("wrong role");

      signedOutPanel.hidden = true;
      myBookingsContent.hidden = false;
      await loadBookings();
    } catch {
      signedOutPanel.hidden = false;
      myBookingsContent.hidden = true;
    }
  };

  init();
}
