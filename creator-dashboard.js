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
      if (user?.role && user.role !== "creator") {
        document.querySelector("#dashboardWelcome").textContent =
          "This dashboard is built for creator accounts. Switch to a creator account to manage creator earnings and content tools.";
        return;
      }
      const displayName = user?.settings?.displayName || "creator";
      document.querySelector("#dashboardTitle").textContent = `Welcome, ${displayName}.`;
    } catch {
      // Keep sample dashboard visible when the local account API is unavailable.
    }
  };

  renderChart();
  personaliseDashboard();
}
