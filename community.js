(() => {
  const BOARD_LABELS = {
    "safety-support": "Safety & Support",
    "local-district": "Local / District Chat",
    "industry-talk": "Industry Talk"
  };
  const DEFAULT_BOARD = "safety-support";

  const boardTabs = document.querySelectorAll("#boardTabs [data-board]");
  const boardView = document.querySelector("#boardView");
  const threadView = document.querySelector("#threadView");
  const threadList = document.querySelector("#threadList");
  const threadListStatus = document.querySelector("#threadListStatus");
  const threadDetail = document.querySelector("#threadDetail");
  const replyList = document.querySelector("#replyList");
  const backToBoard = document.querySelector("#backToBoard");

  const threadForm = document.querySelector("#threadForm");
  const threadTitleInput = document.querySelector("#threadTitle");
  const threadBodyInput = document.querySelector("#threadBody");
  const threadAnonymousInput = document.querySelector("#threadAnonymous");
  const threadFormStatus = document.querySelector("#threadFormStatus");
  const composeSigninPrompt = document.querySelector("#composeSigninPrompt");

  const replyForm = document.querySelector("#replyForm");
  const replyBodyInput = document.querySelector("#replyBody");
  const replyAnonymousInput = document.querySelector("#replyAnonymous");
  const replyFormStatus = document.querySelector("#replyFormStatus");
  const replySigninPrompt = document.querySelector("#replySigninPrompt");

  let isSignedIn = false;

  const getParams = () => new URLSearchParams(window.location.search);

  const currentBoard = () => {
    const board = getParams().get("board");
    return BOARD_LABELS[board] ? board : DEFAULT_BOARD;
  };

  const currentThreadId = () => getParams().get("thread") || null;

  const setStatus = (element, message, type) => {
    element.textContent = message || "";
    element.className = `report-status${type ? ` is-${type}` : ""}`;
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

  const applyAuthGating = () => {
    if (threadForm) threadForm.hidden = !isSignedIn;
    if (composeSigninPrompt) composeSigninPrompt.hidden = isSignedIn;
    if (replyForm) replyForm.hidden = !isSignedIn;
    if (replySigninPrompt) replySigninPrompt.hidden = isSignedIn;
  };

  const buildThreadCard = (thread) => {
    const card = document.createElement("a");
    card.className = "community-thread-card";
    card.href = `community.html?board=${encodeURIComponent(currentBoard())}&thread=${encodeURIComponent(thread.id)}`;

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

    const replies = document.createElement("span");
    replies.className = "community-thread-replies";
    replies.textContent = thread.replyCount === 1 ? "1 reply" : `${thread.replyCount} replies`;

    card.append(title, meta, replies);
    return card;
  };

  const loadThreadList = () => {
    const board = currentBoard();
    threadList.innerHTML = "";
    setStatus(threadListStatus, "Loading threads…");

    fetch(`/api/community/boards/${encodeURIComponent(board)}/threads`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not load threads.");
        return response.json();
      })
      .then(({ threads }) => {
        if (!threads.length) {
          setStatus(threadListStatus, "No threads yet — be the first to post.");
          return;
        }
        setStatus(threadListStatus, "");
        threads.forEach((thread) => threadList.appendChild(buildThreadCard(thread)));
      })
      .catch((error) => setStatus(threadListStatus, error.message, "error"));
  };

  const buildReplyRow = (reply) => {
    const row = document.createElement("article");
    row.className = "community-reply";

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

    row.append(meta, body, reportLink(reply.id));
    return row;
  };

  const renderThread = (thread, replies) => {
    threadDetail.innerHTML = "";

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
    meta.append(author, document.createTextNode(" · "), time);

    const body = document.createElement("p");
    body.className = "community-thread-body";
    body.textContent = thread.body;

    threadDetail.append(title, meta, body, reportLink(thread.id));

    replyList.innerHTML = "";
    if (!replies.length) {
      const empty = document.createElement("p");
      empty.className = "community-list-status";
      empty.textContent = "No replies yet.";
      replyList.appendChild(empty);
    } else {
      replies.forEach((reply) => replyList.appendChild(buildReplyRow(reply)));
    }
  };

  const loadThread = (threadId) => {
    threadDetail.innerHTML = "";
    replyList.innerHTML = "";
    setStatus(threadListStatus, "");

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

  const renderView = () => {
    const board = currentBoard();
    const threadId = currentThreadId();

    boardTabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.board === board && !threadId);
    });

    backToBoard.href = `community.html?board=${encodeURIComponent(board)}`;

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

  boardTabs.forEach((tab) => {
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      const board = tab.dataset.board;
      history.pushState(null, "", `community.html?board=${encodeURIComponent(board)}`);
      renderView();
    });
  });

  threadList?.addEventListener("click", (event) => {
    const card = event.target.closest(".community-thread-card");
    if (!card) return;
    event.preventDefault();
    history.pushState(null, "", card.getAttribute("href"));
    renderView();
  });

  backToBoard.addEventListener("click", (event) => {
    event.preventDefault();
    history.pushState(null, "", backToBoard.href);
    renderView();
  });

  window.addEventListener("popstate", renderView);

  if (threadForm) {
    threadForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const submitButton = threadForm.querySelector("button");
      submitButton.disabled = true;
      setStatus(threadFormStatus, "Posting…");

      fetch("/api/community/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: currentBoard(),
          title: threadTitleInput.value,
          body: threadBodyInput.value,
          anonymous: threadAnonymousInput.checked
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
  }

  if (replyForm) {
    replyForm.addEventListener("submit", (event) => {
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
  }

  fetch("/api/auth/me")
    .then((response) => {
      isSignedIn = response.ok;
    })
    .catch(() => {
      isSignedIn = false;
    })
    .finally(() => {
      applyAuthGating();
    });

  renderView();
})();
