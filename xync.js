(() => {
  const PROVIDER_QUESTIONS = [
    {
      key: "communicationStyle",
      type: "single",
      question: "How do you prefer to communicate before meeting?",
      options: [
        ["Direct and practical", "direct_and_practical"],
        ["Warm and conversational", "warm_and_conversational"],
        ["Detailed planning", "detailed_planning"],
        ["Minimal messaging", "minimal_messaging"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "socialEnergy",
      type: "single",
      question: "What kind of social energy suits you best?",
      options: [
        ["Calm and relaxed", "calm_and_relaxed"],
        ["Friendly and talkative", "friendly_and_talkative"],
        ["Playful and energetic", "playful_and_energetic"],
        ["Quiet and discreet", "quiet_and_discreet"],
        ["Flexible", "flexible"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "planningStyle",
      type: "single",
      question: "How do you prefer plans to be arranged?",
      options: [
        ["Well in advance", "well_in_advance"],
        ["A little planning", "a_little_planning"],
        ["Spontaneous", "spontaneous"],
        ["Flexible", "flexible"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "boundaries",
      type: "single",
      question: "How should boundaries be discussed?",
      options: [
        ["Clearly before meeting", "clearly_before_meeting"],
        ["Briefly before and confirmed in person", "briefly_before_and_confirmed_in_person"],
        ["Mainly in person", "mainly_in_person"],
        ["I am flexible", "i_am_flexible"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "consentCommunication",
      type: "single",
      question: "How do you prefer consent and comfort to be checked?",
      options: [
        ["Clear verbal check-ins", "clear_verbal_check_ins"],
        ["Natural ongoing communication", "natural_ongoing_communication"],
        ["A mix of verbal and non-verbal cues", "a_mix_of_verbal_and_non_verbal_cues"],
        ["Discussed before meeting", "discussed_before_meeting"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "interactionStyle",
      type: "single",
      question: "What overall interaction style are you looking for?",
      options: [
        ["Professional and straightforward", "professional_and_straightforward"],
        ["Warm and companion-like", "warm_and_companion_like"],
        ["Playful and flirty", "playful_and_flirty"],
        ["Relaxed and natural", "relaxed_and_natural"],
        ["Flexible", "flexible"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "bedroomPreferences",
      type: "multi",
      question: "Which experience preferences apply to you?",
      options: [
        ["Gentle", "gentle"],
        ["Passionate", "passionate"],
        ["Playful", "playful"],
        ["Experimental", "experimental"],
        ["Kink-friendly", "kink_friendly"],
        ["Conversation first", "conversation_first"],
        ["Flexible", "flexible"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "kinkPreferences",
      type: "multi",
      question: "Which best describes your interest in kink or fetish experiences?",
      options: [
        ["Not part of what I want", "not_part_of_what_i_want"],
        ["Curious", "curious"],
        ["Beginner-friendly", "beginner_friendly"],
        ["Experienced", "experienced"],
        ["Specific interests to discuss privately", "specific_interests_to_discuss_privately"],
        ["Open to different preferences", "open_to_different_preferences"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "substanceComfort",
      type: "single",
      question: "What is your comfort level around substance use?",
      options: [
        ["Substance-free only", "substance_free_only"],
        ["Prefer substance-free", "prefer_substance_free"],
        ["Comfortable discussing it first", "comfortable_discussing_it_first"],
        ["Flexible", "flexible"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
  ];

  const PROVIDER_CLIENT_QUESTION = {
    key: "substanceUse",
    type: "single",
    question: "Do you use substances before or during bookings?",
    help: "Your matched provider may see whether you disclosed substance use. Your full questionnaire answers remain private.",
    options: [
      ["No", "no"],
      ["Sometimes", "sometimes"],
      ["Yes", "yes"],
      ["Prefer not to answer", "prefer_not_to_answer"],
    ],
  };

  const CREATOR_QUESTIONS = [
    {
      key: "contentInterests",
      type: "multi",
      clientQuestion: "What types of content interest you?",
      creatorQuestion: "What types of content do you create?",
      options: [
        ["Photos", "photos"],
        ["Videos", "videos"],
        ["Live content", "live_content"],
        ["Custom content", "custom_content"],
        ["Audio", "audio"],
        ["Messaging experiences", "messaging_experiences"],
        ["Behind-the-scenes", "behind_the_scenes"],
        ["Kink or fetish content", "kink_or_fetish_content"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "spendingBudget",
      type: "single",
      clientQuestion: "What spending range usually suits you?",
      creatorQuestion: "What customer spending range suits your content?",
      options: [
        ["Under $25", "under_25"],
        ["$25–$50", "25_50"],
        ["$50–$100", "50_100"],
        ["Over $100", "over_100"],
        ["Depends on the content", "depends_on_the_content"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "interactionStyle",
      type: "single",
      clientQuestion: "What kind of creator interaction do you prefer?",
      creatorQuestion: "What kind of audience interaction do you offer?",
      options: [
        ["Mostly content-focused", "mostly_content_focused"],
        ["Friendly and conversational", "friendly_and_conversational"],
        ["Flirty and playful", "flirty_and_playful"],
        ["Personalised interaction", "personalised_interaction"],
        ["Flexible", "flexible"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "communicationFrequency",
      type: "single",
      clientQuestion: "How often would you like to interact?",
      creatorQuestion: "How often do you usually interact with clients?",
      options: [
        ["Occasionally", "occasionally"],
        ["A few times a week", "a_few_times_a_week"],
        ["Daily", "daily"],
        ["Mainly around purchases", "mainly_around_purchases"],
        ["Flexible", "flexible"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "customContentInterest",
      type: "single",
      clientQuestion: "How interested are you in custom content?",
      creatorQuestion: "How available are you for custom content?",
      options: [
        ["Not interested", "not_interested"],
        ["Sometimes", "sometimes"],
        ["Regularly", "regularly"],
        ["Depends on the request", "depends_on_the_request"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "kinkPreferences",
      type: "multi",
      clientQuestion: "What best describes your interest in kink or fetish content?",
      creatorQuestion: "What best describes the kink or fetish content you offer?",
      options: [
        ["None", "none"],
        ["Curious or beginner-friendly", "curious_or_beginner_friendly"],
        ["BDSM", "bdsm"],
        ["Roleplay", "roleplay"],
        ["Fetish-specific", "fetish_specific"],
        ["Open to discussing interests", "open_to_discussing_interests"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
    {
      key: "creatorSpecialties",
      type: "multi",
      clientQuestion: "What creator specialties interest you?",
      creatorQuestion: "What are your creator specialties?",
      options: [
        ["Glamour", "glamour"],
        ["Amateur or natural", "amateur_or_natural"],
        ["Luxury", "luxury"],
        ["Alternative", "alternative"],
        ["Couples", "couples"],
        ["Solo", "solo"],
        ["Educational", "educational"],
        ["Personalised experiences", "personalised_experiences"],
        ["Prefer not to answer", "prefer_not_to_answer"],
      ],
    },
  ];

  const QUESTIONNAIRES = {
    provider: {
      apiPath: "/api/xync/provider",
      label: "Provider Xync",
      questionsForRole(role) {
        return role === "client" ? [...PROVIDER_QUESTIONS, PROVIDER_CLIENT_QUESTION] : PROVIDER_QUESTIONS;
      },
    },
    creator: {
      apiPath: "/api/xync/creator",
      label: "Creator Xync",
      questionsForRole() {
        return CREATOR_QUESTIONS;
      },
    },
  };

  const els = {};
  const ALLOWED_ROLES = new Set(["client", "provider", "creator"]);
  const state = {
    user: null,
    role: null,
    activeType: "provider",
    questions: [],
    answersByType: {
      provider: {},
      creator: {},
    },
    savedByType: {
      provider: {},
      creator: {},
    },
    dirtyByType: {
      provider: false,
      creator: false,
    },
    currentIndex: 0,
    saving: false,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function toText(value) {
    return String(value ?? "");
  }

  function currentConfig(type = state.activeType) {
    return QUESTIONNAIRES[type];
  }

  function currentQuestions(type = state.activeType, role = state.role) {
    const config = currentConfig(type);
    if (!config) {
      return [];
    }

    const questions = config.questionsForRole(role);
    if (type !== "creator") {
      return questions;
    }

    return questions.map((question) => ({
      ...question,
      question: role === "client" ? question.clientQuestion : question.creatorQuestion,
    }));
  }

  function extractAnswersFromPayload(type, payload, role = state.role) {
    const answers = payload?.answers ?? payload?.data?.answers ?? payload?.xync?.answers;
    return answers ? normalizeAnswersForType(type, answers, role) : {};
  }

  function cloneAnswers(answers) {
    const source = answers || {};
    try {
      if (typeof structuredClone === "function") {
        return structuredClone(source);
      }
    } catch {
      // Fall back to a manual clone below.
    }

    const output = {};
    for (const [key, value] of Object.entries(source)) {
      if (Array.isArray(value)) {
        output[key] = value.map((entry) => (entry && typeof entry === "object" ? cloneAnswers(entry) : entry));
      } else if (value && typeof value === "object") {
        output[key] = cloneAnswers(value);
      } else {
        output[key] = value;
      }
    }
    return output;
  }

  function normalizeMultiAnswer(values) {
    const filtered = values.map((entry) => String(entry)).filter(Boolean);
    return filtered.includes("prefer_not_to_answer")
      ? ["prefer_not_to_answer"]
      : Array.from(new Set(filtered));
  }

  function normalizeAnswersForType(type, input, role = state.role) {
    const output = {};
    if (!input || typeof input !== "object") {
      return output;
    }

    for (const question of currentQuestions(type, role)) {
      const value = input[question.key];
      if (question.type === "multi") {
        output[question.key] = Array.isArray(value) ? normalizeMultiAnswer(value) : [];
      } else if (typeof value === "string" && value) {
        output[question.key] = value;
      }
    }

    return output;
  }

  function canonicalAnswer(question, value) {
    if (question.type === "multi") {
      return normalizeMultiAnswer(Array.isArray(value) ? value : []).slice().sort();
    }
    return typeof value === "string" ? value : "";
  }

  function answersEqualForType(type, left, right, role = state.role) {
    const questions = currentQuestions(type, role);
    for (const question of questions) {
      const leftValue = getAnswerValue(question, left);
      const rightValue = getAnswerValue(question, right);
      if (question.type === "multi") {
        const leftValues = canonicalAnswer(question, leftValue);
        const rightValues = canonicalAnswer(question, rightValue);
        if (leftValues.length !== rightValues.length) {
          return false;
        }
        for (let index = 0; index < leftValues.length; index += 1) {
          if (leftValues[index] !== rightValues[index]) {
            return false;
          }
        }
      } else if (leftValue !== rightValue) {
        return false;
      }
    }
    return true;
  }

  function setDirty(type) {
    state.dirtyByType[type] = !answersEqualForType(type, state.answersByType[type], state.savedByType[type]);
  }

  function setStatus(message, tone = "neutral") {
    els.saveStatus.textContent = message;
    els.saveStatus.dataset.tone = tone;
  }

  function getAnswerValue(question, answers) {
    if (Object.hasOwn(answers || {}, question.key)) {
      return answers[question.key];
    }
    return question.type === "multi" ? [] : "";
  }

  function showOnly(section) {
    const visible = new Set([section]);
    for (const [name, el] of Object.entries({
      loading: els.loading,
      empty: els.empty,
      denied: els.denied,
      app: els.app,
    })) {
      if (el) {
        el.hidden = !visible.has(name);
      }
    }
  }

  function currentQuestion() {
    return state.questions[state.currentIndex] || null;
  }

  function progressPercent() {
    if (!state.questions.length) {
      return 0;
    }
    return Math.round(((state.currentIndex + 1) / state.questions.length) * 100);
  }

  function isPreferNotToAnswer(value) {
    return value === "prefer_not_to_answer";
  }

  function getMultiValue(key) {
    const value = state.answersByType[state.activeType][key];
    return Array.isArray(value) ? value : [];
  }

  function updateAnswer(question, value, checked) {
    const type = state.activeType;
    if (question.type === "multi") {
      const current = new Set(getMultiValue(question.key));
      if (isPreferNotToAnswer(value)) {
        if (checked) {
          current.clear();
          current.add("prefer_not_to_answer");
        } else {
          current.delete("prefer_not_to_answer");
        }
      } else if (checked) {
        current.delete("prefer_not_to_answer");
        current.add(value);
      } else {
        current.delete(value);
      }
      state.answersByType[type][question.key] = normalizeMultiAnswer(Array.from(current));
    } else {
      state.answersByType[type][question.key] = value;
    }
    setDirty(type);
  }

  function renderTypeSwitcher() {
    const isClient = state.role === "client";
    els.typeSwitch.hidden = !isClient;
    if (!isClient) {
      return;
    }

    const activeLabel = currentConfig().label;
    els.roleLabel.textContent = activeLabel;
    els.typeSwitchLabel.textContent = `Active: ${activeLabel}`;
    els.providerToggle.classList.toggle("is-active", state.activeType === "provider");
    els.creatorToggle.classList.toggle("is-active", state.activeType === "creator");
    els.providerToggle.setAttribute("aria-pressed", String(state.activeType === "provider"));
    els.creatorToggle.setAttribute("aria-pressed", String(state.activeType === "creator"));
  }

  function renderQuestion() {
    const question = currentQuestion();
    if (!question) {
      return;
    }

    els.questionCount.textContent = `Question ${state.currentIndex + 1} of ${state.questions.length}`;
    els.progressFill.style.width = `${progressPercent()}%`;
    els.progressText.textContent = `${progressPercent()}%`;
    els.questionLegend.textContent = question.question;
    els.questionCopy.textContent = question.question;
    els.options.innerHTML = "";
    els.prev.disabled = state.currentIndex === 0;
    els.next.disabled = state.currentIndex === state.questions.length - 1;

    const selected = question.type === "multi"
      ? getMultiValue(question.key)
      : state.answersByType[state.activeType][question.key];
    const selectedSet = new Set(Array.isArray(selected) ? selected : [selected].filter(Boolean));

    question.options.forEach(([labelText, value], index) => {
      const wrap = document.createElement("div");
      wrap.className = "option-card";

      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = question.type === "multi" ? "checkbox" : "radio";
      input.name = question.key;
      input.value = value;
      input.checked = selectedSet.has(value);
      input.id = `${question.key}-${index}`;
      input.addEventListener("change", () => {
        updateAnswer(question, value, input.checked);
        renderQuestion();
      });
      wrap.classList.toggle("is-selected", input.checked);

      const text = document.createElement("span");
      text.textContent = labelText;
      label.htmlFor = input.id;
      label.append(input, text);
      wrap.append(label);
      els.options.append(wrap);
    });

    if (question.help) {
      const help = document.createElement("p");
      help.className = "question-block__help";
      help.textContent = question.help;
      els.options.append(help);
    }

    renderTypeSwitcher();
  }

  function moveQuestion(delta) {
    const nextIndex = state.currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= state.questions.length) {
      return;
    }
    state.currentIndex = nextIndex;
    renderQuestion();
  }

  function responseText(payload) {
    if (payload == null) {
      return "";
    }
    if (typeof payload === "string") {
      return payload;
    }
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return "Response received.";
    }
  }

  async function loadUser() {
    const response = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!response.ok) {
      window.location.replace("auth.html?mode=login&next=%2Fxync.html");
      return null;
    }

    const payload = await response.json().catch(() => ({}));
    const user = payload?.user || payload?.data?.user || payload;
    if (!user || !user.role) {
      window.location.replace("auth.html?mode=login&next=%2Fxync.html");
      return null;
    }

    return user;
  }

  async function loadAnswers(type) {
    const config = currentConfig(type);
    const response = await fetch(config.apiPath, { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || "Unable to load Xync answers.");
    }
    return extractAnswersFromPayload(type, payload);
  }

  async function refreshQuestionnaire(type) {
    const saved = await loadAnswers(type);
    state.savedByType[type] = cloneAnswers(saved);
    if (!state.dirtyByType[type]) {
      state.answersByType[type] = cloneAnswers(saved);
    } else {
      setDirty(type);
    }
  }

  async function saveAnswers() {
    if (state.saving) {
      return;
    }

    const type = state.activeType;
    const config = currentConfig(type);
    state.saving = true;
    els.save.disabled = true;
    setStatus("Saving Xync…");

    try {
      const response = await fetch(config.apiPath, {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers: state.answersByType[type],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        const saved = extractAnswersFromPayload(type, payload, state.role);
        const finalSaved = Object.keys(saved).length ? saved : cloneAnswers(state.answersByType[type]);
        if (!Object.keys(saved).length) {
          console.warn("Xync save response did not include saved answers; using the current draft as the saved state.");
        }
        state.savedByType[type] = cloneAnswers(finalSaved);
        state.answersByType[type] = cloneAnswers(finalSaved);
        state.dirtyByType[type] = false;
        setStatus(responseText(payload) || "Saved.", "success");
      } else {
        setStatus(`Unable to save. ${responseText(payload)}`, "error");
      }
    } finally {
      state.saving = false;
      els.save.disabled = false;
    }
  }

  function initializeAgeGate() {
    const gate = els.ageGate;
    const confirm = els.ageConfirm;
    const decline = els.ageDecline;
    const focusables = [confirm, decline];

    const setGateState = (open) => {
      gate.hidden = !open;
      for (const child of document.body.children) {
        if (child !== gate) {
          child.inert = open;
        }
      }
      if (open) {
        confirm.focus();
      }
    };

    confirm.addEventListener("click", () => {
      setGateState(false);
    });

    decline.addEventListener("click", () => {
      window.location.href = backLinkForRole(state.role).href;
    });

    document.addEventListener("keydown", (event) => {
      if (gate.hidden || event.key !== "Tab") {
        return;
      }

      const activeIndex = focusables.indexOf(document.activeElement);
      if (activeIndex === -1) {
        confirm.focus();
        event.preventDefault();
        return;
      }

      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = (activeIndex + direction + focusables.length) % focusables.length;
      focusables[nextIndex].focus();
      event.preventDefault();
    });

    setGateState(true);
  }

  function backLinkForRole(role) {
    if (role === "client") {
      return { href: "profile.html", text: "Back to profile" };
    }
    if (role === "provider") {
      return { href: "provider-profile.html", text: "Back to profile" };
    }
    if (role === "creator") {
      return { href: "creator-dashboard.html", text: "Back to dashboard" };
    }
    if (role === "business") {
      return { href: "business-dashboard.html", text: "Back to dashboard" };
    }
    return { href: "index.html", text: "Back" };
  }

  async function activateType(nextType) {
    if (nextType === state.activeType) {
      return;
    }

    const currentType = state.activeType;
    if (state.dirtyByType[currentType]) {
      const currentLabel = currentConfig(currentType).label;
      const nextLabel = currentConfig(nextType).label;
      const confirmed = window.confirm(
        `You have unsaved changes in ${currentLabel}. Switch to ${nextLabel} anyway?`
      );
      if (!confirmed) {
        return;
      }
    }

    state.activeType = nextType;
    state.currentIndex = 0;
    showOnly("loading");
    try {
      await refreshQuestionnaire(nextType);
      renderTypeSwitcher();
      renderQuestion();
      showOnly("app");
      setStatus("Your answers are ready to edit.");
    } catch (error) {
      els.empty.querySelector("p").textContent = toText(error.message || error);
      showOnly("empty");
    }
  }

  function bindActions() {
    els.prev.addEventListener("click", () => moveQuestion(-1));
    els.next.addEventListener("click", () => moveQuestion(1));
    els.form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveAnswers().catch((error) => {
        setStatus(`Unable to save. ${toText(error.message || error)}`, "error");
      });
    });
    els.providerToggle.addEventListener("click", () => {
      activateType("provider").catch((error) => {
        setStatus(`Unable to switch. ${toText(error.message || error)}`, "error");
      });
    });
    els.creatorToggle.addEventListener("click", () => {
      activateType("creator").catch((error) => {
        setStatus(`Unable to switch. ${toText(error.message || error)}`, "error");
      });
    });
  }

  async function initialize() {
    els.ageGate = $("age-gate");
    els.ageConfirm = $("age-gate-confirm");
    els.ageDecline = $("age-gate-decline");
    els.backLink = $("xync-back-link");
    els.loading = $("xync-loading");
    els.empty = $("xync-empty");
    els.denied = $("xync-access-denied");
    els.deniedCopy = $("xync-access-denied-copy");
    els.deniedLink = $("xync-access-denied-link");
    els.app = $("xync-app");
    els.form = $("xync-form");
    els.roleLabel = $("xync-role-label");
    els.questionCount = $("xync-question-count");
    els.questionLegend = $("xync-question-legend");
    els.questionCopy = $("xync-question-copy");
    els.options = $("xync-options");
    els.prev = $("xync-prev");
    els.next = $("xync-next");
    els.save = $("xync-save");
    els.saveStatus = $("xync-save-status");
    els.progressFill = $("xync-progress-fill");
    els.progressText = $("xync-progress-text");
    els.typeSwitch = $("xync-type-switch");
    els.typeSwitchLabel = $("xync-type-switch-label");
    els.providerToggle = $("xync-provider-toggle");
    els.creatorToggle = $("xync-creator-toggle");

    initializeAgeGate();
    bindActions();

    showOnly("loading");

    try {
      state.user = await loadUser();
      if (!state.user) {
        return;
      }

      state.role = state.user.role;
      const backLink = backLinkForRole(state.role);
      els.backLink.href = backLink.href;
      els.backLink.textContent = backLink.text;
      els.deniedLink.href = backLink.href;

      if (!ALLOWED_ROLES.has(state.role)) {
        els.deniedCopy.textContent = "This questionnaire is available for signed-in clients, providers, and creators only.";
        showOnly("denied");
        return;
      }

      if (state.role === "creator") {
        state.activeType = "creator";
      } else if (state.role === "provider" || state.role === "client") {
        state.activeType = "provider";
      }
      state.questions = currentQuestions(state.activeType);
      els.roleLabel.textContent = currentConfig(state.activeType).label;

      await refreshQuestionnaire(state.activeType);
      state.currentIndex = 0;
      renderTypeSwitcher();
      renderQuestion();
      showOnly("app");
      setStatus("Your answers are ready to edit.");
    } catch (error) {
      els.empty.querySelector("p").textContent = toText(error.message || error);
      showOnly("empty");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initialize().catch((error) => {
      const emptyCopy = els.empty?.querySelector("p");
      if (emptyCopy) {
        emptyCopy.textContent = toText(error.message || error);
      }
      showOnly("empty");
    });
  });
})();
