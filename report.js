const reportForm = document.querySelector("#reportForm");

if (reportForm) {
  const params = new URLSearchParams(window.location.search);
  const reportType = document.querySelector("#reportType");
  const reportReference = document.querySelector("#reportReference");
  const reportStatus = document.querySelector("#reportStatus");
  const reportStatusForm = document.querySelector("#reportStatusForm");
  const reportStatusResult = document.querySelector("#reportStatusResult");

  const requestedType = params.get("type");
  if (["profile", "conversation", "account", "technical", "other"].includes(requestedType)) {
    reportType.value = requestedType;
  }
  reportReference.value = (params.get("ref") || "").slice(0, 120);

  reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = reportForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    reportStatus.className = "report-status";
    reportStatus.textContent = "Submitting your report…";

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: reportType.value,
          category: document.querySelector("#reportCategory").value,
          reference: reportReference.value,
          details: document.querySelector("#reportDetails").value,
          contact: document.querySelector("#reportContact").value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The report could not be submitted.");

      reportForm.reset();
      reportStatus.className = "report-status is-success";
      reportStatus.innerHTML = `
        Report received.<br>
        Reference: <strong>${result.reference}</strong><br>
        Private access code: <strong>${result.accessCode}</strong><br>
        Save both values. The access code cannot be displayed again.
      `;
      document.querySelector("#statusReference").value = result.reference;
      document.querySelector("#statusAccessCode").value = result.accessCode;
    } catch (error) {
      reportStatus.className = "report-status is-error";
      reportStatus.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  reportStatusForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    reportStatusResult.className = "report-status-result";
    reportStatusResult.textContent = "Checking…";

    try {
      const response = await fetch("/api/reports/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: document.querySelector("#statusReference").value,
          accessCode: document.querySelector("#statusAccessCode").value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The report status could not be checked.");

      const report = result.report;
      reportStatusResult.className = "report-status-result is-success";
      reportStatusResult.innerHTML = `
        <strong>${report.reference}</strong>
        <span>Status: ${report.status}</span>
        <span>Review priority: ${report.priority}</span>
        <span>Received: ${new Date(report.createdAt).toLocaleString("en-AU")}</span>
      `;
    } catch (error) {
      reportStatusResult.className = "report-status-result is-error";
      reportStatusResult.textContent = error.message;
    }
  });
}
