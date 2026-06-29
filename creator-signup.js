const creatorSignupForm = document.querySelector("#creatorSignupForm");

if (creatorSignupForm) {
  const status = document.querySelector("#creatorSignupStatus");
  const submitButton = document.querySelector("#creatorSignupSubmit");
  const recoveryKeyCard = document.querySelector("#creatorRecoveryKeyCard");
  const recoveryKeyValue = document.querySelector("#creatorRecoveryKeyValue");

  const setStatus = (message = "", type = "") => {
    status.textContent = message;
    status.className = `auth-status${type ? ` is-${type}` : ""}`;
  };

  const readApiResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        "Account signup needs the TEMPTX backend. Run npm start, then open http://127.0.0.1:5510/creator-signup.html."
      );
    }

    return response.json();
  };

  document.querySelectorAll("[data-password-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector(`#${button.dataset.passwordTarget}`);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Show" : "Hide";
    });
  });

  creatorSignupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Creating your creator account...");
    submitButton.disabled = true;

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "creator",
          email: document.querySelector("#creatorEmail").value,
          password: document.querySelector("#creatorPassword").value,
          acceptedPolicies: document.querySelector("#creatorAcceptedPolicies").checked
        })
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || "Unable to create creator account.");

      recoveryKeyValue.textContent = result.recoveryCode;
      recoveryKeyCard.hidden = false;
      creatorSignupForm.reset();
      setStatus("Creator account created. Save your recovery key somewhere private.", "success");
      submitButton.textContent = "Open dashboard";
      submitButton.type = "button";
      submitButton.onclick = () => {
        window.location.href = "creator-dashboard.html";
      };
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  document.querySelector("#creatorCopyRecoveryKey").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(recoveryKeyValue.textContent);
      setStatus("Recovery key copied. Store it somewhere private.", "success");
    } catch {
      setStatus("Copy was unavailable. Select and save the recovery key manually.", "error");
    }
  });
}
