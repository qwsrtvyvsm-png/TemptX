const businessProfileForm = document.querySelector("#businessProfileForm");
const authErrorContainer = document.querySelector("#authErrorContainer");
const authErrorMessage = document.querySelector("#authErrorMessage");

if (businessProfileForm || authErrorContainer) {
  const formFields = {
    displayName: document.querySelector("#displayName"),
    website: document.querySelector("#website"),
    contactPhone: document.querySelector("#contactPhone"),
    location: document.querySelector("#location"),
    description: document.querySelector("#description"),
    openingHours: document.querySelector("#openingHours"),
    priceRange: document.querySelector("#priceRange"),
    logoDataUrl: document.querySelector("#logoDataUrl"),
    services: [...document.querySelectorAll('[name="businessService"]')]
  };

  const statusEl = document.querySelector("#businessProfileStatus");
  const submitButton = businessProfileForm?.querySelector('button[type="submit"]');
  const descriptionCount = document.querySelector("#descriptionCount");
  const logoPreview = document.querySelector("#logoPreview");
  const logoPreviewImg = document.querySelector("#logoPreviewImg");
  const profileAvatar = document.querySelector("#businessProfileAvatar");
  const profileName = document.querySelector("#businessProfileName");
  const profileMeta = document.querySelector("#businessProfileMeta");
  const applicationStatusSection = document.querySelector("#applicationStatusSection");
  const applicationStatusPill = document.querySelector("#applicationStatusPill");

  let currentUser = null;
  let currentBusinessProfile = null;

  // ── Status message handling ──────────────────────────────────────────────────
  const setStatus = (message = "", type = "") => {
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = type ? `is-${type}` : "";
    }
  };

  // ── Auth error handling ──────────────────────────────────────────────────────
  const showAuthError = (message) => {
    authErrorMessage.textContent = message;
    authErrorContainer.hidden = false;
    businessProfileForm.hidden = true;
  };

  // ── Utility functions ─────────────────────────────────────────────────────────
  const getCheckedServices = () =>
    formFields.services.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);

  const setCheckedServices = (values = []) => {
    // Handle both array and string (comma-separated) formats
    let serviceList = [];
    if (Array.isArray(values)) {
      serviceList = values;
    } else if (typeof values === "string" && values.trim()) {
      serviceList = values.split(",").map((s) => s.trim());
    }
    formFields.services.forEach((checkbox) => {
      checkbox.checked = serviceList.includes(checkbox.value);
    });
  };

  const formatStatus = (value) =>
    String(value || "")
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");

  const getInitials = (text) =>
    text
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();

  // ── Character counter for description ────────────────────────────────────────
  if (formFields.description && descriptionCount) {
    formFields.description.addEventListener("input", () => {
      const count = formFields.description.value.length;
      descriptionCount.textContent = `${count} / 500 characters`;
    });
  }

  // ── Logo preview update ──────────────────────────────────────────────────────
  const updateLogoPreview = () => {
    if (!formFields.logoDataUrl) return;
    const url = formFields.logoDataUrl.value.trim();
    if (url) {
      logoPreviewImg.src = url;
      logoPreview.hidden = false;
    } else {
      logoPreview.hidden = true;
    }
  };

  if (formFields.logoDataUrl) {
    formFields.logoDataUrl.addEventListener("change", updateLogoPreview);
    formFields.logoDataUrl.addEventListener("blur", updateLogoPreview);
  }

  // ── Load business profile ────────────────────────────────────────────────────
  const loadBusinessProfile = async () => {
    try {
      const response = await fetch("/api/business/profile");
      if (!response.ok) {
        const result = await response.json();
        if (response.status === 401) {
          showAuthError("You must sign in to view your business profile.");
          return;
        }
        if (response.status === 403) {
          showAuthError("This page is only available for business accounts. Sign in with a business account to continue.");
          return;
        }
        throw new Error(result.error || "Failed to load business profile.");
      }

      const result = await response.json();
      currentUser = result.user;
      currentBusinessProfile = result.businessProfile || {};

      populateBusinessProfile();
      displayApplicationStatus(result.applicationStatus);
      businessProfileForm.hidden = false;
      authErrorContainer.hidden = true;
    } catch (error) {
      showAuthError(error.message || "Unable to load your business profile. Please try again.");
    }
  };

  // ── Populate form with profile data ──────────────────────────────────────────
  const populateBusinessProfile = () => {
    if (!currentUser || !currentBusinessProfile) return;

    const displayName = currentUser.settings?.displayName || "Your Business";
    const businessName = displayName || "Your Business";

    profileName.textContent = businessName;
    profileMeta.textContent = "Business account";
    profileAvatar.textContent = getInitials(businessName);

    formFields.displayName.value = displayName;
    formFields.website.value = currentBusinessProfile.website || "";
    formFields.contactPhone.value = currentBusinessProfile.contactPhone || "";
    formFields.location.value = currentBusinessProfile.location || "";
    formFields.description.value = currentBusinessProfile.description || "";
    formFields.openingHours.value = currentBusinessProfile.openingHours || "";
    formFields.priceRange.value = currentBusinessProfile.priceRange || "";
    formFields.logoDataUrl.value = currentBusinessProfile.logoDataUrl || "";

    setCheckedServices(currentBusinessProfile.services || []);

    const count = formFields.description.value.length;
    if (descriptionCount) {
      descriptionCount.textContent = `${count} / 500 characters`;
    }

    updateLogoPreview();
  };

  // ── Display application status ───────────────────────────────────────────────
  const displayApplicationStatus = (status) => {
    if (applicationStatusPill && applicationStatusSection) {
      applicationStatusPill.textContent = formatStatus(status || "pending_review");
      applicationStatusSection.hidden = false;
    }
  };

  // ── Save business profile ────────────────────────────────────────────────────
  const saveBusinessProfile = async (event) => {
    event.preventDefault();
    if (!submitButton) return;

    submitButton.disabled = true;
    setStatus("Saving…");

    try {
      const payload = {
        businessProfile: {
          website: formFields.website.value.trim(),
          contactPhone: formFields.contactPhone.value.trim(),
          location: formFields.location.value.trim(),
          description: formFields.description.value.trim(),
          services: getCheckedServices(),
          openingHours: formFields.openingHours.value.trim(),
          priceRange: formFields.priceRange.value.trim(),
          logoDataUrl: formFields.logoDataUrl.value.trim()
        },
        settings: {
          displayName: formFields.displayName.value.trim()
        }
      };

      const response = await fetch("/api/business/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Profile could not be saved.");
      }

      currentUser = result.user;
      currentBusinessProfile = result.businessProfile || {};
      populateBusinessProfile();
      displayApplicationStatus(result.applicationStatus);
      setStatus(result.message || "Profile saved successfully.", "success");
    } catch (error) {
      setStatus(error.message || "Failed to save profile.", "error");
    } finally {
      submitButton.disabled = false;
    }
  };

  // ── Form submission ──────────────────────────────────────────────────────────
  if (businessProfileForm) {
    businessProfileForm.addEventListener("submit", saveBusinessProfile);
  }

  // ── Initialize ───────────────────────────────────────────────────────────────
  loadBusinessProfile();
}
