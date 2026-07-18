const PROFILE_STORAGE_KEY = "temptx_profile_content";

const profileEditForm = document.querySelector("#profileEditForm");

if (profileEditForm) {
  const statusEl = document.querySelector("#profileEditStatus");
  const submitButton = profileEditForm.querySelector('button[type="submit"]');
  const photoInput = document.querySelector("#photoInput");
  const photoGrid = document.querySelector("#photoPreviewGrid");
  const availabilityTable = document.querySelector("#availabilityTable");
  const toursTable = document.querySelector("#toursTable");
  const profileNoteEl = document.querySelector("#profileNote");
  const profileNoteCount = document.querySelector("#profileNoteCount");
  const serviceCheckboxes = [...document.querySelectorAll('[name="editService"]')];

  let currentUser = null;
  // Photo previews live only in the current session; names are persisted on the server.
  let sessionPhotos = []; // { name, dataUrl }
  // Last profile payload loaded from GET /api/profile (or the local fallback) — reused by
  // the setup checklist so it never triggers its own network request.
  let currentProfileData = {};

  const setupChecklistList = document.querySelector("#setupChecklistList");
  const setupChecklistProgressFill = document.querySelector("#setupChecklistProgressFill");
  const setupChecklistProgressLabel = document.querySelector("#setupChecklistProgressLabel");

  // ── Status ──────────────────────────────────────────────────────────────────
  const setStatus = (message = "", type = "") => {
    statusEl.textContent = message;
    statusEl.className = type ? `is-${type}` : "";
  };

  // ── localStorage helpers (migration fallback only) ───────────────────────────
  const loadLocal = () => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  };

  // ── API helpers ──────────────────────────────────────────────────────────────
  const fetchProfile = async () => {
    const response = await fetch("/api/profile");
    if (!response.ok) return null;
    const { profile } = await response.json();
    return profile;
  };

  const saveProfileApi = async (data) => {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Profile could not be saved.");
    return result.profile;
  };

  // ── Photo management ─────────────────────────────────────────────────────────
  const renderPhotoGrid = (savedNames = []) => {
    photoGrid.innerHTML = "";

    sessionPhotos.forEach((photo, idx) => {
      const thumb = document.createElement("div");
      thumb.className = "profile-photo-thumb";

      const img = document.createElement("img");
      img.src = photo.dataUrl;
      img.alt = photo.name;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "profile-photo-remove";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", `Remove ${photo.name}`);
      removeBtn.addEventListener("click", () => {
        sessionPhotos.splice(idx, 1);
        renderPhotoGrid();
      });

      thumb.append(img, removeBtn);
      photoGrid.appendChild(thumb);
    });

    // Show persisted-but-not-previewed names as text tiles.
    const sessionNames = new Set(sessionPhotos.map((p) => p.name));
    savedNames
      .filter((name) => !sessionNames.has(name))
      .forEach((name) => {
        const tile = document.createElement("div");
        tile.className = "profile-photo-thumb profile-photo-thumb--saved";
        tile.textContent = name;
        photoGrid.appendChild(tile);
      });
  };

  if (photoInput) {
    photoInput.addEventListener("change", () => {
      const slots = 8 - sessionPhotos.length;
      [...photoInput.files].slice(0, slots).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          sessionPhotos.push({ name: file.name, dataUrl: e.target.result });
          renderPhotoGrid(loadLocal().photoNames || []);
        };
        reader.readAsDataURL(file);
      });
      photoInput.value = "";
    });
  }

  // ── Profile note character counter ──────────────────────────────────────────
  if (profileNoteEl && profileNoteCount) {
    const updateCount = () => {
      profileNoteCount.textContent = `${profileNoteEl.value.length} / 500 characters`;
    };
    profileNoteEl.addEventListener("input", updateCount);
  }

  // ── Dynamic row builders ─────────────────────────────────────────────────────
  const makeInput = (placeholder, value = "", type = "text", ariaLabel = "") => {
    const input = document.createElement("input");
    input.type = type;
    input.className = "profile-edit-input";
    input.placeholder = placeholder;
    input.value = value;
    if (ariaLabel) input.setAttribute("aria-label", ariaLabel);
    return input;
  };

  const makeRemoveBtn = (row) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "profile-edit-remove-btn";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => row.remove());
    return btn;
  };

  const addAvailabilityRow = (day = "", availability = "", notes = "") => {
    const row = document.createElement("div");
    row.className = "profile-edit-row";
    row.setAttribute("role", "row");

    const dayInput = makeInput("Monday – Friday", day, "text", "Day");
    const availInput = makeInput("By appointment", availability, "text", "Availability");
    const notesInput = makeInput("Advance bookings preferred", notes, "text", "Notes");
    const actionCell = document.createElement("div");
    actionCell.appendChild(makeRemoveBtn(row));

    row.append(dayInput, availInput, notesInput, actionCell);
    availabilityTable.appendChild(row);
  };

  const addTourRow = (to = "", from = "", until = "") => {
    const row = document.createElement("div");
    row.className = "profile-edit-row";
    row.setAttribute("role", "row");

    const toInput = makeInput("Melbourne", to, "text", "Destination");
    const fromInput = makeInput("", from, "date", "From date");
    const untilInput = makeInput("", until, "date", "Until date");
    const actionCell = document.createElement("div");
    actionCell.appendChild(makeRemoveBtn(row));

    row.append(toInput, fromInput, untilInput, actionCell);
    toursTable.appendChild(row);
  };

  // ── Collect row data ─────────────────────────────────────────────────────────
  const getRowData = (tableEl) =>
    [...tableEl.querySelectorAll(".profile-edit-row")].map((row) => {
      const inputs = row.querySelectorAll("input");
      return [...inputs].map((input) => input.value.trim());
    });

  const getAvailabilityData = () =>
    getRowData(availabilityTable)
      .filter(([day, avail]) => day || avail)
      .map(([day, availability, notes]) => ({ day, availability, notes }));

  const getTourData = () =>
    getRowData(toursTable)
      .filter(([to, from]) => to || from)
      .map(([to, from, until]) => ({ to, from, until }));

  // ── Details field map (edit id → storage key) ────────────────────────────────
  const DETAIL_FIELDS = {
    detailLocation:     "location",
    detailAge:          "age",
    detailHeight:       "height",
    detailOrientation:  "orientation",
    detailHairColour:   "hairColour",
    detailEyeColour:    "eyeColour",
    detailBodyType:     "bodyType",
    detailPlaceOfService: "placeOfService",
  };

  // ── Populate form from profile data ──────────────────────────────────────────
  const populateForm = (data) => {
    const details = data.details || {};
    Object.entries(DETAIL_FIELDS).forEach(([elId, key]) => {
      const el = document.querySelector(`#${elId}`);
      if (el && details[key] !== undefined) el.value = details[key];
    });

    if (profileNoteEl) {
      profileNoteEl.value = data.profileNote || "";
      if (profileNoteCount) {
        profileNoteCount.textContent = `${profileNoteEl.value.length} / 500 characters`;
      }
    }

    const rateMap = {
      rateIncall1h:   data.rates?.incall?.oneHour    || "",
      rateIncall2h:   data.rates?.incall?.twoHours   || "",
      rateIncallOvn:  data.rates?.incall?.overnight  || "",
      rateOutcall1h:  data.rates?.outcall?.oneHour   || "",
      rateOutcall2h:  data.rates?.outcall?.twoHours  || "",
      rateOutcallOvn: data.rates?.outcall?.overnight || "",
    };
    Object.entries(rateMap).forEach(([id, value]) => {
      const el = document.querySelector(`#${id}`);
      if (el) el.value = value;
    });

    (data.availability || []).forEach(({ day, availability, notes }) =>
      addAvailabilityRow(day, availability, notes)
    );
    (data.tours || []).forEach(({ to, from, until }) => addTourRow(to, from, until));

    renderPhotoGrid(data.photoNames || []);
  };

  // ── Setup checklist ──────────────────────────────────────────────────────────
  // Derived entirely from currentUser (from /api/auth/me, already fetched in loadPage)
  // and currentProfileData (from GET /api/profile, already fetched in loadPage). No
  // additional network requests are made here.
  const REQUIREMENT_LABELS = {
    required: "Required",
    "required-verified": "Required for verified status",
    recommended: "Recommended"
  };

  const STATUS_LABELS = {
    complete: "Complete",
    "in-progress": "In progress",
    "not-started": "Not started"
  };

  const getPublicProfileHref = () =>
    currentUser?.id ? `profile.html?provider=${encodeURIComponent(currentUser.id)}` : "profile.html";

  const buildChecklistItems = () => {
    const data = currentProfileData || {};

    const displayName = String(currentUser?.settings?.displayName || currentUser?.workingName || "").trim();
    const savedPhotoCount = Array.isArray(data.photoNames) ? data.photoNames.length : 0;
    const hasPhoto = savedPhotoCount > 0 || sessionPhotos.length > 0;
    const hasIdentity = Boolean(displayName) && hasPhoto;
    const hasIdentityPartial = Boolean(displayName) || hasPhoto;

    const hasAvailability = Array.isArray(data.availability) && data.availability.length > 0;

    const profileNote = String(data.profileNote || "").trim();
    const hasProfileInfo = profileNote.length > 0;

    // Xync completion already exposed on the authenticated user response — not invented here.
    const xyncCompleted = Boolean(currentUser?.xyncStatus?.providerCompleted);

    // Verification status is not present anywhere on the user/profile model today,
    // so this item always reads "Not started" rather than guessing a state.
    const readyToPreview = hasIdentity && hasAvailability && hasProfileInfo;

    return [
      {
        id: "identity",
        title: "Add your profile identity",
        description: "Add your display name (in Settings) and at least one profile photo.",
        requirement: "required",
        status: hasIdentity ? "complete" : hasIdentityPartial ? "in-progress" : "not-started",
        actionLabel: "Add photos",
        actionHref: "#photoInput"
      },
      {
        id: "availability",
        title: "Add your availability",
        description: "Add at least one availability entry so clients know when to reach you.",
        requirement: "required",
        status: hasAvailability ? "complete" : "not-started",
        actionLabel: "Add availability",
        actionHref: "#availabilityTable"
      },
      {
        id: "info",
        title: "Add your profile information",
        description: "Write a short profile note describing your approach and boundaries.",
        requirement: "required",
        status: hasProfileInfo ? "complete" : "not-started",
        actionLabel: "Add profile note",
        actionHref: "#profileNote"
      },
      {
        id: "verification",
        title: "Complete verification",
        description: "Verify your identity to unlock the verified badge on your profile.",
        requirement: "required-verified",
        status: "not-started",
        actionLabel: "Start verification",
        actionHref: "verification.html"
      },
      {
        id: "xync",
        title: "Complete Provider Xync",
        description: "Answer the Xync questionnaire to improve client compatibility matches.",
        requirement: "recommended",
        status: xyncCompleted ? "complete" : "not-started",
        actionLabel: xyncCompleted ? "Review Xync" : "Start Xync",
        actionHref: "xync.html"
      },
      {
        id: "preview",
        title: "Preview your public profile",
        description: "Check how your profile appears to clients before it goes live.",
        requirement: "required",
        status: readyToPreview ? "complete" : "not-started",
        actionLabel: "Preview profile",
        actionHref: getPublicProfileHref()
      }
    ];
  };

  const renderChecklist = () => {
    if (!setupChecklistList) return;

    const items = buildChecklistItems();
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

  // ── Load page ────────────────────────────────────────────────────────────────
  const loadPage = async () => {
    try {
      const meResponse = await fetch("/api/auth/me");
      if (!meResponse.ok) {
        window.location.href = "provider-login.html";
        return;
      }
      const { user } = await meResponse.json();
      currentUser = user;

      if (user.role !== "provider") {
        window.location.href = "profile.html";
        return;
      }

      const displayName = user.settings?.displayName || "TEMPTX Provider";
      const avatarEl = document.querySelector("#profileEditAvatar");
      const nameEl = document.querySelector("#profileEditName");

      if (avatarEl) {
        avatarEl.textContent = displayName
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase() || "TX";
      }
      if (nameEl) nameEl.textContent = displayName;

      // Pre-check services from the API-backed settings.
      const savedServices = user.settings?.services || [];
      serviceCheckboxes.forEach((cb) => {
        cb.checked = savedServices.includes(cb.value);
      });
    } catch {
      setStatus("Unable to load profile data.", "error");
      return;
    }

    // Load rich profile content from the server; fall back to localStorage for
    // providers who saved data before server persistence was introduced.
    try {
      const serverProfile = await fetchProfile();
      const hasServerData =
        serverProfile &&
        Object.values(serverProfile.details || {}).some(Boolean);
      const profileData = hasServerData ? serverProfile : loadLocal();
      populateForm(profileData);
      currentProfileData = profileData || {};
    } catch {
      populateForm(loadLocal());
      currentProfileData = loadLocal();
    }

    renderChecklist();
  };

  // ── Add-row buttons ──────────────────────────────────────────────────────────
  document.querySelector("#addAvailabilityRow")?.addEventListener("click", () => addAvailabilityRow());
  document.querySelector("#addTourRow")?.addEventListener("click", () => addTourRow());

  // ── Save ─────────────────────────────────────────────────────────────────────
  profileEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    setStatus("Saving…");

    try {
      const details = {};
      Object.entries(DETAIL_FIELDS).forEach(([elId, key]) => {
        const el = document.querySelector(`#${elId}`);
        details[key] = el ? el.value.trim() : "";
      });

      const profileData = {
        details,
        profileNote: profileNoteEl?.value.trim() || "",
        rates: {
          incall: {
            oneHour:   document.querySelector("#rateIncall1h")?.value.trim()  || "",
            twoHours:  document.querySelector("#rateIncall2h")?.value.trim()  || "",
            overnight: document.querySelector("#rateIncallOvn")?.value.trim() || "",
          },
          outcall: {
            oneHour:   document.querySelector("#rateOutcall1h")?.value.trim()  || "",
            twoHours:  document.querySelector("#rateOutcall2h")?.value.trim()  || "",
            overnight: document.querySelector("#rateOutcallOvn")?.value.trim() || "",
          },
        },
        availability: getAvailabilityData(),
        tours: getTourData(),
        photoNames: sessionPhotos.map((p) => p.name),
      };

      // 1. Persist profile content to the server.
      const savedProfile = await saveProfileApi(profileData);
      currentProfileData = savedProfile || profileData;

      // 2. Persist selected services via the existing settings API.
      if (currentUser) {
        const services = serviceCheckboxes
          .filter((cb) => cb.checked)
          .map((cb) => cb.value);

        const s = currentUser.settings || {};
        const settingsResponse = await fetch("/api/auth/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName:        s.displayName        || currentUser.workingName || "",
            directMessages:     s.directMessages     !== false,
            groupInvites:       s.groupInvites       !== false,
            messagePreviews:    s.messagePreviews    !== false,
            activityStatus:     s.activityStatus     !== false,
            emailNotifications: Boolean(s.emailNotifications),
            profileVisible:     s.profileVisible     !== false,
            locations:          s.locations          || [],
            attributes:         s.attributes         || [],
            services,
          }),
        });

        const result = await settingsResponse.json();
        if (!settingsResponse.ok) throw new Error(result.error || "Services could not be saved.");
        currentUser = result.user;
      }

      renderChecklist();
      setStatus("Profile saved.", "success");
    } catch (error) {
      setStatus(error.message || "Profile could not be saved.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  loadPage();
}
