const providerId = new URLSearchParams(window.location.search).get("provider");

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

const loadPublicProvider = async () => {
  if (!providerId) return;

  try {
    const response = await fetch("/api/directory/providers");
    if (!response.ok) return;
    const result = await response.json();
    const provider = result.providers.find((item) => item.id === providerId);
    if (provider) renderPublicProvider(provider);
  } catch {
    // The sample profile remains visible when the local account server is offline.
  }
};

loadPublicProvider();
