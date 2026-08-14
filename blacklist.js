const blacklistForm = document.querySelector("#blacklistForm");

if (blacklistForm) {
  const accessTitle = document.querySelector("#accessTitle");
  const accessMessage = document.querySelector("#accessMessage");
  const providerLoginLink = document.querySelector("#providerLoginLink");
  const status = document.querySelector("#blacklistStatus");
  const history = document.querySelector("#blacklistHistory");
  const historyResult = document.querySelector("#historyResult");

  const setStatus = (message = "", type = "") => {
    status.textContent = message;
    status.className = `report-status${type ? ` is-${type}` : ""}`;
  };

  const loadReports = async () => {
    const response = await fetch("/api/blacklist/reports");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load your reports.");
    history.hidden = false;
    historyResult.className = "report-status-result is-success";
    historyResult.replaceChildren();
    if (!result.reports.length) {
      historyResult.textContent = "You have not submitted any Blacklist reports.";
      return;
    }
    result.reports.forEach((report) => {
      const item = document.createElement("div");
      item.innerHTML = `<strong></strong><span></span><span></span>`;
      item.querySelector("strong").textContent = report.reference;
      item.querySelectorAll("span")[0].textContent = `Status: ${report.status}`;
      item.querySelectorAll("span")[1].textContent = `Received: ${new Date(report.createdAt).toLocaleString("en-AU")}`;
      historyResult.appendChild(item);
    });
  };

  const initialise = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.status === 401) {
        accessTitle.textContent = "Provider sign-in required";
        accessMessage.textContent = "Use your existing TEMPTX provider account to submit or track a Blacklist report.";
        providerLoginLink.hidden = false;
        return;
      }
      const result = await response.json();
      if (!response.ok || result.user.role !== "provider") {
        accessTitle.textContent = "Provider accounts only";
        accessMessage.textContent = "Blacklist reporting is private and available only to signed-in TEMPTX provider accounts.";
        return;
      }
      accessTitle.textContent = "Private provider access";
      accessMessage.textContent = "You can submit a report and view only reports you have lodged.";
      blacklistForm.hidden = false;
      await loadReports();
    } catch {
      accessTitle.textContent = "TEMPTX connection required";
      accessMessage.textContent = "Run the TEMPTX server and open this page through http://127.0.0.1:5510/blacklist.html.";
    }
  };

  blacklistForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = blacklistForm.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus("Submitting your private report…");
    try {
      const response = await fetch("/api/blacklist/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientReference: document.querySelector("#clientReference").value,
          incidentType: document.querySelector("#incidentType").value,
          details: document.querySelector("#blacklistDetails").value,
          evidenceSummary: document.querySelector("#evidenceSummary").value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The report could not be submitted.");
      blacklistForm.reset();
      setStatus(`${result.message} Reference: ${result.reference}`, "success");
      await loadReports();
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  initialise();
}
