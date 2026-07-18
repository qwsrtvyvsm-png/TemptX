// Creator Profile editor — loads and saves the Creator profile object
// (displayName, creatorType, headline, bio, contentFormats,
// contentSpecialties, acceptsCustomContent, offersLivestreams, primaryUrl,
// secondaryUrl, location, isVisible) via the private /api/creators/profile
// routes. Kept entirely separate from the Provider (provider-profile.js)
// and Business (business-profile.js) editors — no shared state, no shared
// field names.

const creatorProfileForm = document.querySelector("#creatorProfileForm");
const creatorProfileErrorContainer = document.querySelector("#creatorProfileErrorContainer");
const creatorProfileErrorMessage = document.querySelector("#creatorProfileErrorMessage");

if (creatorProfileForm || creatorProfileErrorContainer) {
  // Mirrors the server's allow-lists — the page must never invent or send
  // any value outside these sets.
  const CREATOR_CONTENT_FORMATS = ["Photos", "Videos", "Livestreams", "Custom content", "Messaging"];
  const CREATOR_TYPES = [
    "Solo creator",
    "Couple or shared account",
    "Cam model",
    "Adult performer",
    "Custom content creator",
    "Fetish or kink creator",
    "Adult studio or production account"
  ];
  const CREATOR_CONTENT_SPECIALTIES = [
    "General adult content",
    "Solo",
    "Couples",
    "Fetish and kink",
    "Lingerie",
    "Glamour",
    "Roleplay",
    "Custom requests",
    "Educational",
    "Other"
  ];
  const BIO_MAX_LENGTH = 500;
  const DISPLAY_NAME_MAX_LENGTH = 80;
  const HEADLINE_MAX_LENGTH = 120;
  const LOCATION_MAX_LENGTH = 100;

  const displayNameEl = document.querySelector("#creatorDisplayName");
  const creatorTypeRadios = [...document.querySelectorAll('[name="creatorType"]')];
  const headlineEl = document.querySelector("#creatorHeadline");
  const bioEl = document.querySelector("#creatorBio");
  const bioCountEl = document.querySelector("#creatorBioCount");
  const contentFormatCheckboxes = [...document.querySelectorAll('[name="creatorContentFormat"]')];
  const contentSpecialtyCheckboxes = [...document.querySelectorAll('[name="creatorContentSpecialty"]')];
  const acceptsCustomContentEl = document.querySelector("#creatorAcceptsCustomContent");
  const offersLivestreamsEl = document.querySelector("#creatorOffersLivestreams");
  const primaryUrlEl = document.querySelector("#creatorPrimaryUrl");
  const secondaryUrlEl = document.querySelector("#creatorSecondaryUrl");
  const locationEl = document.querySelector("#creatorLocation");
  const isVisibleEl = document.querySelector("#creatorIsVisible");
  const statusEl = document.querySelector("#creatorProfileStatus");
  const submitButton = creatorProfileForm?.querySelector('button[type="submit"]');

  // ── Status message handling ──────────────────────────────────────────────────
  const setStatus = (message = "", type = "") => {
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = type ? `is-${type}` : "";
    }
  };

  // ── Auth / access error handling ─────────────────────────────────────────────
  const showAuthError = (message) => {
    if (creatorProfileErrorMessage) creatorProfileErrorMessage.textContent = message;
    if (creatorProfileErrorContainer) creatorProfileErrorContainer.hidden = false;
    if (creatorProfileForm) creatorProfileForm.hidden = true;
  };

  // ── Bio character counter ────────────────────────────────────────────────────
  const updateBioCount = () => {
    if (!bioEl || !bioCountEl) return;
    bioCountEl.textContent = `${bioEl.value.length} / ${BIO_MAX_LENGTH} characters`;
  };

  if (bioEl) {
    bioEl.addEventListener("input", () => {
      // Defensive client-side clamp in addition to the maxlength attribute.
      if (bioEl.value.length > BIO_MAX_LENGTH) {
        bioEl.value = bioEl.value.slice(0, BIO_MAX_LENGTH);
      }
      updateBioCount();
    });
  }

  // ── Collect / apply checkbox groups ──────────────────────────────────────────
  const getCheckedValues = (checkboxes, allowedValues) =>
    checkboxes.filter((checkbox) => checkbox.checked && allowedValues.includes(checkbox.value)).map((checkbox) => checkbox.value);

  const setCheckedValues = (checkboxes, values = []) => {
    const allowed = Array.isArray(values) ? values : [];
    checkboxes.forEach((checkbox) => {
      checkbox.checked = allowed.includes(checkbox.value);
    });
  };

  // ── Collect / apply the Creator type radio group ─────────────────────────────
  const getSelectedCreatorType = () =>
    creatorTypeRadios.find((radio) => radio.checked && CREATOR_TYPES.includes(radio.value))?.value || "";

  const setSelectedCreatorType = (value) => {
    creatorTypeRadios.forEach((radio) => {
      radio.checked = radio.value === value;
    });
  };

  // ── Populate form with profile data ──────────────────────────────────────────
  const populateForm = (profile = {}) => {
    if (displayNameEl) displayNameEl.value = String(profile.displayName || "").slice(0, DISPLAY_NAME_MAX_LENGTH);
    setSelectedCreatorType(profile.creatorType || "");
    if (headlineEl) headlineEl.value = String(profile.headline || "").slice(0, HEADLINE_MAX_LENGTH);

    if (bioEl) bioEl.value = String(profile.bio || "").slice(0, BIO_MAX_LENGTH);
    updateBioCount();

    setCheckedValues(contentFormatCheckboxes, profile.contentFormats);
    setCheckedValues(contentSpecialtyCheckboxes, profile.contentSpecialties);

    // Never auto-enable toggles — only reflect exactly what the server sent.
    if (acceptsCustomContentEl) acceptsCustomContentEl.checked = profile.acceptsCustomContent === true;
    if (offersLivestreamsEl) offersLivestreamsEl.checked = profile.offersLivestreams === true;

    if (primaryUrlEl) primaryUrlEl.value = String(profile.primaryUrl || "");
    if (secondaryUrlEl) secondaryUrlEl.value = String(profile.secondaryUrl || "");
    if (locationEl) locationEl.value = String(profile.location || "").slice(0, LOCATION_MAX_LENGTH);

    if (isVisibleEl) isVisibleEl.checked = profile.isVisible === true;
  };

  // ── Load Creator profile ──────────────────────────────────────────────────────
  const loadCreatorProfile = async () => {
    setStatus("Loading your Creator profile…", "loading");

    let response;
    try {
      response = await fetch("/api/creators/profile");
    } catch {
      showAuthError("Unable to reach the server. Check your connection and try again.");
      return;
    }

    if (response.status === 401) {
      window.location.href = "creator-login.html";
      return;
    }

    if (response.status === 403) {
      showAuthError("This page is only available for creator accounts. Sign in with a creator account to continue.");
      return;
    }

    if (!response.ok) {
      let message = "Unable to load your Creator profile. Please try again.";
      try {
        const result = await response.json();
        message = result.error || message;
      } catch {
        // No JSON body — keep the default message.
      }
      showAuthError(message);
      return;
    }

    try {
      const { profile } = await response.json();
      populateForm(profile || {});
      if (creatorProfileForm) creatorProfileForm.hidden = false;
      if (creatorProfileErrorContainer) creatorProfileErrorContainer.hidden = true;
      setStatus("");
    } catch {
      showAuthError("Unable to load your Creator profile. Please try again.");
    }
  };

  // ── Save Creator profile ──────────────────────────────────────────────────────
  const saveCreatorProfile = async (event) => {
    event.preventDefault();
    if (!submitButton || submitButton.disabled) return;

    submitButton.disabled = true;
    setStatus("Saving…", "loading");

    const payload = {
      displayName: String(displayNameEl?.value || "").trim().slice(0, DISPLAY_NAME_MAX_LENGTH),
      creatorType: getSelectedCreatorType(),
      headline: String(headlineEl?.value || "").trim().slice(0, HEADLINE_MAX_LENGTH),
      bio: String(bioEl?.value || "").trim().slice(0, BIO_MAX_LENGTH),
      contentFormats: getCheckedValues(contentFormatCheckboxes, CREATOR_CONTENT_FORMATS),
      contentSpecialties: getCheckedValues(contentSpecialtyCheckboxes, CREATOR_CONTENT_SPECIALTIES),
      acceptsCustomContent: acceptsCustomContentEl?.checked === true,
      offersLivestreams: offersLivestreamsEl?.checked === true,
      primaryUrl: String(primaryUrlEl?.value || "").trim(),
      secondaryUrl: String(secondaryUrlEl?.value || "").trim(),
      location: String(locationEl?.value || "").trim().slice(0, LOCATION_MAX_LENGTH),
      isVisible: isVisibleEl?.checked === true
    };

    try {
      const response = await fetch("/api/creators/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        window.location.href = "creator-login.html";
        return;
      }

      const result = await response.json().catch(() => ({}));

      if (response.status === 403) {
        throw new Error(result.error || "Only creators can save a Creator profile.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Your Creator profile could not be saved.");
      }

      // Reflect exactly what the server persisted — keep the form in sync
      // with the saved copy rather than trusting the local payload.
      populateForm(result.profile || payload);
      setStatus(result.message || "Creator profile saved.", "success");
    } catch (error) {
      // Leave the current on-screen values untouched so nothing entered is lost.
      setStatus(error.message || "Unable to save your Creator profile. Please try again.", "error");
    } finally {
      submitButton.disabled = false;
    }
  };

  creatorProfileForm?.addEventListener("submit", saveCreatorProfile);

  loadCreatorProfile();
}
