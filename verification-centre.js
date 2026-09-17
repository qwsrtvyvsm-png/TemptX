(() => {
  const els = {
    pageError: document.querySelector("#pageError"),
    avatar: document.querySelector("#verificationAvatar"),
    trustLevelLabel: document.querySelector("#trustLevelLabel"),
    trustLevelMeta: document.querySelector("#trustLevelMeta"),
    trustPassportHint: document.querySelector("#trustPassportHint"),
    checklistList: document.querySelector("#verificationChecklistList"),
    checklistFill: document.querySelector("#verificationProgressFill"),
    checklistLabel: document.querySelector("#verificationProgressLabel"),

    emailCard: document.querySelector("#emailVerificationCard"),
    emailStatusBadge: document.querySelector("#emailStatusBadge"),
    emailAddressStep: document.querySelector("#emailAddressStep"),
    emailAddressInput: document.querySelector("#emailAddressInput"),
    emailSendButton: document.querySelector("#emailSendButton"),
    emailSendStep: document.querySelector("#emailSendStep"),
    emailTargetDisplay: document.querySelector("#emailTargetDisplay"),
    emailSendExistingButton: document.querySelector("#emailSendExistingButton"),
    emailCodeStep: document.querySelector("#emailCodeStep"),
    emailCodeInput: document.querySelector("#emailCodeInput"),
    emailConfirmButton: document.querySelector("#emailConfirmButton"),
    emailResendButton: document.querySelector("#emailResendButton"),
    emailCooldownHint: document.querySelector("#emailCooldownHint"),
    emailVerifiedStep: document.querySelector("#emailVerifiedStep"),
    emailVerifiedText: document.querySelector("#emailVerifiedText"),
    emailError: document.querySelector("#emailError"),

    phoneCard: document.querySelector("#phoneVerificationCard"),
    phoneStatusBadge: document.querySelector("#phoneStatusBadge"),
    phoneAddressStep: document.querySelector("#phoneAddressStep"),
    phoneNumberInput: document.querySelector("#phoneNumberInput"),
    phoneSendButton: document.querySelector("#phoneSendButton"),
    phoneCodeStep: document.querySelector("#phoneCodeStep"),
    phoneCodeInput: document.querySelector("#phoneCodeInput"),
    phoneConfirmButton: document.querySelector("#phoneConfirmButton"),
    phoneResendButton: document.querySelector("#phoneResendButton"),
    phoneCooldownHint: document.querySelector("#phoneCooldownHint"),
    phoneVerifiedStep: document.querySelector("#phoneVerifiedStep"),
    phoneVerifiedText: document.querySelector("#phoneVerifiedText"),
    phoneError: document.querySelector("#phoneError"),

    identityCard: document.querySelector("#identityVerificationCard"),
    identityStatusBadge: document.querySelector("#identityStatusBadge"),
    identityUnavailableStep: document.querySelector("#identityUnavailableStep"),
    identityStartStep: document.querySelector("#identityStartStep"),
    identityStartButton: document.querySelector("#identityStartButton"),
    identityPendingStep: document.querySelector("#identityPendingStep"),
    identityFailedStep: document.querySelector("#identityFailedStep"),
    identityRetryButton: document.querySelector("#identityRetryButton"),
    identityVerifiedStep: document.querySelector("#identityVerifiedStep"),
    identityVerifiedText: document.querySelector("#identityVerifiedText"),
    identityError: document.querySelector("#identityError")
  };

  const STATUS_LABELS = {
    unverified: "Not started",
    pending: "Code sent",
    verified: "Verified",
    failed: "Not verified"
  };

  const TRUST_HINTS = {
    0: "Verify your email or phone to reach Partially Verified.",
    1: "Verify your remaining channel to reach Fully Verified.",
    2: "You're Fully Verified. Identity verification is available below for an extra layer of trust.",
    3: "You're Identity Verified — the highest Trust Level on TemptX."
  };

  let state = {
    user: null,
    verification: {
      email: { status: "unverified" },
      phone: { status: "unverified" },
      identity: { status: "unverified" }
    },
    trustLevel: 0,
    trustLevelLabel: "Unverified",
    cooldowns: { email: 0, phone: 0 },
    identityAvailable: false
  };

  const cooldownTimers = { email: null, phone: null };

  const formatDate = (iso) => {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(iso));
    } catch {
      return "";
    }
  };

  const setPageError = (message) => {
    if (!els.pageError) return;
    els.pageError.textContent = message || "";
    els.pageError.hidden = !message;
  };

  const setChannelError = (channel, message) => {
    const target = channel === "email" ? els.emailError : channel === "phone" ? els.phoneError : els.identityError;
    if (!target) return;
    target.textContent = message || "";
  };

  const renderPassport = () => {
    const name = String(state.user?.settings?.displayName || state.user?.workingName || "Member").trim();
    if (els.avatar) els.avatar.textContent = name.slice(0, 2).toUpperCase() || "TX";
    if (els.trustLevelLabel) els.trustLevelLabel.textContent = state.trustLevelLabel || "Unverified";
    const channels = state.identityAvailable ? ["email", "phone", "identity"] : ["email", "phone"];
    const verifiedCount = channels.filter((c) => state.verification[c]?.status === "verified").length;
    if (els.trustLevelMeta) {
      els.trustLevelMeta.textContent = `${verifiedCount} of ${channels.length} channels verified`;
    }
    if (els.trustPassportHint) {
      els.trustPassportHint.textContent = TRUST_HINTS[state.trustLevel] || "";
    }
  };

  const renderChecklist = () => {
    if (!els.checklistList) return;
    const items = [
      {
        id: "email",
        title: "Verify your email",
        status: state.verification.email?.status || "unverified",
        anchor: "#emailVerificationCard"
      },
      {
        id: "phone",
        title: "Verify your phone",
        status: state.verification.phone?.status || "unverified",
        anchor: "#phoneVerificationCard"
      }
    ];
    if (state.identityAvailable) {
      items.push({
        id: "identity",
        title: "Verify your identity",
        status: state.verification.identity?.status || "unverified",
        anchor: "#identityVerificationCard"
      });
    }
    const completed = items.filter((item) => item.status === "verified").length;
    const percent = Math.round((completed / items.length) * 100);

    if (els.checklistFill) els.checklistFill.style.width = `${percent}%`;
    if (els.checklistLabel) {
      els.checklistLabel.textContent = `${completed} of ${items.length} channels verified · ${percent}%`;
    }

    els.checklistList.innerHTML = "";
    items.forEach((item) => {
      const isComplete = item.status === "verified";
      const row = document.createElement("li");
      row.className = `setup-checklist-row is-${isComplete ? "complete" : item.status === "pending" ? "in-progress" : "not-started"}`;

      const textWrap = document.createElement("div");
      textWrap.className = "setup-checklist-row-text";

      const titleRow = document.createElement("div");
      titleRow.className = "setup-checklist-row-title";

      const check = document.createElement("span");
      check.className = "setup-checklist-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = isComplete ? "✓" : "";

      const title = document.createElement("strong");
      title.textContent = item.title;
      titleRow.append(check, title);

      const badges = document.createElement("div");
      badges.className = "setup-checklist-row-badges";
      const statusBadge = document.createElement("span");
      statusBadge.className = `setup-checklist-badge${isComplete ? " setup-checklist-badge--status-complete" : ""}`;
      statusBadge.textContent = STATUS_LABELS[item.status] || "Not started";
      badges.append(statusBadge);

      textWrap.append(titleRow, badges);

      const action = document.createElement("a");
      action.className = "outline-btn setup-checklist-action";
      action.href = item.anchor;
      action.textContent = isComplete ? "View" : "Continue";

      row.append(textWrap, action);
      els.checklistList.appendChild(row);
    });
  };

  const startCooldownCountdown = (channel, seconds) => {
    const hintEl = channel === "email" ? els.emailCooldownHint : els.phoneCooldownHint;
    const resendButton = channel === "email" ? els.emailResendButton : els.phoneResendButton;
    if (cooldownTimers[channel]) clearInterval(cooldownTimers[channel]);

    let remaining = seconds;
    const tick = () => {
      if (remaining <= 0) {
        clearInterval(cooldownTimers[channel]);
        cooldownTimers[channel] = null;
        if (hintEl) hintEl.textContent = "";
        if (resendButton) resendButton.disabled = false;
        return;
      }
      if (hintEl) hintEl.textContent = `You can resend in ${remaining}s.`;
      if (resendButton) resendButton.disabled = true;
      remaining -= 1;
    };
    tick();
    cooldownTimers[channel] = setInterval(tick, 1000);
  };

  const renderChannel = (channel) => {
    const verification = state.verification[channel] || { status: "unverified" };
    const status = verification.status || "unverified";
    const statusBadge = channel === "email" ? els.emailStatusBadge : els.phoneStatusBadge;
    if (statusBadge) {
      statusBadge.textContent = STATUS_LABELS[status] || "Not started";
      statusBadge.className = `verification-status-badge is-${status}`;
    }

    const steps =
      channel === "email"
        ? { address: els.emailAddressStep, send: els.emailSendStep, code: els.emailCodeStep, verified: els.emailVerifiedStep }
        : { address: els.phoneAddressStep, send: els.phoneAddressStep, code: els.phoneCodeStep, verified: els.phoneVerifiedStep };

    Object.values(steps).forEach((step) => {
      if (step) step.hidden = true;
    });

    if (status === "verified") {
      if (steps.verified) steps.verified.hidden = false;
      const verifiedText = channel === "email" ? els.emailVerifiedText : els.phoneVerifiedText;
      const detail = channel === "email" ? verification.address : verification.e164;
      if (verifiedText) {
        verifiedText.textContent = `Verified${detail ? ` — ${detail}` : ""}${
          verification.verifiedAt ? ` on ${formatDate(verification.verifiedAt)}` : ""
        }`;
      }
      return;
    }

    // Keep the target input/display reachable whenever a code could still be sent or
    // resent (unverified or pending) — otherwise a page reload while "pending" leaves
    // resend with an empty, hidden input and nothing valid to submit.
    if (channel === "email") {
      if (state.user?.email) {
        if (els.emailSendStep) els.emailSendStep.hidden = false;
        if (els.emailTargetDisplay) els.emailTargetDisplay.textContent = `We'll send a code to ${state.user.email}.`;
        if (els.emailSendExistingButton) els.emailSendExistingButton.hidden = status === "pending";
      } else {
        if (els.emailAddressStep) els.emailAddressStep.hidden = false;
        if (els.emailSendButton) els.emailSendButton.hidden = status === "pending";
      }
    } else {
      if (els.phoneAddressStep) els.phoneAddressStep.hidden = false;
      if (els.phoneNumberInput && !els.phoneNumberInput.value) {
        els.phoneNumberInput.value = state.user?.businessProfile?.contactPhone || "";
      }
      if (els.phoneSendButton) els.phoneSendButton.hidden = status === "pending";
    }

    if (status === "pending") {
      if (steps.code) steps.code.hidden = false;
      const cooldown = state.cooldowns?.[channel] || 0;
      if (cooldown > 0) startCooldownCountdown(channel, cooldown);
    }
  };

  const renderIdentity = () => {
    const verification = state.verification.identity || { status: "unverified" };
    const status = verification.status || "unverified";

    const steps = {
      unavailable: els.identityUnavailableStep,
      start: els.identityStartStep,
      pending: els.identityPendingStep,
      failed: els.identityFailedStep,
      verified: els.identityVerifiedStep
    };
    Object.values(steps).forEach((step) => {
      if (step) step.hidden = true;
    });

    if (!state.identityAvailable) {
      if (els.identityStatusBadge) {
        els.identityStatusBadge.textContent = "Not available yet";
        els.identityStatusBadge.className = "verification-status-badge is-unverified";
      }
      if (steps.unavailable) steps.unavailable.hidden = false;
      return;
    }

    if (els.identityStatusBadge) {
      els.identityStatusBadge.textContent = STATUS_LABELS[status] || "Not started";
      els.identityStatusBadge.className = `verification-status-badge is-${status}`;
    }

    if (status === "verified") {
      if (steps.verified) steps.verified.hidden = false;
      if (els.identityVerifiedText) {
        els.identityVerifiedText.textContent = `Verified${
          verification.verifiedAt ? ` on ${formatDate(verification.verifiedAt)}` : ""
        }`;
      }
      return;
    }

    if (status === "pending") {
      if (steps.pending) steps.pending.hidden = false;
      return;
    }

    if (status === "failed") {
      if (steps.failed) steps.failed.hidden = false;
      return;
    }

    if (steps.start) steps.start.hidden = false;
  };

  const renderAll = () => {
    renderPassport();
    renderChecklist();
    renderChannel("email");
    renderChannel("phone");
    renderIdentity();
  };

  const applyStatusResult = (result) => {
    state.verification = result.verification || state.verification;
    state.trustLevel = typeof result.trustLevel === "number" ? result.trustLevel : state.trustLevel;
    state.trustLevelLabel = result.trustLevelLabel || state.trustLevelLabel;
    if (result.cooldowns) state.cooldowns = result.cooldowns;
    if (typeof result.identityAvailable === "boolean") state.identityAvailable = result.identityAvailable;
  };

  const startIdentityVerification = async (button) => {
    setChannelError("identity", "");
    await withButtonLoading(button, async () => {
      try {
        const response = await fetch("/api/verification/identity/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnUrl: window.location.href })
        });
        const result = await response.json();
        if (!response.ok || result.available === false) {
          state.identityAvailable = false;
          renderIdentity();
          setChannelError("identity", result.error || "Identity verification isn't available right now.");
          return;
        }
        if (result.verification) {
          // dev-instant-pass or an already-resolved result came straight back.
          applyStatusResult(result);
          renderAll();
          return;
        }
        state.verification.identity = { ...state.verification.identity, status: "pending" };
        renderIdentity();
        renderChecklist();
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
        }
      } catch (error) {
        setChannelError("identity", error.message || "Could not start identity verification.");
      }
    });
  };

  const withButtonLoading = async (button, fn) => {
    if (!button) return fn();
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Please wait…";
    try {
      return await fn();
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  };

  const sendEmailCode = async (button, email) => {
    setChannelError("email", "");
    await withButtonLoading(button, async () => {
      try {
        const response = await fetch("/api/verification/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(email ? { email } : {})
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not send the code.");
        state.verification.email = { ...state.verification.email, status: "pending" };
        state.cooldowns.email = result.cooldownSeconds || 60;
        renderChannel("email");
        renderChecklist();
      } catch (error) {
        setChannelError("email", error.message);
      }
    });
  };

  const sendPhoneCode = async (button, e164) => {
    setChannelError("phone", "");
    await withButtonLoading(button, async () => {
      try {
        const response = await fetch("/api/verification/phone/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ e164 })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not send the code.");
        state.verification.phone = { ...state.verification.phone, status: "pending" };
        state.cooldowns.phone = result.cooldownSeconds || 60;
        renderChannel("phone");
        renderChecklist();
      } catch (error) {
        setChannelError("phone", error.message);
      }
    });
  };

  els.emailSendButton?.addEventListener("click", () => {
    const email = String(els.emailAddressInput?.value || "").trim();
    if (!email) return setChannelError("email", "Enter your email address.");
    sendEmailCode(els.emailSendButton, email);
  });

  els.emailSendExistingButton?.addEventListener("click", () => {
    sendEmailCode(els.emailSendExistingButton, null);
  });

  els.emailResendButton?.addEventListener("click", () => {
    const email = String(els.emailAddressInput?.value || "").trim() || null;
    sendEmailCode(els.emailResendButton, email);
  });

  els.emailConfirmButton?.addEventListener("click", async () => {
    setChannelError("email", "");
    const code = String(els.emailCodeInput?.value || "").trim();
    if (!code) return setChannelError("email", "Enter the 6-digit code.");
    await withButtonLoading(els.emailConfirmButton, async () => {
      try {
        const response = await fetch("/api/verification/email/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "That code didn't work.");
        applyStatusResult(result);
        if (els.emailCodeInput) els.emailCodeInput.value = "";
        renderAll();
      } catch (error) {
        setChannelError("email", error.message);
      }
    });
  });

  els.phoneSendButton?.addEventListener("click", () => {
    const e164 = String(els.phoneNumberInput?.value || "").trim();
    if (!e164) return setChannelError("phone", "Enter your mobile number.");
    sendPhoneCode(els.phoneSendButton, e164);
  });

  els.phoneResendButton?.addEventListener("click", () => {
    const e164 = String(els.phoneNumberInput?.value || "").trim();
    sendPhoneCode(els.phoneResendButton, e164);
  });

  els.phoneConfirmButton?.addEventListener("click", async () => {
    setChannelError("phone", "");
    const code = String(els.phoneCodeInput?.value || "").trim();
    if (!code) return setChannelError("phone", "Enter the 6-digit code.");
    await withButtonLoading(els.phoneConfirmButton, async () => {
      try {
        const response = await fetch("/api/verification/phone/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "That code didn't work.");
        applyStatusResult(result);
        if (els.phoneCodeInput) els.phoneCodeInput.value = "";
        renderAll();
      } catch (error) {
        setChannelError("phone", error.message);
      }
    });
  });

  els.identityStartButton?.addEventListener("click", () => {
    startIdentityVerification(els.identityStartButton);
  });

  els.identityRetryButton?.addEventListener("click", () => {
    startIdentityVerification(els.identityRetryButton);
  });

  const loadPage = async () => {
    try {
      const meResponse = await fetch("/api/auth/me");
      if (!meResponse.ok) {
        window.location.href = "auth.html?mode=login&next=" + encodeURIComponent("verification-centre.html");
        return;
      }
      const meResult = await meResponse.json();
      state.user = meResult.user;

      const statusResponse = await fetch("/api/verification/status");
      if (!statusResponse.ok) throw new Error("Unable to load verification status.");
      const statusResult = await statusResponse.json();
      applyStatusResult(statusResult);

      renderAll();
    } catch (error) {
      setPageError(error.message || "Unable to load the Verification Centre.");
    }
  };

  loadPage();
})();
