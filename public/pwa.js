(() => {
  const addLink = (rel, href, extras = {}) => {
    if (document.querySelector(`link[rel="${rel}"]`)) return;
    const link = document.createElement("link");
    link.rel = rel;
    link.href = href;
    Object.entries(extras).forEach(([key, value]) => {
      link[key] = value;
    });
    document.head.appendChild(link);
  };

  addLink("manifest", "/manifest.webmanifest");
  addLink("apple-touch-icon", "/assets/temptx-icon-192.png", { sizes: "192x192" });

  if (!document.querySelector('meta[name="theme-color"]')) {
    const theme = document.createElement("meta");
    theme.name = "theme-color";
    theme.content = "#15100d";
    document.head.appendChild(theme);
  }

  if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
    const capable = document.createElement("meta");
    capable.name = "apple-mobile-web-app-capable";
    capable.content = "yes";
    document.head.appendChild(capable);
  }

  if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
    const title = document.createElement("meta");
    title.name = "apple-mobile-web-app-title";
    title.content = "TEMPTX";
    document.head.appendChild(title);
  }

  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (standalone) return;

  const installButton = document.createElement("button");
  installButton.className = "pwa-install-button";
  installButton.type = "button";
  installButton.textContent = "Install App";
  installButton.hidden = true;
  document.body.appendChild(installButton);

  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
  });

  installButton.addEventListener("click", async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      installButton.hidden = true;
      return;
    }

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isiOS) {
      window.alert("In Safari, tap Share, then choose Add to Home Screen.");
    }
  });

  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    installButton.hidden = false;
  }
})();
