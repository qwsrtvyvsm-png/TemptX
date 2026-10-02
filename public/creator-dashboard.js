const dashboard = document.querySelector(".creator-dashboard-shell");

if (dashboard) {
  const sampleEarnings = [
    { month: "Jan", amount: 1850 },
    { month: "Feb", amount: 2320 },
    { month: "Mar", amount: 2940 },
    { month: "Apr", amount: 3210 },
    { month: "May", amount: 3460 },
    { month: "Jun", amount: 4820 }
  ];

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0
    }).format(amount);

  const setupChecklistSection = document.querySelector("#setupChecklist");
  const setupChecklistList = document.querySelector("#setupChecklistList");
  const setupChecklistProgressFill = document.querySelector("#setupChecklistProgressFill");
  const setupChecklistProgressLabel = document.querySelector("#setupChecklistProgressLabel");

  const REQUIREMENT_LABELS = {
    required: "Required",
    "required-verified": "Required for verified status",
    recommended: "Recommended"
  };

  const STATUS_LABELS = {
    complete: "Complete",
    "not-started": "Not started"
  };

  // Derived entirely from the /api/auth/me response already fetched in personaliseDashboard().
  // No additional network requests are made here. Creators have no dedicated profile endpoint
  // (GET /api/profile is provider-only) and no photo/bio/public-preview data model today, so
  // this checklist only covers fields that genuinely exist on the user record.
  const buildChecklistItems = (user) => {
    const displayName = String(user?.settings?.displayName || user?.workingName || "").trim();
    // Xync completion is already exposed on the authenticated user response, not invented here.
    const xyncCompleted = Boolean(user?.xyncStatus?.creatorCompleted);

    return [
      {
        id: "identity",
        title: "Add your display name",
        description: "Set the display name clients and subscribers see across TEMPTX.",
        requirement: "required",
        status: displayName ? "complete" : "not-started",
        actionLabel: "Edit in Settings",
        actionHref: "settings.html"
      },
      {
        id: "verification",
        title: "Complete verification",
        description: "Verify your identity to unlock payouts and the verified badge.",
        requirement: "required-verified",
        status: "not-started",
        actionLabel: "Start verification",
        actionHref: "verification.html"
      },
      {
        id: "xync",
        title: "Complete Creator Xync",
        description: "Answer the Xync questionnaire to improve client compatibility matches.",
        requirement: "recommended",
        status: xyncCompleted ? "complete" : "not-started",
        actionLabel: xyncCompleted ? "Review Xync" : "Start Xync",
        actionHref: "xync.html"
      }
    ];
  };

  const renderChecklist = (user) => {
    if (!setupChecklistSection || !setupChecklistList) return;
    setupChecklistSection.hidden = false;

    const items = buildChecklistItems(user);
    const requiredItems = items.filter((item) => item.requirement === "required");
    const completedRequired = requiredItems.filter((item) => item.status === "complete").length;
    const totalRequired = requiredItems.length;
    const percent = totalRequired ? Math.round((completedRequired / totalRequired) * 100) : 0;

    if (setupChecklistProgressFill) setupChecklistProgressFill.style.width = `${percent}%`;
    if (setupChecklistProgressLabel) {
      setupChecklistProgressLabel.textContent =
        `${completedRequired} of ${totalRequired} required steps complete · ${percent}%`;
    }

    setupChecklistList.innerHTML = "";
    items.forEach((item) => {
      const row = document.createElement("li");
      row.className = `setup-checklist-row is-${item.status}`;

      const textWrap = document.createElement("div");
      textWrap.className = "setup-checklist-row-text";

      const titleRow = document.createElement("div");
      titleRow.className = "setup-checklist-row-title";

      const check = document.createElement("span");
      check.className = "setup-checklist-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = item.status === "complete" ? "✓" : "";

      const title = document.createElement("strong");
      title.textContent = item.title;

      titleRow.append(check, title);

      const description = document.createElement("p");
      description.className = "setup-checklist-row-description";
      description.textContent = item.description;

      const badges = document.createElement("div");
      badges.className = "setup-checklist-row-badges";

      const requirementBadge = document.createElement("span");
      requirementBadge.className = "setup-checklist-badge";
      requirementBadge.textContent = REQUIREMENT_LABELS[item.requirement];

      const statusBadge = document.createElement("span");
      statusBadge.className = `setup-checklist-badge${item.status === "complete" ? " setup-checklist-badge--status-complete" : ""}`;
      statusBadge.textContent = STATUS_LABELS[item.status];

      badges.append(requirementBadge, statusBadge);
      textWrap.append(titleRow, description, badges);

      const action = document.createElement("a");
      action.className = "outline-btn setup-checklist-action";
      action.href = item.actionHref;
      action.textContent = item.actionLabel;

      row.append(textWrap, action);
      setupChecklistList.appendChild(row);
    });
  };

  const renderChart = () => {
    const chart = document.querySelector("#earningsChart");
    const max = Math.max(...sampleEarnings.map((item) => item.amount));
    chart.innerHTML = sampleEarnings
      .map((item) => {
        const height = Math.max(12, Math.round((item.amount / max) * 100));
        return `
          <div class="earnings-bar">
            <span style="height: ${height}%" title="${item.month}: ${formatCurrency(item.amount)}"></span>
            <small>${item.month}</small>
          </div>`;
      })
      .join("");
  };

  const personaliseDashboard = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return;
      const result = await response.json();
      const user = result.user;
      const xyncLink = document.querySelector("#creatorXyncLink");
      xyncLink.hidden = user?.role !== "creator";
      if (user?.role && user.role !== "creator") {
        document.querySelector("#dashboardWelcome").textContent =
          "This dashboard is built for creator accounts. Switch to a creator account to manage creator earnings and content tools.";
        return;
      }
      const displayName = user?.settings?.displayName || "creator";
      document.querySelector("#dashboardTitle").textContent = `Welcome, ${displayName}.`;
      renderChecklist(user);
    } catch {
      // Keep sample dashboard visible when the local account API is unavailable.
    }
  };

  renderChart();
  personaliseDashboard();
}
