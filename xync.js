(() => {
  const QUESTIONS_BASE = [
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

  const CLIENT_ONLY_QUESTION = {
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

  const els = {};
  const state = {
    user: null,
    role: null,
    questions: [],
    answers: {},
    currentIndex: 0,
    saving: false,
    loaded: false,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function toText(value) {
    return String(value ?? "");
  }

  function normalizeAnswers(input) {
    const output = {};
    if (!input || typeof input !== "object") {
      return output;
    }

    for (const question of QUESTIONS_BASE) {
      const value = input[question.key];
      if (question.type === "multi") {
        if (Array.isArray(value)) {
          output[question.key] = normalizeMultiAnswer(value);
        } else {
          output[question.key] = [];
        }
      } else if (typeof value === "string" && value) {
        output[question.key] = value;
      }
    }

    if (Object.hasOwn(input, CLIENT_ONLY_QUESTION.key)) {
      const value = input[CLIENT_ONLY_QUESTION.key];
      if (typeof value === "string" && value) {
        output[CLIENT_ONLY_QUESTION.key] = value;
      }
    }

    return output;
  }

  function questionsForRole(role) {
    const base = QUESTIONS_BASE.slice();
    if (role === "client") {
      base.push(CLIENT_ONLY_QUESTION);
    }
    return base;
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

  function setStatus(message, tone = "neutral") {
    els.saveStatus.textContent = message;
    els.saveStatus.dataset.tone = tone;
  }

  function showOnly(section) {
    const visible = new Set([section]);
    for (const [name, el] of Object.entries({
      loading: els.loading,
      empty: els.empty,
      denied: els.denied,
      app: els.app,
    })) {
      if (!el) {
        continue;
      }
      el.hidden = !visible.has(name);
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
    const value = state.answers[key];
    if (Array.isArray(value)) {
      return value;
    }
    return [];
  }

  function normalizeMultiAnswer(values) {
    const filtered = values.map((entry) => String(entry)).filter(Boolean);
    return filtered.includes("prefer_not_to_answer")
      ? ["prefer_not_to_answer"]
      : Array.from(new Set(filtered));
  }

  function updateAnswer(question, value, checked) {
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
      state.answers[question.key] = normalizeMultiAnswer(Array.from(current));
      return;
    }

    state.answers[question.key] = value;
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

    const selected = question.type === "multi" ? getMultiValue(question.key) : state.answers[question.key];
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

  async function loadAnswers() {
    const response = await fetch("/api/xync/provider", { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || "Unable to load Xync answers.");
    }
    return normalizeAnswers(payload?.answers || payload?.data?.answers || payload?.xync?.answers || payload);
  }

  async function saveAnswers() {
    if (state.saving) {
      return;
    }

    state.saving = true;
    els.save.disabled = true;
    setStatus("Saving Xync…");

    try {
      const response = await fetch("/api/xync/provider", {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers: state.answers,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
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

  function bindActions() {
    els.prev.addEventListener("click", () => moveQuestion(-1));
    els.next.addEventListener("click", () => moveQuestion(1));
    els.form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveAnswers().catch((error) => {
        setStatus(`Unable to save. ${toText(error.message || error)}`, "error");
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

      if (state.role !== "client" && state.role !== "provider") {
        els.deniedCopy.textContent = "This questionnaire is available for signed-in clients and providers only.";
        showOnly("denied");
        return;
      }

      state.questions = questionsForRole(state.role);
      state.answers = {};

      try {
        const saved = await loadAnswers();
        state.answers = saved;
      } catch (error) {
        setStatus(toText(error.message || error), "error");
      }

      if (!state.questions.length) {
        showOnly("empty");
        return;
      }

      renderQuestion();
      state.loaded = true;
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
