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
  // Photo previews live only in the current session; names are persisted in localStorage.
  let sessionPhotos = []; // { name, dataUrl }

  // ── Status ──────────────────────────────────────────────────────────────────
  const setStatus = (message = "", type = "") => {
    statusEl.textContent = message;
    statusEl.className = type ? `is-${type}` : "";
  };

  // ── localStorage helpers ─────────────────────────────────────────────────────
  const loadLocal = () => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  };

  const saveLocal = (data) => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Silently ignore quota errors; in-session state is still intact.
    }
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

  // ── Populate from saved data ─────────────────────────────────────────────────
  const populateLocal = (data) => {
    // Profile details
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
      rateIncall1h:  data.rates?.incall?.oneHour    || "",
      rateIncall2h:  data.rates?.incall?.twoHours   || "",
      rateIncallOvn: data.rates?.incall?.overnight  || "",
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

  // ── Load page ────────────────────────────────────────────────────────────────
  const loadPage = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        window.location.href = "provider-signin.html";
        return;
      }
      const { user } = await response.json();
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
    }

    populateLocal(loadLocal());
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
      // 1. Persist all non-API content to localStorage.
      const details = {};
      Object.entries(DETAIL_FIELDS).forEach(([elId, key]) => {
        const el = document.querySelector(`#${elId}`);
        details[key] = el ? el.value.trim() : "";
      });

      const localData = {
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
        // Store only file names — actual images are session-only.
        photoNames: sessionPhotos.map((p) => p.name),
      };
      saveLocal(localData);

      // 2. Persist selected services via the existing settings API.
      if (currentUser) {
        const services = serviceCheckboxes
          .filter((cb) => cb.checked)
          .map((cb) => cb.value);

        const s = currentUser.settings || {};
        const response = await fetch("/api/auth/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName:        s.displayName        || "",
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

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Services could not be saved.");
        currentUser = result.user;
      }

      setStatus("Profile saved.", "success");
    } catch (error) {
      setStatus(error.message || "Profile could not be saved.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  loadPage();
}
