// Fills public/profile.html with a real provider's saved details on the
// server, for /providers/<slug>.
//
// The template ships with sample values (an age, measurements, tour dates,
// rates). Without this step a crawler, or a visitor whose JavaScript has not
// run yet, would read those samples as facts about a real person. Every
// placeholder is replaced with the provider's own value or a neutral
// "Not listed". public/profile-public.js then runs as usual and writes the
// same values, so the two never disagree.

const { escapeHtml } = require("./head");

const NOT_LISTED = "Not listed";

// Replaces the text of the element with this id. Leaf elements only.
const setText = (html, id, text) =>
  html.replace(
    new RegExp(`(<([a-z0-9]+)\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</\\2>)`, "i"),
    (match, open, tag, close) => `${open}${escapeHtml(text)}${close}`
  );

// Replaces everything inside <section ... id="..."> ... </section>.
// The sections used here contain no nested <section>.
const setSectionBody = (html, id, body) =>
  html.replace(
    new RegExp(`(<section\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</section>)`, "i"),
    (match, open, close) => `${open}${body}\n    ${close}`
  );

const text = (value) => String(value ?? "").trim();

const tableSection = (label, tableId, headings, rows) => `
      <div class="section-title-row">
        <p class="eyebrow">${label}</p>
      </div>

      <div class="profile-table" id="${tableId}">
        <div class="table-row table-head">
          ${headings.map((heading) => `<span>${heading}</span>`).join("\n          ")}
        </div>${rows
          .map(
            (cells) => `
        <div class="table-row">
          ${cells.map((cell) => `<span>${escapeHtml(text(cell) || "—")}</span>`).join("\n          ")}
        </div>`
          )
          .join("")}
      </div>`;

// provider: { name, locations, services, attributes, profile }
const fillProfile = (html, provider) => {
  const profile = provider.profile && typeof provider.profile === "object" ? provider.profile : {};
  const details = profile.details && typeof profile.details === "object" ? profile.details : {};
  const { locations, services, attributes } = provider;
  let output = html;

  output = setText(output, "publicProviderName", provider.name);
  output = setText(
    output,
    "publicProviderLocations",
    locations.length ? locations.join(" / ") : "Location available on request"
  );
  output = setText(
    output,
    "publicProviderLocationFact",
    text(details.location) || (locations.length ? locations.join(", ") : "On request")
  );
  output = setText(
    output,
    "publicProviderAttributeFact",
    text(details.placeOfService) || (attributes.length ? attributes.join(" / ") : "See profile details")
  );

  const facts = {
    factAge: details.age,
    factHeight: details.height,
    factBustSize: details.bustSize,
    factOrientation: details.orientation,
    factNationality: details.nationality,
    factHair: details.hairColour,
    factHairLength: details.hairLength,
    factEyes: details.eyeColour,
    factBodyType: details.bodyType
  };
  for (const [id, value] of Object.entries(facts)) output = setText(output, id, text(value) || NOT_LISTED);

  const note = text(profile.profileNote);
  output = setText(output, "publicProviderNoteHeading", note ? "A note from this provider" : "Profile note");
  output = setText(output, "publicProviderNote", note || "This provider has not added a profile note yet.");

  const serviceCards = (services.length ? services : ["Services on request"])
    .map(
      (service) => `
      <article>
        <p class="eyebrow">Services</p>
        <h3>${escapeHtml(service)}</h3>
        <p>${
          services.length
            ? "Selected by this provider as part of their public directory information."
            : "Contact this provider to ask about their services."
        }</p>
      </article>`
    )
    .join("\n");
  output = setSectionBody(output, "publicProviderServices", serviceCards);

  const tours = Array.isArray(profile.tours) ? profile.tours : [];
  output = setSectionBody(
    output,
    "publicToursSection",
    tableSection(
      "My tours",
      "publicToursTable",
      ["To", "From", "Until"],
      tours.length ? tours.map((tour) => [tour.to, tour.from, tour.until]) : [["No tours listed", "", ""]]
    )
  );

  const availability = Array.isArray(profile.availability) ? profile.availability : [];
  output = setSectionBody(
    output,
    "publicAvailabilitySection",
    tableSection(
      "My availability",
      "publicAvailabilityTable",
      ["Day", "Availability", "Notes"],
      availability.length
        ? availability.map((slot) => [slot.day, slot.availability, slot.notes])
        : [[NOT_LISTED, "", ""]]
    )
  );

  const rates = {
    publicRateIncall1h: profile.rates?.incall?.oneHour,
    publicRateIncall2h: profile.rates?.incall?.twoHours,
    publicRateIncallOvn: profile.rates?.incall?.overnight,
    publicRateOutcall1h: profile.rates?.outcall?.oneHour,
    publicRateOutcall2h: profile.rates?.outcall?.twoHours,
    publicRateOutcallOvn: profile.rates?.outcall?.overnight
  };
  for (const [id, value] of Object.entries(rates)) output = setText(output, id, text(value) || "On request");

  return output;
};

module.exports = { fillProfile };
