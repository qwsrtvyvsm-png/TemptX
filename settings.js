const settingsForm = document.querySelector("#settingsForm");

if (settingsForm) {
  const fields = {
    displayName: document.querySelector("#displayName"),
    directMessages: document.querySelector("#directMessages"),
    groupInvites: document.querySelector("#groupInvites"),
    messagePreviews: document.querySelector("#messagePreviews"),
    activityStatus: document.querySelector("#activityStatus"),
    emailNotifications: document.querySelector("#emailNotifications"),
    profileVisible: document.querySelector("#profileVisible"),
    locations: [...document.querySelectorAll('[name="providerLocation"]')],
    services: [...document.querySelectorAll('[name="providerService"]')],
    attributes: [...document.querySelectorAll('[name="providerAttribute"]')]
  };

  const status = document.querySelector("#settingsStatus");
  const submitButton = settingsForm.querySelector('button[type="submit"]');
  const accountActionModal = document.querySelector("#accountActionModal");
  const accountActionForm = document.querySelector("#accountActionForm");
  const accountActionTitle = document.querySelector("#accountActionTitle");
  const accountActionDescription = document.querySelector("#accountActionDescription");
  const accountActionPassword = document.querySelector("#accountActionPassword");
  const deleteConfirmationField = document.querySelector("#deleteConfirmationField");
  const deleteConfirmation = document.querySelector("#deleteConfirmation");
  const accountActionStatus = document.querySelector("#accountActionStatus");
  const accountActionSubmit = document.querySelector("#accountActionSubmit");
  let currentUser = null;
  let accountAction = "deactivate";

  const setStatus = (message = "", type = "") => {
    status.textContent = message;
    status.className = type ? `is-${type}` : "";
  };

  const setCheckedValues = (checkboxes, values = []) => {
    checkboxes.forEach((checkbox) => {
      checkbox.checked = values.includes(checkbox.value);
    });
  };

  const getCheckedValues = (checkboxes) =>
    checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);

  const populateSettings = (user) => {
    currentUser = user;
    const settings = user.settings;
    const isProvider = user.role === "provider";
    const isCreator = user.role === "creator";
    const accountName =
      settings.displayName || (isProvider ? "TEMPTX provider" : isCreator ? "TEMPTX creator" : "TEMPTX client");
    const identifier = isProvider || isCreator ? user.email : user.clientId;

    document.querySelector("#settingsAccountName").textContent = accountName;
    document.querySelector("#settingsAccountMeta").textContent =
      isProvider ? "Provider account" : isCreator ? "Creator account" : "Private client account";
    document.querySelector("#settingsAvatar").textContent = accountName
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
    document.querySelector("#accountIdentifierLabel").textContent =
      isProvider ? "Provider email" : isCreator ? "Creator email" : "TEMPTX client ID";
    document.querySelector("#accountIdentifier").textContent = identifier;
    document.querySelector("#profileVisibleRow").hidden = !isProvider;
    document.querySelector("#providerDirectorySettings").hidden = !isProvider;

    fields.displayName.value = settings.displayName;
    fields.directMessages.checked = settings.directMessages;
    fields.groupInvites.checked = settings.groupInvites;
    fields.messagePreviews.checked = settings.messagePreviews;
    fields.activityStatus.checked = settings.activityStatus;
    fields.emailNotifications.checked = settings.emailNotifications;
    fields.profileVisible.checked = settings.profileVisible;
    setCheckedValues(fields.locations, settings.locations);
    setCheckedValues(fields.services, settings.services);
    setCheckedValues(fields.attributes, settings.attributes);
  };

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        window.location.href = "auth.html";
        return;
      }
      const result = await response.json();
      populateSettings(result.user);
    } catch {
      setStatus("Unable to load your settings.", "error");
    }
  };

  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    setStatus("Saving…");

    try {
      const response = await fetch("/api/auth/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: fields.displayName.value,
          directMessages: fields.directMessages.checked,
          groupInvites: fields.groupInvites.checked,
          messagePreviews: fields.messagePreviews.checked,
          activityStatus: fields.activityStatus.checked,
          emailNotifications: fields.emailNotifications.checked,
          profileVisible: fields.profileVisible.checked,
          locations: getCheckedValues(fields.locations),
          services: getCheckedValues(fields.services),
          attributes: getCheckedValues(fields.attributes)
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Settings could not be saved.");
      populateSettings(result.user);
      setStatus(result.message, "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  const closeAccountAction = () => {
    accountActionModal.hidden = true;
    document.body.classList.remove("modal-open");
    accountActionForm.reset();
    accountActionStatus.textContent = "";
  };

  document.querySelectorAll("[data-account-action]").forEach((button) => {
    button.addEventListener("click", () => {
      accountAction = button.dataset.accountAction;
      const deleting = accountAction === "delete";
      accountActionTitle.textContent = deleting ? "Delete account permanently?" : "Deactivate account?";
      accountActionDescription.textContent = deleting
        ? "This permanently removes the account. Enter your password and type DELETE to continue."
        : "Your account will be disabled and you will be signed out. Logging in again reactivates it.";
      deleteConfirmationField.hidden = !deleting;
      deleteConfirmation.required = deleting;
      accountActionSubmit.textContent = deleting ? "Delete permanently" : "Deactivate account";
      accountActionSubmit.classList.toggle("is-destructive", deleting);
      accountActionModal.hidden = false;
      document.body.classList.add("modal-open");
      accountActionPassword.focus();
    });
  });

  document.querySelector("#closeAccountAction").addEventListener("click", closeAccountAction);
  accountActionModal.addEventListener("click", (event) => {
    if (event.target === accountActionModal) closeAccountAction();
  });

  accountActionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    accountActionSubmit.disabled = true;
    accountActionStatus.textContent = "Confirming…";

    try {
      const deleting = accountAction === "delete";
      const response = await fetch(`/api/auth/${accountAction}`, {
        method: deleting ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: accountActionPassword.value,
          confirmation: deleteConfirmation.value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Account action failed.");
      accountActionStatus.textContent = result.message;
      accountActionStatus.className = "account-action-status is-success";
      window.setTimeout(() => {
        window.location.href = deleting ? "index.html" : "auth.html";
      }, 900);
    } catch (error) {
      accountActionStatus.textContent = error.message;
      accountActionStatus.className = "account-action-status is-error";
    } finally {
      accountActionSubmit.disabled = false;
    }
  });

  loadSettings();
}
