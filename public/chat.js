const chatShell = document.querySelector(".chat-shell");

if (chatShell) {
  const storageKey = "temptxChatState";
  const initialConversations = [
    {
      id: "advertiser",
      providerId: "advertiser",
      type: "direct",
      name: "Advertiser Name",
      initials: "AN",
      meta: "Online now · Sample provider",
      description: "Private direct conversation. Keep personal contact details inside TEMPTX.",
      unread: 2,
      joined: true,
      messages: [
        { sender: "them", text: "Hi, thanks for reaching out through TEMPTX.", time: "6:42 pm" },
        { sender: "them", text: "How can I help with your enquiry?", time: "6:43 pm" }
      ]
    },
    {
      id: "support",
      type: "direct",
      name: "TEMPTX Support",
      initials: "TS",
      meta: "Usually replies within an hour",
      description: "Ask about accounts, privacy, safety tools, listings, or using the platform.",
      unread: 0,
      joined: true,
      messages: [
        { sender: "them", text: "Welcome to TEMPTX support. What can we help with today?", time: "Yesterday" }
      ]
    },
    {
      id: "sydney-community",
      type: "group",
      name: "Sydney Community",
      initials: "SC",
      meta: "428 members · Moderated",
      description: "Local updates, community discussion, events, and recommendations for Sydney members.",
      unread: 5,
      joined: true,
      messages: [
        { sender: "other", name: "Mia", text: "Welcome to everyone who joined this week.", time: "5:18 pm" },
        { sender: "other", name: "TEMPTX Mod", text: "Reminder: protect personal information and report unwanted contact.", time: "5:26 pm" }
      ]
    },
    {
      id: "safety-circle",
      type: "group",
      name: "Safety Circle",
      initials: "SS",
      meta: "1,204 members · Moderated",
      description: "A moderated group for safety resources, platform guidance, and community support.",
      unread: 0,
      joined: true,
      messages: [
        { sender: "other", name: "TEMPTX Safety", text: "The updated privacy checklist is now available in the Hub.", time: "Monday" }
      ]
    }
  ];

  const discoverableGroups = [
    {
      id: "sydney-community",
      name: "Sydney Community",
      initials: "SC",
      members: 428,
      description: "Local updates, community discussion, events, and recommendations for Sydney members."
    },
    {
      id: "safety-circle",
      name: "Safety Circle",
      initials: "SS",
      members: 1204,
      description: "A moderated group for safety resources, platform guidance, and community support."
    },
    {
      id: "adelaide-network",
      name: "Adelaide Network",
      initials: "AD",
      members: 186,
      description: "Local news, events, touring updates, and community conversation."
    },
    {
      id: "industry-lounge",
      name: "Industry Lounge",
      initials: "IL",
      members: 892,
      description: "A professional peer space for providers and adult-industry businesses."
    },
    {
      id: "new-to-temptx",
      name: "New to TEMPTX",
      initials: "NT",
      members: 347,
      description: "Platform tips, introductions, account help, and friendly community guidance."
    },
    {
      id: "events-and-touring",
      name: "Events & Touring",
      initials: "ET",
      members: 633,
      description: "Share public events, touring notices, and city-specific community updates."
    }
  ];

  const loadState = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (stored?.conversations?.length) {
        return stored;
      }
    } catch (error) {
      console.warn("Unable to load saved chat state.", error);
    }

    return {
      conversations: initialConversations,
      activeId: "advertiser"
    };
  };

  let state = loadState();
  let activeFilter = "all";

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const conversationList = document.querySelector("#conversationList");
  const conversationSearch = document.querySelector("#conversationSearch");
  const conversationType = document.querySelector("#conversationType");
  const conversationName = document.querySelector("#conversationName");
  const conversationMeta = document.querySelector("#conversationMeta");
  const messageThread = document.querySelector("#messageThread");
  const messageForm = document.querySelector("#messageForm");
  const messageInput = document.querySelector("#messageInput");
  const tipButton = document.querySelector("#tipButton");
  const tipModal = document.querySelector("#tipModal");
  const tipForm = document.querySelector("#tipForm");
  const tipProviderName = document.querySelector("#tipProviderName");
  const customTipAmount = document.querySelector("#customTipAmount");
  const chatDetails = document.querySelector("#chatDetails");
  const detailsType = document.querySelector("#detailsType");
  const detailsName = document.querySelector("#detailsName");
  const detailsDescription = document.querySelector("#detailsDescription");
  const detailsAvatar = document.querySelector("#detailsAvatar");
  const detailsStatLabel = document.querySelector("#detailsStatLabel");
  const detailsStatValue = document.querySelector("#detailsStatValue");
  const leaveGroupButton = document.querySelector("#leaveGroupButton");
  const favouriteProviderButton = document.querySelector("#favouriteProviderButton");
  const reportConversationLink = document.querySelector("#reportConversationLink");
  const groupBrowser = document.querySelector("#groupBrowser");
  const groupDiscoveryGrid = document.querySelector("#groupDiscoveryGrid");
  const newGroupButton = document.querySelector("#newGroupButton");
  const newGroupModal = document.querySelector("#newGroupModal");
  const newGroupForm = document.querySelector("#newGroupForm");
  const messageStandardsGate = document.querySelector("#messageStandardsGate");
  const acceptMessageStandards = document.querySelector("#acceptMessageStandards");
  const sendButton = messageForm.querySelector('button[type="submit"]');
  sendButton.disabled = true;
  let canCreateGroups = false;
  let canFavouriteProviders = false;
  let canTipProviders = false;
  let currentUserId = "guest";
  let selectedTipAmount = 20;
  const favouritesStorageKey = "temptxFavouriteProviders";
  const messageAgreementKey = () => `temptxMessageStandardsAccepted:${currentUserId}`;

  const updateMessageAgreement = () => {
    const accepted = localStorage.getItem(messageAgreementKey()) === "true";
    sendButton.disabled = !accepted;
    messageStandardsGate.classList.toggle("hidden", accepted);
    document.body.classList.toggle("gate-open", !accepted);
  };

  const getFavouriteProviders = () => {
    try {
      return JSON.parse(localStorage.getItem(favouritesStorageKey)) || {};
    } catch {
      return {};
    }
  };

  const updateFavouriteButton = (conversation = getActiveConversation()) => {
    const providerId = conversation?.providerId || (conversation?.id === "advertiser" ? "advertiser" : null);
    const canShow = canFavouriteProviders && conversation?.type === "direct" && providerId;
    favouriteProviderButton.hidden = !canShow;

    if (!canShow) {
      return;
    }

    const isFavourite = Boolean(getFavouriteProviders()[providerId]);
    favouriteProviderButton.classList.toggle("is-favourite", isFavourite);
    favouriteProviderButton.textContent = isFavourite ? "Saved to Favourites" : "Save to Favourites";
    favouriteProviderButton.setAttribute("aria-pressed", String(isFavourite));
  };

  const updateTipButton = (conversation = getActiveConversation()) => {
    const providerId = conversation?.providerId || (conversation?.id === "advertiser" ? "advertiser" : null);
    tipButton.hidden = !(canTipProviders && conversation?.type === "direct" && providerId);
  };

  fetch("/api/auth/me")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Not signed in");
      }
      return response.json();
    })
    .then(({ user }) => {
      currentUserId = user?.id || "guest";
      canCreateGroups = user?.role === "provider";
      canFavouriteProviders = user?.role === "client";
      canTipProviders = user?.role === "client";
      newGroupButton.hidden = !canCreateGroups;
      updateMessageAgreement();
      updateFavouriteButton();
      updateTipButton();
    })
    .catch(() => {
      canCreateGroups = false;
      canFavouriteProviders = false;
      canTipProviders = false;
      newGroupButton.hidden = true;
      favouriteProviderButton.hidden = true;
      tipButton.hidden = true;
      updateMessageAgreement();
    });

  const saveState = () => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  };

  const getActiveConversation = () =>
    state.conversations.find((conversation) => conversation.id === state.activeId) ||
    state.conversations[0];

  const getLastMessage = (conversation) => {
    const message = conversation.messages[conversation.messages.length - 1];
    return message ? message.text : "No messages yet";
  };

  const formatCurrentTime = () =>
    new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date());

  const renderConversationList = () => {
    const query = conversationSearch.value.trim().toLowerCase();
    const filtered = state.conversations.filter((conversation) => {
      const matchesFilter = activeFilter === "all" || conversation.type === activeFilter;
      const matchesSearch = `${conversation.name} ${conversation.description}`
        .toLowerCase()
        .includes(query);
      return matchesFilter && matchesSearch;
    });

    conversationList.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "conversation-empty";
      empty.textContent = "No conversations found.";
      conversationList.append(empty);
      return;
    }

    filtered.forEach((conversation) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "conversation-item";
      button.classList.toggle("is-active", conversation.id === state.activeId);
      button.dataset.conversationId = conversation.id;
      button.innerHTML = `
        <span class="conversation-avatar">${conversation.initials}</span>
        <span class="conversation-summary">
          <span class="conversation-title-row">
            <strong>${escapeHtml(conversation.name)}</strong>
            <small>${conversation.type === "group" ? "Group" : "Direct"}</small>
          </span>
          <span class="conversation-preview">${escapeHtml(getLastMessage(conversation))}</span>
        </span>
        ${conversation.unread ? `<span class="unread-count">${conversation.unread}</span>` : ""}
      `;
      conversationList.append(button);
    });
  };

  const renderMessages = () => {
    const conversation = getActiveConversation();
    state.activeId = conversation.id;
    conversation.unread = 0;

    conversationType.textContent = conversation.type === "group" ? "Group chat" : "Direct message";
    conversationName.textContent = conversation.name;
    conversationMeta.textContent = conversation.meta;
    detailsType.textContent = conversation.type === "group" ? "Community group" : "Sample provider";
    detailsName.textContent = conversation.name;
    detailsDescription.textContent = conversation.description;
    detailsAvatar.textContent = conversation.initials;
    detailsStatLabel.textContent = conversation.type === "group" ? "Members" : "Privacy";
    detailsStatValue.textContent =
      conversation.type === "group" ? conversation.meta.split("·")[0].trim() : "In-site messaging";
    reportConversationLink.href = `report.html?type=conversation&ref=${encodeURIComponent(conversation.id)}`;
    leaveGroupButton.hidden = conversation.type !== "group";
    updateFavouriteButton(conversation);
    updateTipButton(conversation);

    messageThread.innerHTML = "";
    conversation.messages.forEach((message) => {
      const wrapper = document.createElement("div");
      wrapper.className = `message-row ${message.sender === "me" ? "is-mine" : ""}`;

      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      bubble.classList.toggle("is-tip", message.type === "tip");

      if (message.name) {
        const sender = document.createElement("strong");
        sender.className = "message-sender";
        sender.textContent = message.name;
        bubble.append(sender);
      }

      const text = document.createElement("p");
      text.textContent = message.text;
      bubble.append(text);

      const time = document.createElement("time");
      time.textContent = message.time;
      bubble.append(time);

      wrapper.append(bubble);
      messageThread.append(wrapper);
    });

    messageThread.scrollTop = messageThread.scrollHeight;
    saveState();
    renderConversationList();
  };

  const selectConversation = (id) => {
    state.activeId = id;
    renderMessages();
    chatShell.classList.remove("show-conversations");
  };

  const renderGroupDiscovery = () => {
    groupDiscoveryGrid.innerHTML = "";

    discoverableGroups.forEach((group) => {
      const existing = state.conversations.find((conversation) => conversation.id === group.id);
      const card = document.createElement("article");
      card.className = "group-discovery-card";
      card.innerHTML = `
        <span class="conversation-avatar">${group.initials}</span>
        <div>
          <h3>${group.name}</h3>
          <p>${group.description}</p>
          <small>${group.members.toLocaleString("en-AU")} members · Moderated</small>
        </div>
        <button type="button" data-join-group="${group.id}" ${existing ? "disabled" : ""}>
          ${existing ? "Joined" : "Join group"}
        </button>
      `;
      groupDiscoveryGrid.append(card);
    });
  };

  const openGroupBrowser = () => {
    renderGroupDiscovery();
    groupBrowser.hidden = false;
    document.body.classList.add("modal-open");
  };

  const closeModal = (modal) => {
    modal.hidden = true;
    if (groupBrowser.hidden && newGroupModal.hidden && tipModal.hidden) {
      document.body.classList.remove("modal-open");
    }
  };

  conversationList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-conversation-id]");
    if (item) {
      selectConversation(item.dataset.conversationId);
    }
  });

  conversationSearch.addEventListener("input", renderConversationList);

  document.querySelectorAll("[data-chat-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.chatFilter;
      document.querySelectorAll("[data-chat-filter]").forEach((tab) => {
        tab.classList.toggle("is-active", tab === button);
      });
      renderConversationList();
    });
  });

  messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (localStorage.getItem(messageAgreementKey()) !== "true") {
      messageStandardsGate.classList.remove("hidden");
      document.body.classList.add("gate-open");
      acceptMessageStandards.focus();
      return;
    }
    const text = messageInput.value.trim();
    if (!text) {
      return;
    }

    const conversation = getActiveConversation();
    conversation.messages.push({
      sender: "me",
      text,
      time: formatCurrentTime()
    });
    messageInput.value = "";
    renderMessages();
    messageInput.focus();
  });

  acceptMessageStandards.addEventListener("click", () => {
    localStorage.setItem(messageAgreementKey(), "true");
    updateMessageAgreement();
    messageInput.focus();
  });

  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      messageForm.requestSubmit();
    }
  });

  const openTipModal = () => {
    const conversation = getActiveConversation();
    if (!canTipProviders || conversation.type !== "direct") {
      return;
    }

    selectedTipAmount = 20;
    customTipAmount.value = "";
    tipProviderName.textContent = conversation.name;
    tipForm.querySelectorAll("[data-tip-amount]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.tipAmount === "20");
    });
    tipModal.hidden = false;
    tipModal.classList.add("is-open");
    document.body.classList.add("modal-open");
  };

  document.addEventListener("click", (event) => {
    if (event.target.closest("#tipButton")) {
      event.preventDefault();
      event.stopPropagation();
      openTipModal();
    }
  });

  tipForm.addEventListener("click", (event) => {
    const amountButton = event.target.closest("[data-tip-amount]");
    if (!amountButton) {
      return;
    }

    selectedTipAmount = Number(amountButton.dataset.tipAmount);
    customTipAmount.value = "";
    tipForm.querySelectorAll("[data-tip-amount]").forEach((button) => {
      button.classList.toggle("is-selected", button === amountButton);
    });
  });

  customTipAmount.addEventListener("input", () => {
    selectedTipAmount = Number(customTipAmount.value);
    tipForm.querySelectorAll("[data-tip-amount]").forEach((button) => {
      button.classList.remove("is-selected");
    });
  });

  tipForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const conversation = getActiveConversation();
    const amount = Math.min(1000, Math.max(1, Math.round(selectedTipAmount || 0)));

    if (!canTipProviders || conversation.type !== "direct" || !amount) {
      return;
    }

    conversation.messages.push({
      sender: "me",
      type: "tip",
      text: `Sent a $${amount} tip`,
      time: formatCurrentTime()
    });
    saveState();
    tipModal.classList.remove("is-open");
    closeModal(tipModal);
    renderMessages();
  });

  document.querySelector("#closeTipModal").addEventListener("click", () => {
    tipModal.classList.remove("is-open");
    closeModal(tipModal);
  });

  document.querySelector("#discoverGroupsButton").addEventListener("click", openGroupBrowser);
  document.querySelector("#closeGroupBrowser").addEventListener("click", () => closeModal(groupBrowser));
  newGroupButton.addEventListener("click", () => {
    if (!canCreateGroups) {
      return;
    }

    newGroupModal.hidden = false;
    document.body.classList.add("modal-open");
    document.querySelector("#newGroupName").focus();
  });

  favouriteProviderButton.addEventListener("click", () => {
    const conversation = getActiveConversation();
    const providerId = conversation.providerId || (conversation.id === "advertiser" ? "advertiser" : null);
    if (!canFavouriteProviders || !providerId) {
      return;
    }

    const favourites = getFavouriteProviders();
    if (favourites[providerId]) {
      delete favourites[providerId];
    } else {
      favourites[providerId] = {
        id: providerId,
        name: conversation.name
      };
    }

    localStorage.setItem(favouritesStorageKey, JSON.stringify(favourites));
    updateFavouriteButton(conversation);
  });
  document.querySelector("#closeNewGroup").addEventListener("click", () => closeModal(newGroupModal));

  groupDiscoveryGrid.addEventListener("click", (event) => {
    const joinButton = event.target.closest("[data-join-group]");
    if (!joinButton) {
      return;
    }

    const group = discoverableGroups.find((item) => item.id === joinButton.dataset.joinGroup);
    state.conversations.push({
      ...group,
      type: "group",
      meta: `${group.members + 1} members · Moderated`,
      unread: 0,
      joined: true,
      messages: [
        {
          sender: "other",
          name: "TEMPTX Mod",
          text: `Welcome to ${group.name}. Please review the group guidelines before posting.`,
          time: "Now"
        }
      ]
    });
    state.activeId = group.id;
    saveState();
    closeModal(groupBrowser);
    renderMessages();
  });

  newGroupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canCreateGroups) {
      closeModal(newGroupModal);
      return;
    }

    const name = document.querySelector("#newGroupName").value.trim();
    const description = document.querySelector("#newGroupDescription").value.trim();
    const id = `custom-${Date.now()}`;
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();

    state.conversations.push({
      id,
      type: "group",
      name,
      initials,
      meta: "1 member · You created this group",
      description,
      unread: 0,
      joined: true,
      messages: [
        {
          sender: "other",
          name: "TEMPTX",
          text: `You created ${name}. Invite trusted members and set the tone for the conversation.`,
          time: "Now"
        }
      ]
    });
    state.activeId = id;
    newGroupForm.reset();
    closeModal(newGroupModal);
    renderMessages();
  });

  const conversationInfoButton = document.querySelector("#conversationInfoButton");
  const detailsCloseButton = document.querySelector("#detailsCloseButton");

  const setDetailsOpen = (isOpen) => {
    chatShell.classList.toggle("show-details", isOpen);
    conversationInfoButton.setAttribute("aria-expanded", String(isOpen));
  };

  conversationInfoButton.addEventListener("click", () => {
    setDetailsOpen(!chatShell.classList.contains("show-details"));
  });
  detailsCloseButton.addEventListener("click", () => {
    setDetailsOpen(false);
  });
  document.addEventListener("click", (event) => {
    if (
      chatShell.classList.contains("show-details") &&
      !chatDetails.contains(event.target) &&
      !conversationInfoButton.contains(event.target)
    ) {
      setDetailsOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setDetailsOpen(false);
    }
  });
  leaveGroupButton.addEventListener("click", () => {
    const conversation = getActiveConversation();
    if (conversation.type !== "group") {
      return;
    }

    state.conversations = state.conversations.filter((item) => item.id !== conversation.id);
    state.activeId = state.conversations[0]?.id || "advertiser";
    setDetailsOpen(false);
    saveState();
    renderMessages();
  });
  document.querySelector("#mobileConversationsButton").addEventListener("click", () => {
    chatShell.classList.toggle("show-conversations");
  });

  [groupBrowser, newGroupModal, tipModal].forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.remove("is-open");
        closeModal(modal);
      }
    });
  });

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("conversation")) {
    state.activeId = urlParams.get("conversation");
  }

  renderConversationList();
  renderMessages();

  if (urlParams.get("view") === "groups") {
    openGroupBrowser();
  }
}
