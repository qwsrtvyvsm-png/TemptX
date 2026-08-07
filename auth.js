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
  const phoneField = document.querySelector("#phoneField");
  const personalPhoneField = document.querySelector("#personalPhoneField");
  const personalPhoneNote = document.querySelector("#personalPhoneNote");
  const authWorkingName = document.querySelector("#authWorkingName");
  const clientIdField = document.querySelector("#clientIdField");
  const authEmail = document.querySelector("#authEmail");
  const authGender = document.querySelector("#authGender");
  const authAccountCategory = document.querySelector("#authAccountCategory");
  const authBusinessAbn = document.querySelector("#authBusinessAbn");
  const authBusinessPhone = document.querySelector("#authBusinessPhone");
  const authPersonalPhone = document.querySelector("#authPersonalPhone");
  const authClientId = document.querySelector("#authClientId");
  const authPassword = document.querySelector("#authPassword");
  const confirmPasswordField = document.querySelector("#confirmPasswordField");
  const authConfirmPassword = document.querySelector("#authConfirmPassword");
  const authSteps = document.querySelector("#authSteps");
  const authNextHint = document.querySelector("#authNextHint");
  const txSideTitle = document.querySelector("#tx-side-title");
  const txSideSubtitle = document.querySelector("#tx-side-subtitle");
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

  // Category options differ by worker role (content creators live only under
  // "creator"; escorts/fetisher/swingers live only under "provider"). Only the
  // shared auth.html page toggles role at runtime, so the rebuild below is
  // skipped on the dedicated per-role signup pages, which already ship the
  // correct static options for their locked role.
  const PROVIDER_CATEGORIES = [
    ["escorts", "Escorts"],
    ["fetisher", "Fetisher"],
    ["couples", "Couples"],
    ["swingers", "Swingers"],
    ["companions", "Companions"],
  ];
  const CREATOR_CATEGORIES = [
    ["couples", "Couples"],
    ["content creators", "Content creators"],
    ["online companions", "Online companions"],
  ];

  const applyCategoryOptions = (currentRole) => {
    if (lockedRole || !authAccountCategory) return;
    if (currentRole !== "provider" && currentRole !== "creator") return;

    const categories = currentRole === "provider" ? PROVIDER_CATEGORIES : CREATOR_CATEGORIES;
    const previousValue = authAccountCategory.value;
    authAccountCategory.innerHTML = [
      '<option value="">Choose a category</option>',
      ...categories.map(([value, label]) => `<option value="${value}">${label}</option>`),
    ].join("");
    if (categories.some(([value]) => value === previousValue)) {
      authAccountCategory.value = previousValue;
    }
  };

  const updateView = () => {
    document.querySelectorAll("button[data-auth-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.authMode === mode);
      // Only the "switch to the other mode" prompt should show — e.g. in signup
      // mode, show "Already a member? Sign in" and hide "New here? Sign up".
      button.hidden = button.dataset.authMode === mode;
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
    if (personalPhoneField) personalPhoneField.hidden = !isWorkerSignup;
    if (personalPhoneNote) personalPhoneNote.hidden = !isWorkerSignup;
    accountCategoryField.hidden = !(isWorkerSignup || isBusinessSignup);
    applyCategoryOptions(role);
    if (businessAbnField) businessAbnField.hidden = !isBusinessSignup;
    if (phoneField) phoneField.hidden = !isBusinessSignup;
    if (confirmPasswordField) confirmPasswordField.hidden = !isSignup;
    if (authSteps) authSteps.hidden = !isSignup;
    if (authNextHint) authNextHint.hidden = !isSignup;
    clientIdField.hidden = isEmailAccount || isSignup;
    authWorkingName.required = isWorkerSignup || isBusinessSignup;
    authEmail.required = isEmailAccount;
    if (authGender) authGender.required = isWorkerSignup;
    if (authPersonalPhone) authPersonalPhone.required = isWorkerSignup;
    if (authConfirmPassword) authConfirmPassword.required = isSignup;
    authAccountCategory.required = isWorkerSignup || isBusinessSignup;
    if (authBusinessAbn) authBusinessAbn.required = isBusinessSignup;
    if (authBusinessPhone) authBusinessPhone.required = isBusinessSignup;
    if (txSideTitle) {
      txSideTitle.textContent = isSignup ? "Create your TEMPTX account" : "Welcome back.";
    }
    if (txSideSubtitle) {
      txSideSubtitle.textContent = isSignup
        ? "Choose the option that best describes you to get started."
        : "Sign in with the account type you registered with.";
    }
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
      ? `Enter your ${role} email and the recovery key from Settings.`
      : "Enter your client ID and the recovery key from Settings.";
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

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (mode === "signup" && authConfirmPassword && authConfirmPassword.value !== authPassword.value) {
      setStatus(authStatus, "Passwords don't match.", "error");
      return;
    }

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
      payload.phone = authPersonalPhone?.value || "";
      payload.accountCategory = authAccountCategory.value;
    }
    if (role === "business" && mode === "signup") {
      payload.workingName = authWorkingName.value;
      payload.businessAbn = authBusinessAbn.value;
      payload.accountCategory = authAccountCategory.value;
      payload.businessPhone = authBusinessPhone?.value || "";
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
        if (role === "business") {
          window.location.href = "business-profile.html?welcome=1";
          return;
        }

        setStatus(
          authStatus,
          role === "client"
            ? `Account created. Your client ID is ${result.clientId}. Generate a recovery key in Settings.`
            : role === "creator"
            ? "Creator account created. Generate a recovery key in Settings."
            : role === "business"
            ? "Your application is under review. Generate a recovery key in Settings."
            : "Provider account created. Generate a recovery key in Settings.",
          "success"
        );
        authSubmit.textContent =
          role === "client"
            ? "Open messages"
            : role === "creator"
            ? "Open dashboard"
            : role === "business"
            ? "Open dashboard"
            : "Open profile";
        authSubmit.type = "button";
        authSubmit.onclick = () => {
          window.location.href = safeNext || (role === "client" ? "chat.html" : role === "creator" ? "creator-dashboard.html" : role === "business" ? "business-dashboard.html" : "profile.html");
        };
        return;
      }

      setStatus(authStatus, result.message, "success");
      window.setTimeout(() => {
        window.location.href = safeNext || (role === "client" ? "chat.html" : role === "creator" ? "creator-dashboard.html" : role === "business" ? "business-dashboard.html" : "profile.html");
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

  updateView();
}
