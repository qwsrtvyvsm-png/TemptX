const providerId = new URLSearchParams(window.location.search).get("provider");
const messageCtas = document.querySelectorAll("[data-message-cta]");

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
 * Hides message CTAs when the viewer is a provider who is:
 *   - viewing their own profile, or
 *   - viewing a profile that does not belong to a provider/creator
 *     (i.e. a client profile, or an unrecognised ID).
 *
 * profileIsProvider: true only when the URL's providerId was found in
 * the public directory listing (which only contains provider accounts).
 */
const applyMessageVisibility = (viewerRole, viewerId, profileIsProvider) => {
  if (viewerRole !== "provider") return;

  const isOwnProfile = viewerId === providerId;
  const isClientOrUnknown = !profileIsProvider;

  if (isOwnProfile || isClientOrUnknown) {
    messageCtas.forEach((btn) => {
      btn.hidden = true;
    });
  }
};

const loadPublicProvider = async () => {
  try {
    const [dirResponse, sessionResponse] = await Promise.all([
      providerId ? fetch("/api/directory/providers") : Promise.resolve(null),
      fetch("/api/auth/me"),
    ]);

    let profileIsProvider = false;

    if (dirResponse && dirResponse.ok) {
      const result = await dirResponse.json();
      const provider = result.providers.find((item) => item.id === providerId);
      if (provider) {
        renderPublicProvider(provider);
        profileIsProvider = true;
      }
    }

    if (sessionResponse.ok) {
      const { user } = await sessionResponse.json();
      applyMessageVisibility(user.role, user.id, profileIsProvider);
    }
  } catch {
    // The sample profile remains visible when the local account server is offline.
  }
};

loadPublicProvider();
