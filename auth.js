const authForm = document.querySelector("#authForm");
const pwaScript = document.createElement("script");
pwaScript.src = "pwa.js";
document.head.appendChild(pwaScript);

if (authForm) {
  const params = new URLSearchParams(window.location.search);
  const pageMode = document.body.dataset.authMode;
  const pageRole = document.body.dataset.authRole;
  let mode = pageMode === "signup" || pageMode === "login" ? pageMode : params.get("mode") === "signup" ? "signup" : "login";
  const validRoles = new Set(["client", "creator", "provider", "business"]);
  let role = validRoles.has(pageRole) ? pageRole : validRoles.has(params.get("role")) ? params.get("role") : "client";
  const lockedMode = pageMode === "signup" || pageMode === "login";
  const lockedRole = validRoles.has(pageRole);
  const requestedNext = params.get("next");
  const safeNext =
    requestedNext &&
    requestedNext.startsWith("/") &&
    !requestedNext.startsWith("//")
      ? requestedNext
      : null;

  const authTitle = document.querySelector("#authTitle");
  const authSubtitle = document.querySelector("#authSubtitle");
  const authModeSwitch = document.querySelector(".auth-mode-switch");
  const accountTypeSwitch = document.querySelector(".account-type-switch");
  const workingNameField = document.querySelector("#workingNameField");
  const emailField = document.querySelector("#emailField");
  const genderField = document.querySelector("#genderField");
  const accountCategoryField = document.querySelector("#accountCategoryField");
  const businessAbnField = document.querySelector("#businessAbnField");
  const websiteField = document.querySelector("#websiteField");
  const phoneField = document.querySelector("#phoneField");
  const businessDescriptionField = document.querySelector("#businessDescriptionField");
  const servicesField = document.querySelector("#servicesField");
  const locationField = document.querySelector("#locationField");
  const hoursField = document.querySelector("#hoursField");
  const priceRangeField = document.querySelector("#priceRangeField");
  const logoField = document.querySelector("#logoField");
  const authWorkingName = document.querySelector("#authWorkingName");
  const clientIdField = document.querySelector("#clientIdField");
  const authEmail = document.querySelector("#authEmail");
  const authGender = document.querySelector("#authGender");
  const authAccountCategory = document.querySelector("#authAccountCategory");
  const authBusinessAbn = document.querySelector("#authBusinessAbn");
  const authWebsite = document.querySelector("#authWebsite");
  const authBusinessPhone = document.querySelector("#authBusinessPhone");
  const authBusinessDescription = document.querySelector("#authBusinessDescription");
  const authServices = document.querySelector("#authServices");
  const authBusinessLocation = document.querySelector("#authBusinessLocation");
  const authOpeningHours = document.querySelector("#authOpeningHours");
  const authPriceRange = document.querySelector("#authPriceRange");
  const authLogoInput = document.querySelector("#authLogoInput");
  const authClientId = document.querySelector("#authClientId");
  const authPassword = document.querySelector("#authPassword");
  const loginOptions = document.querySelector("#loginOptions");
  const authStatus = document.querySelector("#authStatus");
  const authSubmit = document.querySelector("#authSubmit");
  const forgotModal = document.querySelector("#forgotModal");
  const forgotForm = document.querySelector("#forgotForm");
  const resetForm = document.querySelector("#resetForm");
  const forgotEmailField = document.querySelector("#forgotEmailField");
  const forgotClientIdField = document.querySelector("#forgotClientIdField");
  const forgotDescription = document.querySelector("#forgotDescription");
  const recoveryStatus = document.querySelector("#recoveryStatus");
  const authPrivacyNote = document.querySelector("#authPrivacyNote");
  const authPolicyLinks = document.querySelector("#authPolicyLinks");
  const policyConsentRow = document.querySelector("#policyConsentRow");
  const acceptedPolicies = document.querySelector("#acceptedPolicies");
  const passwordRequirements = document.querySelector("#passwordRequirements");
  const recoveryKeyCard = document.querySelector("#recoveryKeyCard");
  const recoveryKeyValue = document.querySelector("#recoveryKeyValue");

  const setStatus = (element, message = "", type = "") => {
    element.textContent = message;
    element.className = `auth-status${type ? ` is-${type}` : ""}`;
  };

  const readApiResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        `Account access needs the TEMPTX backend. Run npm start, then open http://127.0.0.1:5510${window.location.pathname}.`
      );
    }

    return response.json();
  };

  const updateView = () => {
    document.querySelectorAll("button[data-auth-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.authMode === mode);
    });
    document.querySelectorAll("button[data-account-role]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.accountRole === role);
    });

    const isProvider = role === "provider";
    const isBusiness = role === "business";
    const roleLabel =
      role === "provider" ? "provider" : role === "creator" ? "creator" : role === "business" ? "business" : "client";
    const isEmailAccount = role === "provider" || role === "creator" || isBusiness;
    const isSignup = mode === "signup";
    const isWorkerSignup = (role === "provider" || role === "creator") && isSignup;
    const isBusinessSignup = isBusiness && isSignup;

    workingNameField.hidden = !(isWorkerSignup || isBusinessSignup);
    emailField.hidden = !isEmailAccount;
    if (genderField) genderField.hidden = !isWorkerSignup;
    accountCategoryField.hidden = !(isWorkerSignup || isBusinessSignup);
    if (businessAbnField) businessAbnField.hidden = !isBusinessSignup;
    if (websiteField) websiteField.hidden = !isBusinessSignup;
    if (phoneField) phoneField.hidden = !isBusinessSignup;
    if (businessDescriptionField) businessDescriptionField.hidden = !isBusinessSignup;
    if (servicesField) servicesField.hidden = !isBusinessSignup;
    if (locationField) locationField.hidden = !isBusinessSignup;
    if (hoursField) hoursField.hidden = !isBusinessSignup;
    if (priceRangeField) priceRangeField.hidden = !isBusinessSignup;
    if (logoField) logoField.hidden = !isBusinessSignup;
    clientIdField.hidden = isEmailAccount || isSignup;
    authWorkingName.required = isWorkerSignup || isBusinessSignup;
    authEmail.required = isEmailAccount;
    if (authGender) authGender.required = isWorkerSignup;
    authAccountCategory.required = isWorkerSignup || isBusinessSignup;
    if (authBusinessAbn) authBusinessAbn.required = isBusinessSignup;
    authEmail.placeholder =
      role === "creator"
        ? "creator@example.com"
        : role === "provider"
        ? "provider@example.com"
        : role === "business"
        ? "contact@yourbusiness.com.au"
        : "";
    authClientId.required = !isEmailAccount && !isSignup;
    loginOptions.hidden = isSignup;
    policyConsentRow.hidden = !isSignup;
    if (authPolicyLinks) authPolicyLinks.hidden = !isSignup;
    acceptedPolicies.required = isSignup;
    passwordRequirements.hidden = !isSignup;
    authPassword.autocomplete = isSignup ? "new-password" : "current-password";
    if (authModeSwitch) authModeSwitch.hidden = lockedMode;
    if (accountTypeSwitch) accountTypeSwitch.hidden = lockedRole;

    authTitle.textContent = isSignup ? `Create your ${roleLabel} account.` : `Sign in as a ${roleLabel}.`;
    authSubtitle.textContent = isSignup
      ? isProvider
        ? "Create an individual provider profile"
        : role === "creator"
        ? "Create an individual creator profile"
        : role === "business"
        ? "Register your business on TEMPTX"
        : "Create a private client account"
      : `Sign in as a ${role}`;
    authSubmit.textContent = isSignup ? (isBusiness ? "Create business account" : "Create account") : "Continue";
    authSubmit.type = "submit";
    authSubmit.onclick = null;

    forgotEmailField.hidden = !isEmailAccount;
    forgotClientIdField.hidden = isEmailAccount;
    forgotDescription.textContent = isEmailAccount
      ? `Enter your ${role} email and the recovery key saved during signup.`
      : "Enter your client ID and the recovery key saved during signup.";
    document.querySelector("#forgotEmail").placeholder =
      role === "creator" ? "creator@example.com" : role === "business" ? "contact@yourbusiness.com.au" : "provider@example.com";
    authPrivacyNote.textContent = isProvider
      ? "Provider accounts are for physical escort services · 18+ only · Contact details stay protected"
      : role === "creator"
      ? "Creator accounts are for digital, media, and non-physical industry work · 18+ only"
      : isBusiness
      ? "Business accounts are reviewed before any profile goes live · 18+ only · Contact details stay protected"
      : isSignup
        ? "Your ID is generated automatically and assigned to this browser. IP is stored only as a protected security hash."
        : "Client access requires your assigned browser, generated ID, and password.";

    const nextParam = safeNext ? `&next=${encodeURIComponent(safeNext)}` : "";
    if (!lockedMode || !lockedRole) {
      history.replaceState(null, "", `auth.html?mode=${mode}&role=${role}${nextParam}`);
    }
    recoveryKeyCard.hidden = true;
    setStatus(authStatus);
  };

  document.querySelectorAll("button[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.authMode;
      authForm.reset();
      updateView();
    });
  });

  document.querySelectorAll("button[data-account-role]").forEach((button) => {
    button.addEventListener("click", () => {
      role = button.dataset.accountRole;
      authForm.reset();
      updateView();
    });
  });

  document.querySelectorAll("[data-password-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector(`#${button.dataset.passwordTarget}`);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Show" : "Hide";
    });
  });

  const readLogoFile = async (input) => {
    if (!input?.files?.[0]) return "";
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Unable to read the uploaded logo."));
      reader.readAsDataURL(input.files[0]);
    });
  };

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(authStatus, "Checking your details…");
    authSubmit.disabled = true;

    const payload = {
      role,
      password: authPassword.value,
      remember: document.querySelector("#rememberSession").checked,
      acceptedPolicies: mode === "signup" && acceptedPolicies.checked
    };
    if (role === "provider" || role === "creator" || role === "business") payload.email = authEmail.value;
    if ((role === "provider" || role === "creator") && mode === "signup") {
      payload.workingName = authWorkingName.value;
      payload.gender = authGender.value;
      payload.accountCategory = authAccountCategory.value;
    }
    if (role === "business" && mode === "signup") {
      payload.workingName = authWorkingName.value;
      payload.businessAbn = authBusinessAbn.value;
      payload.accountCategory = authAccountCategory.value;
      payload.website = authWebsite?.value || "";
      payload.businessPhone = authBusinessPhone?.value || "";
      payload.businessDescription = authBusinessDescription?.value || "";
      payload.services = authServices?.value || "";
      payload.businessLocation = authBusinessLocation?.value || "";
      payload.openingHours = authOpeningHours?.value || "";
      payload.priceRange = authPriceRange?.value || "";
      payload.logoDataUrl = await readLogoFile(authLogoInput);
    }
    if (role === "client" && mode === "login") payload.clientId = authClientId.value;

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || "Unable to continue.");

      if (mode === "signup") {
        recoveryKeyValue.textContent = result.recoveryCode;
        recoveryKeyCard.hidden = false;
        setStatus(
          authStatus,
          role === "client"
            ? `Account created. Your client ID is ${result.clientId}. Save your ID and recovery key somewhere private.`
            : role === "creator"
            ? "Creator account created. Save your recovery key somewhere private."
            : role === "business"
            ? "Your application is under review."
            : "Provider account created. Save your recovery key somewhere private.",
          "success"
        );
        authSubmit.textContent =
          role === "client"
            ? "Open messages"
            : role === "creator"
            ? "Open dashboard"
            : role === "business"
            ? "Return to TEMPTX"
            : "Open profile";
        authSubmit.type = "button";
        authSubmit.onclick = () => {
          window.location.href = safeNext || (role === "client" ? "chat.html" : role === "creator" ? "creator-dashboard.html" : role === "business" ? "index.html" : "profile.html");
        };
        return;
      }

      setStatus(authStatus, result.message, "success");
      window.setTimeout(() => {
        window.location.href = safeNext || (role === "client" ? "chat.html" : role === "creator" ? "creator-dashboard.html" : role === "business" ? "index.html" : "profile.html");
      }, 650);
    } catch (error) {
      setStatus(authStatus, error.message, "error");
    } finally {
      authSubmit.disabled = false;
    }
  });

  document.querySelector("#forgotPasswordButton").addEventListener("click", () => {
    forgotModal.hidden = false;
    document.body.classList.add("modal-open");
    resetForm.hidden = true;
    forgotForm.hidden = false;
    setStatus(recoveryStatus);
  });

  const closeRecovery = () => {
    forgotModal.hidden = true;
    document.body.classList.remove("modal-open");
    forgotForm.reset();
    resetForm.reset();
  };

  document.querySelector("#closeForgotModal").addEventListener("click", closeRecovery);
  forgotModal.addEventListener("click", (event) => {
    if (event.target === forgotModal) closeRecovery();
  });

  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(recoveryStatus, "Preparing recovery…");

    const payload = { role };
    if (role === "provider" || role === "creator" || role === "business") payload.email = document.querySelector("#forgotEmail").value;
    else payload.clientId = document.querySelector("#forgotClientId").value;
    payload.recoveryCode = document.querySelector("#forgotRecoveryCode").value;

    try {
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || "Recovery could not be started.");

      setStatus(recoveryStatus, result.message, "success");
      if (result.resetToken) {
        document.querySelector("#resetToken").value = result.resetToken;
        forgotForm.hidden = true;
        resetForm.hidden = false;
      }
    } catch (error) {
      setStatus(recoveryStatus, error.message, "error");
    }
  });

  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetToken: document.querySelector("#resetToken").value,
          password: document.querySelector("#resetPassword").value
        })
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || "Password could not be updated.");
      setStatus(recoveryStatus, result.message, "success");
      window.setTimeout(closeRecovery, 1200);
    } catch (error) {
      setStatus(recoveryStatus, error.message, "error");
    }
  });

  document.querySelector("#copyRecoveryKey").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(recoveryKeyValue.textContent);
      setStatus(authStatus, "Recovery key copied. Store it somewhere private.", "success");
    } catch {
      setStatus(authStatus, "Copy was unavailable. Select and save the recovery key manually.", "error");
    }
  });

  updateView();
}
