(() => {
  const BOARD_META = Object.fromEntries(COMMUNITY_BOARDS.map((board) => [board.key, board]));
  const DEFAULT_BOARD = "discussions";
  const VALID_SORTS = ["new", "trending", "most-answered", "following"];
  const TRENDING_BOARDS = COMMUNITY_BOARDS.filter((board) => !board.staffOnly).map((board) => board.key);
  const KIND_LABELS = {
    idea: "Idea",
    feature: "Feature request",
    resource: "Resource suggestion",
    issue: "Community issue",
    general: "General feedback"
  };
  const BADGE_DESCRIPTIONS = {
    "Helpful Member": "3+ contributions to the community.",
    "Community Contributor": "10+ contributions to the community.",
    "Trusted Contributor": "25+ contributions to the community."
  };

  // ── DOM refs ─────────────────────────────────────────────────────────
  const boardTabs = document.querySelector("#boardTabs");
  const boardView = document.querySelector("#boardView");
  const threadView = document.querySelector("#threadView");
  const threadList = document.querySelector("#threadList");
  const threadListStatus = document.querySelector("#threadListStatus");
  const threadDetail = document.querySelector("#threadDetail");
  const replyList = document.querySelector("#replyList");
  const backToBoard = document.querySelector("#backToBoard");
  const sortTabs = document.querySelector("#sortTabs");

  const threadForm = document.querySelector("#threadForm");
  const threadTitleInput = document.querySelector("#threadTitle");
  const threadBodyInput = document.querySelector("#threadBody");
  const threadTagsInput = document.querySelector("#threadTags");
  const threadAnonymousInput = document.querySelector("#threadAnonymous");
  const threadFormStatus = document.querySelector("#threadFormStatus");
  const composeSigninPrompt = document.querySelector("#composeSigninPrompt");
  const composeBoardLabel = document.querySelector("#composeBoardLabel");
  const composeStaffOnlyNote = document.querySelector("#composeStaffOnlyNote");

  const replyForm = document.querySelector("#replyForm");
  const replyBodyInput = document.querySelector("#replyBody");
  const replyAnonymousInput = document.querySelector("#replyAnonymous");
  const replyFormStatus = document.querySelector("#replyFormStatus");
  const replySigninPrompt = document.querySelector("#replySigninPrompt");

  const communityHeroStats = document.querySelector("#communityHeroStats");
  const intentGrid = document.querySelector("#intentGrid");
  const communitySearchForm = document.querySelector("#communitySearchForm");
  const communitySearchInput = document.querySelector("#communitySearchInput");
  const popularSearches = document.querySelector("#popularSearches");
  const searchResults = document.querySelector("#searchResults");
  const searchResultsSummary = document.querySelector("#searchResultsSummary");
  const searchResultsList = document.querySelector("#searchResultsList");
  const clearSearch = document.querySelector("#clearSearch");
  const browseGrid = document.querySelector("#browseGrid");
  const trendingStatus = document.querySelector("#trendingStatus");
  const trendingList = document.querySelector("#trendingList");
  const featuredResources = document.querySelector("#featuredResources");
  const resourceDirectory = document.querySelector("#resourceDirectory");
  const supportCategories = document.querySelector("#supportCategories");
  const pathwayList = document.querySelector("#pathwayList");
  const topicsGrid = document.querySelector("#topicsGrid");
  const groupsStatus = document.querySelector("#groupsStatus");
  const groupsGrid = document.querySelector("#groupsGrid");
  const eventsGrid = document.querySelector("#eventsGrid");
  const contributeGrid = document.querySelector("#contributeGrid");

  const feedbackForm = document.querySelector("#feedbackForm");
  const feedbackKind = document.querySelector("#feedbackKind");
  const feedbackTitle = document.querySelector("#feedbackTitle");
  const feedbackDetails = document.querySelector("#feedbackDetails");
  const feedbackAnonymous = document.querySelector("#feedbackAnonymous");
  const feedbackFormStatus = document.querySelector("#feedbackFormStatus");
  const feedbackSigninPrompt = document.querySelector("#feedbackSigninPrompt");
  const feedbackListStatus = document.querySelector("#feedbackListStatus");
  const feedbackList = document.querySelector("#feedbackList");

  const yoursSignedOut = document.querySelector("#yoursSignedOut");
  const savedStatus = document.querySelector("#savedStatus");
  const savedList = document.querySelector("#savedList");
  const followingStatus = document.querySelector("#followingStatus");
  const followingList = document.querySelector("#followingList");
  const yourGroupsStatus = document.querySelector("#yourGroupsStatus");
  const yourGroupsList = document.querySelector("#yourGroupsList");
  const contributionsStatus = document.querySelector("#contributionsStatus");
  const contributionsBadges = document.querySelector("#contributionsBadges");
  const contributionsList = document.querySelector("#contributionsList");

  // ── State ────────────────────────────────────────────────────────────
  let isSignedIn = false;
  let myFollows = [];
  let mySaved = [];
  let followSet = new Set();
  let savedSet = new Set();
  let groupsCache = [];

  // ── URL helpers ──────────────────────────────────────────────────────
  const getParams = () => new URLSearchParams(window.location.search);
  const currentBoard = () => {
    const board = getParams().get("board");
    return BOARD_META[board] ? board : DEFAULT_BOARD;
  };
  const currentThreadId = () => getParams().get("thread") || null;
  const currentSort = () => {
    const sort = getParams().get("sort");
    return VALID_SORTS.includes(sort) ? sort : "new";
  };

  // ── Small render helpers ────────────────────────────────────────────
  const setStatus = (element, message, type) => {
    if (!element) return;
    element.textContent = message || "";
    element.className = `report-status${type ? ` is-${type}` : ""}`;
  };

  const setListStatus = (element, message, type) => {
    if (!element) return;
    element.textContent = message || "";
    element.className = `community-list-status${type ? ` is-${type}` : ""}`;
  };

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return iso;
    }
  };

  const reportLink = (id) => {
    const link = document.createElement("a");
    link.className = "community-report-link";
    link.href = `report.html?type=community&ref=${encodeURIComponent(id)}`;
    link.textContent = "Report";
    return link;
  };

  const renderEmptyState = (container, message, cta) => {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = "community-empty-message";
    p.textContent = message;
    container.appendChild(p);
    if (cta) {
      const a = document.createElement("a");
      a.className = "community-btn community-btn-outline community-btn-small";
      a.href = cta.href;
      a.textContent = cta.label;
      container.appendChild(a);
    }
  };

  const keyOf = (targetType, targetId) => `${targetType}:${targetId}`;

  // ── Save / Follow toggles (shared by thread cards + detail view) ───
  const setFollow = (targetType, targetId, follow) => {
    const request = follow
      ? fetch("/api/community/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetId })
        })
      : fetch(`/api/community/follows/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`, { method: "DELETE" });

    return request
      .then((response) => {
        if (!response.ok) throw new Error();
        if (follow) followSet.add(keyOf(targetType, targetId));
        else followSet.delete(keyOf(targetType, targetId));
        return true;
      })
      .catch(() => false);
  };

  const setSaved = (targetType, targetId, save) => {
    const request = save
      ? fetch("/api/community/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetId })
        })
      : fetch(`/api/community/saved/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`, { method: "DELETE" });

    return request
      .then((response) => {
        if (!response.ok) throw new Error();
        if (save) savedSet.add(keyOf(targetType, targetId));
        else savedSet.delete(keyOf(targetType, targetId));
        return true;
      })
      .catch(() => false);
  };

  const buildToggleButton = (targetType, targetId, kind) => {
    const isFollow = kind === "follow";
    const set = isFollow ? followSet : savedSet;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "community-toggle-btn";

    const render = () => {
      const active = set.has(keyOf(targetType, targetId));
      btn.textContent = active ? (isFollow ? "Following" : "Saved") : isFollow ? "+ Follow" : "+ Save";
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    };
    render();

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const active = set.has(keyOf(targetType, targetId));
      const ok = isFollow ? await setFollow(targetType, targetId, !active) : await setSaved(targetType, targetId, !active);
      if (ok) render();
      btn.disabled = false;
    });

    return btn;
  };

  const buildSaveButton = (targetType, targetId) => buildToggleButton(targetType, targetId, "save");
  const buildFollowButton = (targetType, targetId) => buildToggleButton(targetType, targetId, "follow");

  // ── Auth-dependent visibility ────────────────────────────────────────
  const applyAuthGating = () => {
    const staffOnly = Boolean(BOARD_META[currentBoard()]?.staffOnly);
    if (threadForm) threadForm.hidden = !isSignedIn || staffOnly;
    if (composeSigninPrompt) composeSigninPrompt.hidden = isSignedIn || staffOnly;
    if (composeStaffOnlyNote) composeStaffOnlyNote.hidden = !staffOnly;
    if (replyForm) replyForm.hidden = !isSignedIn;
    if (replySigninPrompt) replySigninPrompt.hidden = isSignedIn;
    if (feedbackSigninPrompt) feedbackSigninPrompt.hidden = isSignedIn;
    if (yoursSignedOut) yoursSignedOut.hidden = isSignedIn;
  };

  const applyComposeDefaults = () => {
    const board = currentBoard();
    if (composeBoardLabel) composeBoardLabel.textContent = `Posting in: ${BOARD_META[board]?.label || board}`;
    const requestedType = getParams().get("compose");
    const preferQuestion = requestedType === "question" || board === "qna";
    threadForm?.querySelectorAll('input[name="threadType"]').forEach((radio) => {
      radio.checked = radio.value === (preferQuestion ? "question" : "discussion");
    });
  };

  // ── Thread + reply cards ─────────────────────────────────────────────
  const buildThreadCard = (thread, options = {}) => {
    const card = document.createElement("article");
    card.className = `community-thread-card${options.compact ? " community-thread-card--compact" : ""}`;

    const link = document.createElement("a");
    link.className = "community-thread-card-link";
    const board = options.showBoard ? thread.board : currentBoard();
    link.href = `community.html?board=${encodeURIComponent(board)}&thread=${encodeURIComponent(thread.id)}`;

    const badgeRow = document.createElement("div");
    badgeRow.className = "community-thread-badges";
    if (options.showBoard && BOARD_META[thread.board]) {
      const boardBadge = document.createElement("span");
      boardBadge.className = "community-badge-pill";
      boardBadge.textContent = BOARD_META[thread.board].label;
      badgeRow.appendChild(boardBadge);
    }
    if ((thread.type || "discussion") === "question") {
      const qBadge = document.createElement("span");
      qBadge.className = `community-badge-pill community-badge-pill--question${thread.solved ? " is-solved" : ""}`;
      qBadge.textContent = thread.solved ? "Solved" : "Question";
      badgeRow.appendChild(qBadge);
    }
    if (badgeRow.childNodes.length) link.appendChild(badgeRow);

    const title = document.createElement("h3");
    title.textContent = thread.title;

    const meta = document.createElement("p");
    meta.className = "community-thread-meta";
    const author = document.createElement("span");
    author.className = "community-thread-author";
    author.textContent = thread.authorDisplayName;
    const time = document.createElement("span");
    time.className = "community-thread-time";
    time.textContent = formatTime(thread.createdAt);
    meta.append(author, document.createTextNode(" · "), time);

    const stats = document.createElement("span");
    stats.className = "community-thread-stats";
    const replyLabel = thread.replyCount === 1 ? "1 reply" : `${thread.replyCount} replies`;
    stats.textContent = options.compact ? replyLabel : `${replyLabel} · ${thread.views || 0} views`;

    link.append(title, meta, stats);
    card.appendChild(link);

    if (thread.tags && thread.tags.length) {
      const tagRow = document.createElement("div");
      tagRow.className = "community-tag-row";
      thread.tags.forEach((tag) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "community-tag-chip";
        btn.textContent = `#${tag}`;
        btn.addEventListener("click", () => runSearch(tag));
        tagRow.appendChild(btn);
      });
      card.appendChild(tagRow);
    }

    if (isSignedIn) {
      const actions = document.createElement("div");
      actions.className = "community-thread-card-actions";
      actions.appendChild(buildSaveButton("thread", thread.id));
      actions.appendChild(buildFollowButton("thread", thread.id));
      card.appendChild(actions);
    }

    return card;
  };

  const buildReplyRow = (reply, thread) => {
    const row = document.createElement("article");
    row.className = `community-reply${reply.isAccepted ? " is-accepted" : ""}`;

    if (reply.isAccepted) {
      const badge = document.createElement("p");
      badge.className = "community-accepted-badge";
      badge.textContent = "✓ Best answer";
      row.appendChild(badge);
    }

    const meta = document.createElement("p");
    meta.className = "community-thread-meta";
    const author = document.createElement("span");
    author.className = "community-thread-author";
    author.textContent = reply.authorDisplayName;
    const time = document.createElement("span");
    time.className = "community-thread-time";
    time.textContent = formatTime(reply.createdAt);
    meta.append(author, document.createTextNode(" · "), time);

    const body = document.createElement("p");
    body.className = "community-reply-body";
    body.textContent = reply.body;

    row.append(meta, body);

    const actions = document.createElement("div");
    actions.className = "community-reply-actions";
    actions.appendChild(reportLink(reply.id));

    if (thread.canAccept && !reply.isAccepted) {
      const acceptBtn = document.createElement("button");
      acceptBtn.type = "button";
      acceptBtn.className = "community-link-btn";
      acceptBtn.textContent = "Mark as best answer";
      const inlineStatus = document.createElement("span");
      inlineStatus.className = "community-inline-status";
      acceptBtn.addEventListener("click", () => {
        acceptBtn.disabled = true;
        inlineStatus.textContent = "Saving…";
        fetch(`/api/community/threads/${encodeURIComponent(thread.id)}/replies/${encodeURIComponent(reply.id)}/accept`, {
          method: "POST"
        })
          .then(async (response) => {
            if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not mark best answer.");
            loadThread(thread.id);
          })
          .catch((error) => {
            inlineStatus.textContent = error.message;
            acceptBtn.disabled = false;
          });
      });
      actions.append(acceptBtn, inlineStatus);
    }

    row.appendChild(actions);
    return row;
  };

  // ── Board list / thread detail (SPA-like, URL-driven) ───────────────
  const loadThreadList = () => {
    const board = currentBoard();
    const sort = currentSort();
    threadList.innerHTML = "";
    setListStatus(threadListStatus, "Loading threads…");

    const requestSort = sort === "following" ? "new" : sort;

    fetch(`/api/community/boards/${encodeURIComponent(board)}/threads?sort=${encodeURIComponent(requestSort)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not load threads.");
        return response.json();
      })
      .then(({ threads }) => {
        let list = threads;
        if (sort === "following") {
          list = threads.filter((thread) => followSet.has(keyOf("thread", thread.id)));
        }

        if (!list.length) {
          setListStatus(threadListStatus, "");
          if (sort === "following") {
            renderEmptyState(
              threadList,
              isSignedIn ? "You're not following any discussions in this board yet." : "Sign in to follow discussions.",
              null
            );
          } else if (BOARD_META[board]?.staffOnly) {
            renderEmptyState(threadList, "No announcements yet — check back soon.", null);
          } else {
            renderEmptyState(threadList, "Nothing here yet. Be the first to start the conversation.", {
              href: "#compose",
              label: "Start a Discussion"
            });
          }
          return;
        }
        setListStatus(threadListStatus, "");
        list.forEach((thread) => threadList.appendChild(buildThreadCard(thread)));
      })
      .catch((error) => setListStatus(threadListStatus, error.message, "error"));
  };

  const renderThread = (thread, replies) => {
    threadDetail.innerHTML = "";

    const badgeRow = document.createElement("div");
    badgeRow.className = "community-thread-badges";
    if ((thread.type || "discussion") === "question") {
      const qBadge = document.createElement("span");
      qBadge.className = `community-badge-pill community-badge-pill--question${thread.solved ? " is-solved" : ""}`;
      qBadge.textContent = thread.solved ? "Solved" : "Question";
      badgeRow.appendChild(qBadge);
    }

    const title = document.createElement("h2");
    title.textContent = thread.title;

    const meta = document.createElement("p");
    meta.className = "community-thread-meta";
    const author = document.createElement("span");
    author.className = "community-thread-author";
    author.textContent = thread.authorDisplayName;
    const time = document.createElement("span");
    time.className = "community-thread-time";
    time.textContent = formatTime(thread.createdAt);
    meta.append(author, document.createTextNode(" · "), time, document.createTextNode(` · ${thread.views || 0} views`));

    const body = document.createElement("p");
    body.className = "community-thread-body";
    body.textContent = thread.body;

    if (badgeRow.childNodes.length) threadDetail.appendChild(badgeRow);
    threadDetail.append(title, meta, body);

    if (thread.tags && thread.tags.length) {
      const tagRow = document.createElement("div");
      tagRow.className = "community-tag-row";
      thread.tags.forEach((tag) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "community-tag-chip";
        btn.textContent = `#${tag}`;
        btn.addEventListener("click", () => runSearch(tag));
        tagRow.appendChild(btn);
      });
      threadDetail.appendChild(tagRow);
    }

    const actions = document.createElement("div");
    actions.className = "community-thread-detail-actions";
    actions.appendChild(reportLink(thread.id));
    if (isSignedIn) {
      actions.appendChild(buildSaveButton("thread", thread.id));
      actions.appendChild(buildFollowButton("thread", thread.id));
    }
    threadDetail.appendChild(actions);

    replyList.innerHTML = "";
    if (!replies.length) {
      renderEmptyState(replyList, "No replies yet.", null);
    } else {
      const sorted = [...replies].sort(
        (a, b) => (b.isAccepted ? 1 : 0) - (a.isAccepted ? 1 : 0) || a.createdAt.localeCompare(b.createdAt)
      );
      sorted.forEach((reply) => replyList.appendChild(buildReplyRow(reply, thread)));
    }
  };

  const loadThread = (threadId) => {
    threadDetail.innerHTML = "";
    replyList.innerHTML = "";

    fetch(`/api/community/threads/${encodeURIComponent(threadId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Thread not found.");
        return response.json();
      })
      .then(({ thread, replies }) => renderThread(thread, replies))
      .catch((error) => {
        const message = document.createElement("p");
        message.className = "community-list-status";
        message.textContent = error.message;
        threadDetail.appendChild(message);
      });
  };

  const updateSortTabs = () => {
    const sort = currentSort();
    sortTabs?.querySelectorAll("[data-sort]").forEach((btn) => {
      const active = btn.dataset.sort === sort;
      btn.setAttribute("aria-pressed", String(active));
      btn.classList.toggle("is-active", active);
    });
  };

  const renderView = () => {
    const board = currentBoard();
    const threadId = currentThreadId();

    boardTabs?.querySelectorAll("[data-board]").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.board === board && !threadId);
    });
    updateSortTabs();
    applyAuthGating();
    applyComposeDefaults();

    if (backToBoard) backToBoard.href = `community.html?board=${encodeURIComponent(board)}`;

    if (threadId) {
      boardView.hidden = true;
      threadView.hidden = false;
      loadThread(threadId);
    } else {
      threadView.hidden = true;
      boardView.hidden = false;
      loadThreadList();
    }
  };

  // ── Board tabs + sort tabs ───────────────────────────────────────────
  const renderBoardTabs = () => {
    boardTabs.innerHTML = "";
    COMMUNITY_BOARDS.forEach((board) => {
      const a = document.createElement("a");
      a.href = `community.html?board=${encodeURIComponent(board.key)}`;
      a.dataset.board = board.key;
      a.textContent = board.label;
      a.addEventListener("click", (event) => {
        event.preventDefault();
        history.pushState(null, "", `community.html?board=${encodeURIComponent(board.key)}`);
        renderView();
      });
      boardTabs.appendChild(a);
    });
  };

  sortTabs?.querySelectorAll("[data-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.hidden) return;
      const sort = btn.dataset.sort;
      const params = getParams();
      params.set("board", currentBoard());
      if (sort === "new") params.delete("sort");
      else params.set("sort", sort);
      history.pushState(null, "", `community.html?${params.toString()}`);
      renderView();
    });
  });

  threadList?.addEventListener("click", (event) => {
    const link = event.target.closest(".community-thread-card-link");
    if (!link) return;
    event.preventDefault();
    history.pushState(null, "", link.getAttribute("href"));
    renderView();
  });

  backToBoard?.addEventListener("click", (event) => {
    event.preventDefault();
    history.pushState(null, "", backToBoard.href);
    renderView();
  });

  window.addEventListener("popstate", renderView);

  // ── Compose / reply forms ────────────────────────────────────────────
  threadForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitButton = threadForm.querySelector("button");
    submitButton.disabled = true;
    setStatus(threadFormStatus, "Posting…");

    const type = threadForm.querySelector('input[name="threadType"]:checked')?.value || "discussion";

    fetch("/api/community/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board: currentBoard(),
        title: threadTitleInput.value,
        body: threadBodyInput.value,
        anonymous: threadAnonymousInput.checked,
        type,
        tags: threadTagsInput.value
      })
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not post thread.");
        return result;
      })
      .then(({ thread }) => {
        threadForm.reset();
        setStatus(threadFormStatus, "");
        history.pushState(null, "", `community.html?board=${encodeURIComponent(currentBoard())}&thread=${encodeURIComponent(thread.id)}`);
        renderView();
      })
      .catch((error) => setStatus(threadFormStatus, error.message, "error"))
      .finally(() => {
        submitButton.disabled = false;
      });
  });

  replyForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const threadId = currentThreadId();
    if (!threadId) return;
    const submitButton = replyForm.querySelector("button");
    submitButton.disabled = true;
    setStatus(replyFormStatus, "Posting…");

    fetch(`/api/community/threads/${encodeURIComponent(threadId)}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: replyBodyInput.value,
        anonymous: replyAnonymousInput.checked
      })
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not post reply.");
        return result;
      })
      .then(() => {
        replyForm.reset();
        setStatus(replyFormStatus, "");
        loadThread(threadId);
      })
      .catch((error) => setStatus(replyFormStatus, error.message, "error"))
      .finally(() => {
        submitButton.disabled = false;
      });
  });

  // ── Hero + intent grid + browse chips ────────────────────────────────
  const renderIntentGrid = () => {
    intentGrid.innerHTML = "";
    COMMUNITY_INTENT_GRID.forEach((item) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = item.href;
      const num = document.createElement("span");
      num.className = "community-intent-num";
      num.textContent = item.n;
      const bodyWrap = document.createElement("span");
      bodyWrap.className = "community-intent-body";
      const label = document.createElement("strong");
      label.textContent = item.label;
      const desc = document.createElement("span");
      desc.className = "community-intent-desc";
      desc.textContent = item.description;
      bodyWrap.append(label, desc);
      a.append(num, bodyWrap);
      li.appendChild(a);
      intentGrid.appendChild(li);
    });
  };

  const renderBrowseGrid = () => {
    browseGrid.innerHTML = "";
    COMMUNITY_BOARDS.forEach((board) => {
      const a = document.createElement("a");
      a.className = "community-browse-chip";
      a.href = `community.html?board=${encodeURIComponent(board.key)}#discussions`;
      a.textContent = board.label;
      browseGrid.appendChild(a);
    });
    [
      { label: "Groups", href: "#groups" },
      { label: "Events", href: "#events" },
      { label: "Members", href: "directory.html" }
    ].forEach((extra) => {
      const a = document.createElement("a");
      a.className = "community-browse-chip";
      a.href = extra.href;
      a.textContent = extra.label;
      browseGrid.appendChild(a);
    });
  };

  // ── Search ───────────────────────────────────────────────────────────
  const buildSearchGroupHeading = (label) => {
    const h = document.createElement("p");
    h.className = "community-search-group-heading";
    h.textContent = label;
    return h;
  };

  const buildResourceCard = (resource) => {
    const card = document.createElement("article");
    card.className = "community-resource-card";
    const category = document.createElement("p");
    category.className = "community-resource-category";
    category.textContent = resource.category || "Resource";
    const title = document.createElement("h3");
    const link = document.createElement("a");
    link.href = resource.href;
    link.textContent = resource.title;
    title.appendChild(link);
    const desc = document.createElement("p");
    desc.className = "community-resource-desc";
    desc.textContent = resource.description;
    const meta = document.createElement("div");
    meta.className = "community-resource-meta";
    if (resource.updated) {
      const updated = document.createElement("span");
      updated.textContent = `Updated ${resource.updated}`;
      meta.appendChild(updated);
    }
    if (isSignedIn) meta.appendChild(buildSaveButton("resource", resource.id));
    card.append(category, title, desc, meta);
    return card;
  };

  const buildGroupSearchResult = (group) => {
    const a = document.createElement("a");
    a.className = "community-search-result-row";
    a.href = `community.html?group=${encodeURIComponent(group.key)}#groups`;
    const strong = document.createElement("strong");
    strong.textContent = group.name;
    const span = document.createElement("span");
    span.textContent = group.description;
    a.append(strong, span);
    return a;
  };

  const runSearch = (query) => {
    if (!query) return;
    communitySearchInput.value = query;
    searchResults.hidden = false;
    searchResultsList.innerHTML = "";
    searchResultsSummary.textContent = "Searching…";
    history.replaceState(null, "", `community.html?q=${encodeURIComponent(query)}#search`);

    const needle = query.toLowerCase();
    const localMatches = (text) => text.toLowerCase().includes(needle);
    const resourceMatches = [...COMMUNITY_FEATURED_RESOURCES, ...COMMUNITY_RESOURCE_DIRECTORY]
      .filter((resource) => localMatches(`${resource.title} ${resource.description}`))
      .slice(0, 5);
    const groupMatches = groupsCache.filter((group) => localMatches(`${group.name} ${group.description}`)).slice(0, 5);

    fetch(`/api/community/search?q=${encodeURIComponent(query)}`)
      .then((response) => (response.ok ? response.json() : { results: [] }))
      .then(({ results }) => {
        searchResultsList.innerHTML = "";
        const total = results.length + resourceMatches.length + groupMatches.length;
        searchResultsSummary.textContent = total
          ? `${total} result${total === 1 ? "" : "s"} for "${query}"`
          : `No results for "${query}".`;

        if (!total) {
          renderEmptyState(searchResultsList, "Nothing matched that search.", {
            href: "community.html?board=discussions#compose",
            label: "Start a Discussion"
          });
          return;
        }

        if (results.length) {
          searchResultsList.appendChild(buildSearchGroupHeading("Discussions"));
          results.forEach((thread) => searchResultsList.appendChild(buildThreadCard(thread, { compact: true, showBoard: true })));
        }
        if (resourceMatches.length) {
          searchResultsList.appendChild(buildSearchGroupHeading("Resources"));
          resourceMatches.forEach((resource) => searchResultsList.appendChild(buildResourceCard(resource)));
        }
        if (groupMatches.length) {
          searchResultsList.appendChild(buildSearchGroupHeading("Groups"));
          groupMatches.forEach((group) => searchResultsList.appendChild(buildGroupSearchResult(group)));
        }
      })
      .catch(() => {
        searchResultsSummary.textContent = "Search failed. Try again.";
      });
  };

  communitySearchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = communitySearchInput.value.trim();
    if (query.length < 2) return;
    runSearch(query);
  });

  clearSearch?.addEventListener("click", () => {
    communitySearchInput.value = "";
    searchResults.hidden = true;
    history.replaceState(null, "", "community.html#search");
  });

  const renderPopularSearches = () => {
    COMMUNITY_POPULAR_SEARCHES.forEach((term) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "community-popular-chip";
      btn.textContent = term;
      btn.addEventListener("click", () => runSearch(term));
      popularSearches.appendChild(btn);
    });
  };

  // ── Trending ─────────────────────────────────────────────────────────
  const loadTrending = () => {
    setListStatus(trendingStatus, "Loading…");
    Promise.all(
      TRENDING_BOARDS.map((board) =>
        fetch(`/api/community/boards/${encodeURIComponent(board)}/threads?sort=trending`)
          .then((response) => (response.ok ? response.json() : { threads: [] }))
          .then(({ threads }) => threads.slice(0, 3).map((thread) => ({ ...thread, board })))
          .catch(() => [])
      )
    ).then((groups) => {
      const merged = groups.flat();
      if (!merged.length) {
        setListStatus(trendingStatus, "");
        renderEmptyState(trendingList, "No discussions yet — be the first to post.", {
          href: "community.html?board=discussions#compose",
          label: "Start a Discussion"
        });
        return;
      }
      const now = Date.now();
      const score = (thread) => {
        const ageHours = Math.max(1, (now - new Date(thread.createdAt).getTime()) / (60 * 60 * 1000));
        return ((thread.replyCount || 0) * 4 + (thread.views || 0)) / Math.pow(ageHours, 0.6);
      };
      merged.sort((a, b) => score(b) - score(a));
      setListStatus(trendingStatus, "");
      trendingList.innerHTML = "";
      merged.slice(0, 6).forEach((thread) => trendingList.appendChild(buildThreadCard(thread, { compact: true, showBoard: true })));
    });
  };

  // ── Resources ────────────────────────────────────────────────────────
  const renderResources = () => {
    featuredResources.innerHTML = "";
    COMMUNITY_FEATURED_RESOURCES.forEach((resource) => featuredResources.appendChild(buildResourceCard(resource)));

    resourceDirectory.innerHTML = "";
    COMMUNITY_RESOURCE_DIRECTORY.forEach((resource) => {
      const a = document.createElement("a");
      a.className = "community-directory-link";
      a.href = resource.href;
      const strong = document.createElement("strong");
      strong.textContent = resource.title;
      const span = document.createElement("span");
      span.textContent = resource.description;
      a.append(strong, span);
      resourceDirectory.appendChild(a);
    });
  };

  // ── Support categories ───────────────────────────────────────────────
  const renderSupportCategories = () => {
    supportCategories.innerHTML = "";
    COMMUNITY_SUPPORT_CATEGORIES.forEach((category) => {
      const a = document.createElement("a");
      a.className = "community-help-chip";
      a.href = category.href;
      a.textContent = category.label;
      supportCategories.appendChild(a);
    });
  };

  // ── Pathway ──────────────────────────────────────────────────────────
  const renderPathway = () => {
    pathwayList.innerHTML = "";
    COMMUNITY_PATHWAY.forEach((step, index) => {
      const li = document.createElement("li");
      li.className = "community-pathway-step";
      const num = document.createElement("span");
      num.className = "community-pathway-num";
      num.textContent = String(index + 1).padStart(2, "0");
      const bodyWrap = document.createElement("div");
      bodyWrap.className = "community-pathway-body";
      const label = document.createElement("p");
      label.className = "community-pathway-label";
      label.textContent = step.label;
      const title = document.createElement("a");
      title.href = step.href;
      title.textContent = step.title;
      bodyWrap.append(label, title);
      li.append(num, bodyWrap);
      pathwayList.appendChild(li);
    });
  };

  // ── Browse by topic ──────────────────────────────────────────────────
  const countForTopic = (topic, stats) => {
    if (!stats) return null;
    if (topic.source.type === "members") return stats.members[topic.source.role] || 0;
    if (topic.source.type === "board") return stats.boards[topic.source.key] || 0;
    if (topic.source.type === "group") {
      const group = stats.groups.find((candidate) => candidate.key === topic.source.key);
      return group ? group.memberCount : 0;
    }
    return null;
  };

  const renderTopics = (stats) => {
    topicsGrid.innerHTML = "";
    COMMUNITY_TOPICS.forEach((topic) => {
      const a = document.createElement("a");
      a.className = "community-topic-card";
      a.href = topic.href;
      const title = document.createElement("h3");
      title.textContent = topic.label;
      const count = document.createElement("span");
      count.className = "community-topic-count";
      const n = countForTopic(topic, stats);
      const unit = topic.source.type === "board" ? "threads" : "members";
      count.textContent = n === null ? "" : `${n} ${unit}`;
      a.append(title, count);
      topicsGrid.appendChild(a);
    });
    const more = document.createElement("a");
    more.className = "community-topic-card community-topic-card--more";
    more.href = "#browse";
    more.textContent = "More Topics →";
    topicsGrid.appendChild(more);
  };

  // ── Groups ───────────────────────────────────────────────────────────
  const buildGroupCard = (group) => {
    const card = document.createElement("article");
    card.className = "community-group-card";
    card.dataset.groupKey = group.key;

    const title = document.createElement("h3");
    title.textContent = group.name;
    const desc = document.createElement("p");
    desc.textContent = group.description;
    const meta = document.createElement("p");
    meta.className = "community-group-meta";
    meta.textContent = `${group.memberCount} member${group.memberCount === 1 ? "" : "s"}`;

    const actions = document.createElement("div");
    actions.className = "community-group-actions";
    const viewLink = document.createElement("a");
    viewLink.className = "community-link-btn";
    viewLink.href = `community.html?q=${encodeURIComponent(group.name)}#search`;
    viewLink.textContent = "View discussions";
    actions.appendChild(viewLink);

    const joinBtn = document.createElement("button");
    joinBtn.type = "button";
    joinBtn.className = "community-btn community-btn-outline community-btn-small";
    const renderJoinBtn = () => {
      joinBtn.textContent = group.isMember ? "Leave group" : "Join group";
      joinBtn.classList.toggle("is-active", group.isMember);
    };
    renderJoinBtn();

    joinBtn.addEventListener("click", async () => {
      if (!isSignedIn) {
        window.location.href = "auth.html?mode=login";
        return;
      }
      joinBtn.disabled = true;
      const endpoint = group.isMember ? "leave" : "join";
      try {
        const response = await fetch(`/api/community/groups/${encodeURIComponent(group.id)}/${endpoint}`, { method: "POST" });
        if (response.ok) {
          group.isMember = !group.isMember;
          group.memberCount = Math.max(0, group.memberCount + (group.isMember ? 1 : -1));
          meta.textContent = `${group.memberCount} member${group.memberCount === 1 ? "" : "s"}`;
          renderJoinBtn();
          loadYourGroupsPanel();
        }
      } finally {
        joinBtn.disabled = false;
      }
    });
    actions.appendChild(joinBtn);

    card.append(title, desc, meta, actions);
    return card;
  };

  const highlightRequestedGroup = () => {
    const requested = getParams().get("group");
    if (!requested) return;
    const card = groupsGrid.querySelector(`[data-group-key="${CSS.escape(requested)}"]`);
    if (card) {
      card.classList.add("is-highlighted");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const loadGroups = () => {
    setListStatus(groupsStatus, "Loading…");
    return fetch("/api/community/groups")
      .then((response) => response.json())
      .then(({ groups }) => {
        groupsCache = groups;
        setListStatus(groupsStatus, "");
        groupsGrid.innerHTML = "";
        groups.forEach((group) => groupsGrid.appendChild(buildGroupCard(group)));
        highlightRequestedGroup();
        return groups;
      })
      .catch(() => {
        setListStatus(groupsStatus, "Groups couldn't be loaded right now.", "error");
        return [];
      });
  };

  // ── Events (seed data — see community-data.js) ──────────────────────
  const pad = (n) => String(n).padStart(2, "0");

  const eventDate = (event) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + event.daysFromNow);
    const [hours, minutes] = event.time.split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const escapeIcs = (text) =>
    String(text)
      .replace(/[\\;,]/g, (match) => `\\${match}`)
      .replace(/\n/g, "\\n");

  const icsStamp = (date) =>
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(
      date.getUTCMinutes()
    )}${pad(date.getUTCSeconds())}Z`;

  const downloadIcs = (event) => {
    const start = eventDate(event);
    const end = new Date(start.getTime() + event.durationMinutes * 60000);
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TEMPTX//Community//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${event.id}-${start.getTime()}@temptx.local`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(event.description)}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `temptx-${event.id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const renderEvents = () => {
    eventsGrid.innerHTML = "";
    SEED_EVENTS.forEach((event) => {
      const date = eventDate(event);
      const card = document.createElement("article");
      card.className = "community-event-card";

      const dateBadge = document.createElement("div");
      dateBadge.className = "community-event-date";
      const month = document.createElement("span");
      month.className = "community-event-month";
      month.textContent = date.toLocaleDateString("en-AU", { month: "short" }).toUpperCase();
      const day = document.createElement("span");
      day.className = "community-event-day";
      day.textContent = String(date.getDate());
      dateBadge.append(month, day);

      const body = document.createElement("div");
      body.className = "community-event-body";
      const title = document.createElement("h3");
      title.textContent = event.title;
      const desc = document.createElement("p");
      desc.textContent = event.description;
      const meta = document.createElement("p");
      meta.className = "community-event-meta";
      meta.textContent = `${date.toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long"
      })} · ${event.time} (Australian time) · ${event.format}`;

      const actions = document.createElement("div");
      actions.className = "community-event-actions";
      const learnMore = document.createElement("a");
      learnMore.className = "community-link-btn";
      learnMore.href = event.cta;
      learnMore.textContent = "Learn more";
      const addToCalendar = document.createElement("button");
      addToCalendar.type = "button";
      addToCalendar.className = "community-btn community-btn-outline community-btn-small";
      addToCalendar.textContent = "Add to calendar";
      addToCalendar.addEventListener("click", () => downloadIcs(event));
      actions.append(learnMore, addToCalendar);

      body.append(title, desc, meta, actions);
      card.append(dateBadge, body);
      eventsGrid.appendChild(card);
    });
  };

  // ── Contribution cards ───────────────────────────────────────────────
  const renderContribute = () => {
    contributeGrid.innerHTML = "";
    COMMUNITY_CONTRIBUTION_CARDS.forEach((item) => {
      const a = document.createElement("a");
      a.className = "community-contribute-card";
      a.href = item.href;
      const title = document.createElement("h3");
      title.textContent = item.title;
      const desc = document.createElement("p");
      desc.textContent = item.description;
      const cta = document.createElement("span");
      cta.className = "community-contribute-cta";
      cta.textContent = `${item.cta} →`;
      a.append(title, desc, cta);
      contributeGrid.appendChild(a);
    });
  };

  // ── Feedback ─────────────────────────────────────────────────────────
  const buildFeedbackCard = (item) => {
    const card = document.createElement("article");
    card.className = "community-feedback-card";
    const top = document.createElement("div");
    top.className = "community-feedback-card-top";
    const kind = document.createElement("span");
    kind.className = "community-feedback-kind";
    kind.textContent = KIND_LABELS[item.kind] || item.kind;
    const status = document.createElement("span");
    status.className = "community-feedback-status";
    status.textContent = item.status === "submitted" ? "Submitted" : item.status;
    top.append(kind, status);

    const title = document.createElement("h4");
    title.textContent = item.title;
    const details = document.createElement("p");
    details.textContent = item.details;

    const meta = document.createElement("p");
    meta.className = "community-thread-meta";
    const author = document.createElement("span");
    author.className = "community-thread-author";
    author.textContent = item.authorDisplayName;
    const time = document.createElement("span");
    time.className = "community-thread-time";
    time.textContent = formatTime(item.createdAt);
    meta.append(author, document.createTextNode(" · "), time);

    card.append(top, title, details, meta);
    return card;
  };

  const loadFeedback = () => {
    setListStatus(feedbackListStatus, "Loading…");
    fetch("/api/community/feedback")
      .then((response) => response.json())
      .then(({ feedback }) => {
        feedbackList.innerHTML = "";
        if (!feedback.length) {
          setListStatus(feedbackListStatus, "");
          renderEmptyState(feedbackList, "No ideas submitted yet. Be the first to help shape TemptX.", null);
          return;
        }
        setListStatus(feedbackListStatus, "");
        feedback.forEach((item) => feedbackList.appendChild(buildFeedbackCard(item)));
      })
      .catch(() => setListStatus(feedbackListStatus, "Feedback couldn't be loaded right now.", "error"));
  };

  feedbackForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitButton = feedbackForm.querySelector("button");
    submitButton.disabled = true;
    setStatus(feedbackFormStatus, "Submitting…");

    fetch("/api/community/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: feedbackKind.value,
        title: feedbackTitle.value,
        details: feedbackDetails.value,
        anonymous: feedbackAnonymous.checked
      })
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not submit feedback.");
        return result;
      })
      .then(() => {
        feedbackForm.reset();
        setStatus(feedbackFormStatus, "Thanks — your feedback has been submitted.", "success");
        loadFeedback();
      })
      .catch((error) => setStatus(feedbackFormStatus, error.message, "error"))
      .finally(() => {
        submitButton.disabled = false;
      });
  });

  // ── Your Community (personalisation) ─────────────────────────────────
  const buildYourItemLink = (label, href, kind) => {
    const a = document.createElement("a");
    a.className = "community-yours-item";
    const kindSpan = document.createElement("span");
    kindSpan.className = "community-yours-kind";
    kindSpan.textContent = kind;
    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    a.append(kindSpan, labelSpan);
    a.href = href;
    return a;
  };

  const hydrateThreadPreview = (id) =>
    fetch(`/api/community/threads/${encodeURIComponent(id)}?preview=1`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => (data ? data.thread : null))
      .catch(() => null);

  const loadSavedPanel = () => {
    setListStatus(savedStatus, "Loading…");
    const threadTargets = mySaved.filter((entry) => entry.targetType === "thread");
    const resourceTargets = mySaved.filter((entry) => entry.targetType === "resource");

    Promise.all(threadTargets.map((entry) => hydrateThreadPreview(entry.targetId))).then((threads) => {
      const validThreads = threads.filter(Boolean);
      const resources = resourceTargets
        .map((entry) => [...COMMUNITY_FEATURED_RESOURCES, ...COMMUNITY_RESOURCE_DIRECTORY].find((resource) => resource.id === entry.targetId))
        .filter(Boolean);

      savedList.innerHTML = "";
      if (!validThreads.length && !resources.length) {
        setListStatus(savedStatus, "");
        renderEmptyState(savedList, "Nothing saved yet.", { href: "#discussions", label: "Browse Discussions" });
        return;
      }
      setListStatus(savedStatus, "");
      validThreads.forEach((thread) =>
        savedList.appendChild(buildYourItemLink(thread.title, `community.html?board=${thread.board}&thread=${thread.id}`, "Discussion"))
      );
      resources.forEach((resource) => savedList.appendChild(buildYourItemLink(resource.title, resource.href, "Resource")));
    });
  };

  const loadFollowingPanel = () => {
    setListStatus(followingStatus, "Loading…");
    const threadTargets = myFollows.filter((entry) => entry.targetType === "thread");

    Promise.all(threadTargets.map((entry) => hydrateThreadPreview(entry.targetId))).then((threads) => {
      const validThreads = threads.filter(Boolean);
      followingList.innerHTML = "";
      if (!validThreads.length) {
        setListStatus(followingStatus, "");
        renderEmptyState(followingList, "You're not following any discussions yet.", { href: "#discussions", label: "Browse Discussions" });
        return;
      }
      setListStatus(followingStatus, "");
      validThreads.forEach((thread) =>
        followingList.appendChild(buildYourItemLink(thread.title, `community.html?board=${thread.board}&thread=${thread.id}`, "Discussion"))
      );
    });
  };

  const loadYourGroupsPanel = () => {
    if (!isSignedIn) return;
    yourGroupsList.innerHTML = "";
    const mine = groupsCache.filter((group) => group.isMember);
    if (!mine.length) {
      setListStatus(yourGroupsStatus, "");
      renderEmptyState(yourGroupsList, "You haven't joined a group yet.", { href: "#groups", label: "Explore Groups" });
      return;
    }
    setListStatus(yourGroupsStatus, "");
    mine.forEach((group) => yourGroupsList.appendChild(buildYourItemLink(group.name, `community.html?group=${group.key}#groups`, "Group")));
  };

  const loadContributionsPanel = () => {
    setListStatus(contributionsStatus, "Loading…");
    fetch("/api/community/me/contributions")
      .then((response) => response.json())
      .then(({ threads, replies, feedback, contributionCount, badges }) => {
        contributionsBadges.innerHTML = "";
        badges.forEach((badge) => {
          const span = document.createElement("span");
          span.className = "community-badge";
          span.textContent = badge;
          span.title = BADGE_DESCRIPTIONS[badge] || "";
          contributionsBadges.appendChild(span);
        });

        const items = [
          ...threads.map((thread) => ({
            label: thread.title,
            href: `community.html?board=${thread.board}&thread=${thread.id}`,
            kind: thread.type === "question" ? "Question" : "Discussion",
            createdAt: thread.createdAt
          })),
          ...replies.map((reply) => ({
            label: reply.snippet,
            href: `community.html?board=${reply.board}&thread=${reply.threadId}`,
            kind: reply.isAccepted ? "Accepted answer" : "Reply",
            createdAt: reply.createdAt
          })),
          ...feedback.map((item) => ({ label: item.title, href: "#feedback", kind: "Feedback", createdAt: item.createdAt }))
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        contributionsList.innerHTML = "";
        if (!contributionCount) {
          setListStatus(contributionsStatus, "");
          renderEmptyState(contributionsList, "You haven't contributed yet.", {
            href: "community.html?board=discussions#compose",
            label: "Start a Discussion"
          });
          return;
        }
        setListStatus(contributionsStatus, `${contributionCount} contribution${contributionCount === 1 ? "" : "s"} so far.`);
        items.slice(0, 10).forEach((item) => contributionsList.appendChild(buildYourItemLink(item.label, item.href, item.kind)));
      })
      .catch(() => setListStatus(contributionsStatus, "Contributions couldn't be loaded right now.", "error"));
  };

  // ── Init ─────────────────────────────────────────────────────────────
  const init = async () => {
    renderIntentGrid();
    renderPopularSearches();
    renderBrowseGrid();
    renderBoardTabs();
    renderSupportCategories();
    renderPathway();
    renderContribute();
    renderEvents();

    try {
      const meResponse = await fetch("/api/auth/me");
      isSignedIn = meResponse.ok;
    } catch {
      isSignedIn = false;
    }

    if (isSignedIn) {
      try {
        const [followsResponse, savedResponse] = await Promise.all([fetch("/api/community/follows"), fetch("/api/community/saved")]);
        myFollows = followsResponse.ok ? (await followsResponse.json()).follows : [];
        mySaved = savedResponse.ok ? (await savedResponse.json()).saved : [];
      } catch {
        myFollows = [];
        mySaved = [];
      }
      followSet = new Set(myFollows.map((entry) => keyOf(entry.targetType, entry.targetId)));
      savedSet = new Set(mySaved.map((entry) => keyOf(entry.targetType, entry.targetId)));
    }

    renderView();
    renderResources();
    loadTrending();
    loadFeedback();

    fetch("/api/community/stats")
      .then((response) => (response.ok ? response.json() : null))
      .then((stats) => {
        if (!stats) return;
        communityHeroStats.textContent = `${stats.members.total} members · ${stats.totalThreads} discussions · ${stats.groups.length} groups`;
        renderTopics(stats);
      })
      .catch(() => {});

    await loadGroups();

    if (isSignedIn) {
      loadSavedPanel();
      loadFollowingPanel();
      loadYourGroupsPanel();
      loadContributionsPanel();
    }

    const initialQuery = getParams().get("q");
    if (initialQuery) runSearch(initialQuery);
  };

  init();
})();
