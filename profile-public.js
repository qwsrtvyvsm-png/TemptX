const providerId = new URLSearchParams(window.location.search).get("provider");
const messageCtas = document.querySelectorAll("[data-message-cta]");
const editProfileLinks = document.querySelectorAll("[data-edit-profile]");
const favouriteButtons = document.querySelectorAll("[data-favourite-provider]");

const renderPublicProvider = (provider) => {
  const name = document.querySelector("#publicProviderName");
  const locations = document.querySelector("#publicProviderLocations");
  const locationFact = document.querySelector("#publicProviderLocationFact");
  const attributeFact = document.querySelector("#publicProviderAttributeFact");
  const services = document.querySelector("#publicProviderServices");
  const favouriteButton = document.querySelector("[data-favourite-provider]");

  name.textContent = provider.name;
  locations.textContent = provider.locations.length ? provider.locations.join(" / ") : "Location available on request";
  locationFact.textContent = provider.locations.length ? provider.locations.join(", ") : "On request";
  attributeFact.textContent = provider.attributes.length ? provider.attributes.join(" / ") : "See profile details";
  document.title = `${provider.name} | TemptX`;

  if (favouriteButton) {
    favouriteButton.dataset.favouriteProvider = provider.id;
    favouriteButton.dataset.providerName = provider.name;
  }

  if (provider.services.length) {
    services.replaceChildren(
      ...provider.services.map((service) => {
        const article = document.createElement("article");
        const eyebrow = document.createElement("p");
        eyebrow.className = "eyebrow";
        eyebrow.textContent = "Services";
        const heading = document.createElement("h3");
        heading.textContent = service;
        const description = document.createElement("p");
        description.textContent = "Selected by this provider as part of their public directory information.";
        article.append(eyebrow, heading, description);
        return article;
      })
    );
  }
};

/**
 * Applies server-persisted profile details to the public profile page.
 * Runs for every visitor when the provider has saved profile content.
 */
const applyProfileDetails = (profile) => {
  if (!profile) return;

  const details = profile.details || {};

  const factMap = {
    location:       "publicProviderLocationFact",
    age:            "factAge",
    height:         "factHeight",
    orientation:    "factOrientation",
    hairColour:     "factHair",
    eyeColour:      "factEyes",
    bodyType:       "factBodyType",
    placeOfService: "publicProviderAttributeFact",
  };

  Object.entries(factMap).forEach(([key, elId]) => {
    const value = details[key];
    if (value) {
      const el = document.querySelector(`#${elId}`);
      if (el) el.textContent = value;
    }
  });

  // Profile note
  if (profile.profileNote) {
    const noteEl = document.querySelector("#publicProviderNote");
    const noteHeadingEl = document.querySelector("#publicProviderNoteHeading");
    if (noteEl) noteEl.textContent = profile.profileNote;
    if (noteHeadingEl) noteHeadingEl.textContent = "A note from this provider";
  }

  // Rates
  const rateMap = {
    publicRateIncall1h:   profile.rates?.incall?.oneHour,
    publicRateIncall2h:   profile.rates?.incall?.twoHours,
    publicRateIncallOvn:  profile.rates?.incall?.overnight,
    publicRateOutcall1h:  profile.rates?.outcall?.oneHour,
    publicRateOutcall2h:  profile.rates?.outcall?.twoHours,
    publicRateOutcallOvn: profile.rates?.outcall?.overnight,
  };
  Object.entries(rateMap).forEach(([id, value]) => {
    if (value) {
      const el = document.querySelector(`#${id}`);
      if (el) el.textContent = value;
    }
  });

  // Tours — replace placeholder rows when provider has tour data
  if (profile.tours && profile.tours.length) {
    const toursTable = document.querySelector("#publicToursTable");
    if (toursTable) {
      const header = toursTable.querySelector(".table-head");
      toursTable.innerHTML = "";
      if (header) toursTable.appendChild(header);
      profile.tours.forEach(({ to, from, until }) => {
        const row = document.createElement("div");
        row.className = "table-row";
        ["to", "from", "until"].forEach((key) => {
          const span = document.createElement("span");
          span.textContent = { to, from, until }[key] || "—";
          row.appendChild(span);
        });
        toursTable.appendChild(row);
      });
    }
  }

  // Availability — replace placeholder rows when provider has availability data
  if (profile.availability && profile.availability.length) {
    const availTable = document.querySelector("#publicAvailabilityTable");
    if (availTable) {
      const header = availTable.querySelector(".table-head");
      availTable.innerHTML = "";
      if (header) availTable.appendChild(header);
      profile.availability.forEach(({ day, availability, notes }) => {
        const row = document.createElement("div");
        row.className = "table-row";
        [day, availability, notes].forEach((text) => {
          const span = document.createElement("span");
          span.textContent = text || "—";
          row.appendChild(span);
        });
        availTable.appendChild(row);
      });
    }
  }
};

/**
 * Applies profile action controls based on who is viewing the profile.
 *
 * Rules for providers:
 *   - Own profile: replace "Message Now" with "Edit Profile", hide "Save to Favourites"
 *   - Client / unknown profile: hide "Message Now" only
 *   - Another provider/creator profile: no changes (default behaviour)
 *
 * profileIsProvider: true only when the URL's providerId was found in
 * the public directory listing (which only contains provider accounts).
 */
const applyOwnerControls = (viewerRole, viewerId, profileIsProvider) => {
  if (viewerRole !== "provider") return;

  const isOwnProfile = viewerId === providerId;
  const isClientOrUnknown = !profileIsProvider;

  if (isOwnProfile) {
    messageCtas.forEach((btn) => { btn.hidden = true; });
    editProfileLinks.forEach((link) => { link.hidden = false; });
    favouriteButtons.forEach((btn) => { btn.hidden = true; });
    return;
  }

  if (isClientOrUnknown) {
    messageCtas.forEach((btn) => { btn.hidden = true; });
  }
};

const loadPublicProvider = async () => {
  try {
    const fetches = [
      fetch("/api/auth/me"),
    ];
    if (providerId) {
      fetches.unshift(fetch("/api/directory/providers"));
      fetches.push(fetch(`/api/providers/${encodeURIComponent(providerId)}/profile`));
    }

    const responses = await Promise.all(fetches);

    let dirResponse = null;
    let sessionResponse = null;
    let profileResponse = null;

    if (providerId) {
      [dirResponse, sessionResponse, profileResponse] = responses;
    } else {
      [sessionResponse] = responses;
    }

    let profileIsProvider = false;

    if (dirResponse && dirResponse.ok) {
      const result = await dirResponse.json();
      const provider = result.providers.find((item) => item.id === providerId);
      if (provider) {
        renderPublicProvider(provider);
        profileIsProvider = true;
      }
    }

    // Apply server-persisted profile content for all visitors
    if (profileResponse && profileResponse.ok) {
      const { profile } = await profileResponse.json();
      applyProfileDetails(profile);
    }

    if (sessionResponse.ok) {
      const { user } = await sessionResponse.json();
      applyOwnerControls(user.role, user.id, profileIsProvider);
    }
  } catch {
    // The sample profile remains visible when the local account server is offline.
  }
};

loadPublicProvider();
