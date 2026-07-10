const dashboard = document.querySelector(".creator-dashboard-shell");

if (dashboard) {
  const title = document.querySelector("#dashboardTitle");
  const welcome = document.querySelector("#dashboardWelcome");
  const category = document.querySelector("#businessCategory");
  const location = document.querySelector("#businessLocation");
  const applicationState = document.querySelector("#businessApplicationState");
  const applicationDetails = document.querySelector("#businessApplicationDetails");
  const statusPill = document.querySelector("#businessStatusPill");
  const viewPublicProfileLink = document.querySelector("#viewPublicProfileLink");

  const formatLabel = (value) =>
    String(value || "")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const getApplicationStatusDetails = (status) => {
    const details = {
      pending_review: "We're reviewing your application. This typically takes 1-2 business days.",
      approved: "Your business account is active and your profile is visible in the directory.",
      rejected: "Your application was not approved. Review the community standards and reapply.",
      suspended: "Your account has been temporarily suspended. Contact support for details."
    };
    return details[status] || "Check back soon for your application status.";
  };

  const applyPreviewMode = (message) => {
    if (welcome) {
      welcome.textContent = message;
    }
    if (statusPill) {
      statusPill.textContent = "Sign in required";
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

      const userId = user.id;
      const displayName = user.settings?.displayName || user.workingName || "your business";
      const accountCategory = formatLabel(user.accountCategory || "adult business");
      const businessLocation = user.businessProfile?.location || "Location pending";
      const storedApplicationStatus = user.applicationStatus || "pending_review";
      const statusDetails = getApplicationStatusDetails(storedApplicationStatus);

      if (title) {
        title.textContent = `Welcome, ${displayName}.`;
      }

      if (welcome) {
        welcome.textContent = `${accountCategory} dashboard for ${businessLocation}. Use this workspace to manage your profile and view your directory listing.`;
      }

      if (category) {
        category.textContent = accountCategory;
      }

      if (location) {
        location.textContent = businessLocation;
      }

      if (applicationState) {
        applicationState.textContent = storedApplicationStatus;
      }

      if (applicationDetails) {
        applicationDetails.textContent = statusDetails;
      }

      if (statusPill) {
        statusPill.textContent = storedApplicationStatus;
      }

      // Wire up public profile link
      if (viewPublicProfileLink && userId) {
        viewPublicProfileLink.href = `business-public.html?id=${encodeURIComponent(userId)}`;
        viewPublicProfileLink.hidden = false;
      }
    } catch (error) {
      applyPreviewMode(`Preview mode only. We couldn't load your business account details right now: ${error.message}`);
    }
  };

  personaliseDashboard();
}
