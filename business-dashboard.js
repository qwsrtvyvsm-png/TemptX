const dashboard = document.querySelector(".creator-dashboard-shell");

if (dashboard) {
  const sampleActivity = [
    { label: "Mon", amount: 16 },
    { label: "Tue", amount: 18 },
    { label: "Wed", amount: 19 },
    { label: "Thu", amount: 21 },
    { label: "Fri", amount: 25 },
    { label: "Sat", amount: 27 }
  ];

  const title = document.querySelector("#dashboardTitle");
  const welcome = document.querySelector("#dashboardWelcome");
  const category = document.querySelector("#businessCategory");
  const location = document.querySelector("#businessLocation");
  const applicationState = document.querySelector("#businessApplicationState");
  const statusPill = document.querySelector("#businessStatusPill");

  const formatStatus = (value) =>
    String(value || "")
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const formatLabel = (value) =>
    String(value || "")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const renderChart = () => {
    const chart = document.querySelector("#occupancyChart");
    if (!chart) {
      return;
    }

    const max = Math.max(...sampleActivity.map((item) => item.amount));
    chart.innerHTML = sampleActivity
      .map((item) => {
        const height = Math.max(12, Math.round((item.amount / max) * 100));
        return `
          <div class="earnings-bar">
            <span style="height: ${height}%" title="${item.label}: ${item.amount} bookings"></span>
            <small>${item.label}</small>
          </div>`;
      })
      .join("");
  };

  const applyPreviewMode = (message) => {
    if (welcome) {
      welcome.textContent = message;
    }
    if (statusPill) {
      statusPill.textContent = "Preview";
    }
  };

  const personaliseDashboard = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        applyPreviewMode("Preview mode only. Sign in with a business account to personalise this workspace.");
        return;
      }

      const result = await response.json();
      const user = result.user;
      if (user?.role !== "business") {
        applyPreviewMode("This dashboard is built for business accounts only. Sign in with a brothel or adult-friendly business account to use it.");
        return;
      }

      const displayName = user.settings?.displayName || user.workingName || "your business";
      const accountCategory = formatLabel(user.accountCategory || "adult business");
      const businessLocation = user.businessProfile?.location || "Location pending";
      const businessStatus = formatStatus(user.applicationStatus || "pending_review");

      if (title) {
        title.textContent = `Welcome, ${displayName}.`;
      }

      if (welcome) {
        welcome.textContent = `${accountCategory} dashboard for ${businessLocation}. Use this Phase 1 workspace to monitor enquiries, roster readiness, and listing momentum.`;
      }

      if (category) {
        category.textContent = accountCategory;
      }

      if (location) {
        location.textContent = businessLocation;
      }

      if (applicationState) {
        applicationState.textContent = businessStatus;
      }

      if (statusPill) {
        statusPill.textContent = businessStatus;
      }
    } catch (error) {
      applyPreviewMode(`Preview mode only. We couldn't load your business account details right now: ${error.message}`);
    }
  };

  renderChart();
  personaliseDashboard();
}
