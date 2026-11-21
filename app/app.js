(function () {
  "use strict";

  var BASE_URI = "luna://com.dorp.tiktok.tv.service/";
  var SLIDE_HEIGHT = 1012;
  var STORAGE_KEY = "tiktok_tv_account_v1";

  var KEY_BACK = 461;
  var KEY_ESCAPE = 27;
  var KEY_BACKSPACE = 8;
  var KEY_LEFT = 37;
  var KEY_UP = 38;
  var KEY_RIGHT = 39;
  var KEY_DOWN = 40;
  var KEY_ENTER = 13;
  var KEY_PLAY = 415;
  var KEY_PAUSE = 19;
  var KEY_STOP = 413;
  var KEY_1 = 49;
  var KEY_2 = 50;
  var KEY_3 = 51;

  var viewHome = document.getElementById("view-home");
  var viewSearch = document.getElementById("view-search");
  var viewProfile = document.getElementById("view-profile");
  var navHome = document.getElementById("nav-home");
  var navSearch = document.getElementById("nav-search");
  var navProfile = document.getElementById("nav-profile");
  var navProfileLabel = document.getElementById("nav-profile-label");
  var accountPill = document.getElementById("account-pill");

  var feedTrack = document.getElementById("feed-track");
  var ambientBg = document.getElementById("ambient-bg");
  var playBadge = document.getElementById("play-badge");
  var loadingOverlay = document.getElementById("loading-overlay");
  var errorOverlay = document.getElementById("error-overlay");
  var statusText = document.getElementById("status-text");
  var errorDetail = document.getElementById("error-detail");
  var retryBtn = document.getElementById("retry-btn");
  var exitBtn = document.getElementById("exit-btn");
  var videoCounter = document.getElementById("video-counter");
  var tabFollowing = document.getElementById("tab-following");
  var tabForyou = document.getElementById("tab-foryou");

  var commentsDrawer = document.getElementById("comments-drawer");
  var commentsTitle = document.getElementById("comments-title");
  var commentsList = document.getElementById("comments-list");
  var closeCommentsBtn = document.getElementById("close-comments");

  var pairingModal = document.getElementById("pairing-modal");
  var pairingUrlEl = document.getElementById("pairing-url");
  var pairingPinEl = document.getElementById("pairing-pin");
  var pairingStatusEl = document.getElementById("pairing-status");
  var closePairingBtn = document.getElementById("close-pairing");

  var profileLoggedOut = document.getElementById("profile-logged-out");
  var profileLoggedIn = document.getElementById("profile-logged-in");
  var btnStartPairing = document.getElementById("btn-start-pairing");
  var quickLoginForm = document.getElementById("quick-login-form");
  var quickUsernameInput = document.getElementById("quick-username");
  var btnLogout = document.getElementById("btn-logout");

  var searchForm = document.getElementById("search-form");
  var searchInput = document.getElementById("search-input");
  var searchResult = document.getElementById("search-result");

  var activeTab = "home";
  var feedMode = "foryou";
  var videos = [];
  var seenIds = {};
  var currentIndex = 0;
  var isFetching = false;
  var errorFocusIdx = 0;
  var errorButtons = [retryBtn, exitBtn];
  var pairingTimer = null;
  var account = loadAccount();

  function loadAccount() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveAccount(acc) {
    account = acc;
    try {
      if (acc) localStorage.setItem(STORAGE_KEY, JSON.stringify(acc));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    syncAccountUI();
  }

  function formatCount(n) {
    var num = Number(n) || 0;
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(num);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function callService(method, payload) {
    return new Promise(function (resolve, reject) {
      if (typeof window.PalmServiceBridge !== "function") {
        reject(new Error("webOS PalmServiceBridge is unavailable."));
        return;
      }
      var bridge = new window.PalmServiceBridge();
      bridge.onservicecallback = function (msg) {
        try {
          var res = JSON.parse(msg);
          if (res && res.returnValue) resolve(res);
          else reject(new Error((res && res.errorText) || "Service error"));
        } catch (err) {
          reject(err);
        }
      };
      bridge.call(BASE_URI + method, JSON.stringify(payload || {}));
    });
  }

  function syncAccountUI() {
    if (account && account.username) {
      accountPill.textContent = "@" + account.username;
      navProfileLabel.textContent = "@" + account.username;
      profileLoggedOut.hidden = true;
      profileLoggedIn.hidden = false;
      document.getElementById("my-handle").textContent = "@" + account.username;
      document.getElementById("my-nickname").textContent = account.nickname || "@" + account.username;
      document.getElementById("session-badge").textContent = account.sessionid
        ? "Session Connected"
        : "Public Profile Mode";
      refreshProfileData(account.username);
    } else {
      accountPill.textContent = "Guest";
      navProfileLabel.textContent = "Profile";
      profileLoggedOut.hidden = false;
      profileLoggedIn.hidden = true;
    }
  }

  function refreshProfileData(username) {
    callService("getProfile", {
      username: username,
      sessionid: account && account.sessionid ? account.sessionid : ""
    })
      .then(function (res) {
        var p = res.profile;
        if (!p) return;
        document.getElementById("my-nickname").textContent = p.nickname || "@" + p.uniqueId;
        document.getElementById("my-handle").textContent = "@" + p.uniqueId;
        document.getElementById("my-bio").textContent = p.signature || "";
        if (p.avatar) document.getElementById("my-avatar").src = p.avatar;
        document.getElementById("stat-following").textContent = formatCount(p.stats.followingCount);
        document.getElementById("stat-followers").textContent = formatCount(p.stats.followerCount);
        document.getElementById("stat-likes").textContent = formatCount(p.stats.heartCount);
      })
      .catch(function () {});
  }

  function switchTab(tab) {
    activeTab = tab;
    viewHome.hidden = tab !== "home";
    viewSearch.hidden = tab !== "search";
    viewProfile.hidden = tab !== "profile";

    navHome.classList.toggle("active", tab === "home");
    navSearch.classList.toggle("active", tab === "search");
    navProfile.classList.toggle("active", tab === "profile");

    var slide = feedTrack.children[currentIndex];
    var vid = slide ? slide.querySelector("video") : null;
    if (vid) {
      if (tab === "home") vid.play().catch(function () {});
      else vid.pause();
    }
  }

  function openCommentsForCurrent() {
    var item = videos[currentIndex];
    if (!item) return;
    commentsTitle.textContent = formatCount(item.stats.commentCount) + " Comments";
    commentsList.innerHTML = '<div class="comment-empty">Loading comments...</div>';
    commentsDrawer.hidden = false;

    callService("getComments", {
      videoId: item.id,
      sessionid: account && account.sessionid ? account.sessionid : ""
    })
      .then(function (res) {
        var list = res.comments || [];
        if (list.length === 0) {
          commentsList.innerHTML = '<div class="comment-empty">No comments available right now.</div>';
          return;
        }
        commentsList.innerHTML = list
          .map(function (c) {
            var av = c.user.avatar ? escapeHtml(c.user.avatar) : "largeIcon.png";
            return (
              '<div class="comment-row">' +
                '<img class="comment-avatar" src="' + av + '" alt="" />' +
                '<div class="comment-body">' +
                  '<div class="comment-author">@' + escapeHtml(c.user.uniqueId) + " · ♥ " + formatCount(c.likes) + "</div>" +
                  '<div class="comment-text">' + escapeHtml(c.text) + "</div>" +
                "</div>" +
              "</div>"
            );
          })
          .join("");
      })
      .catch(function () {
        commentsList.innerHTML = '<div class="comment-empty">Comments unavailable for this video.</div>';
      });
  }

  function startPairingFlow() {
    pairingModal.hidden = false;
    pairingUrlEl.textContent = "Starting...";
    pairingPinEl.textContent = "----";
    pairingStatusEl.textContent = "Opening pairing server...";

    callService("startPairing", {})
      .then(function (res) {
        pairingUrlEl.textContent = res.url;
        pairingPinEl.textContent = res.pin;
        pairingStatusEl.textContent = "Waiting for phone connection...";
        if (pairingTimer) clearInterval(pairingTimer);
        pairingTimer = setInterval(function () {
          callService("getPairingStatus", {})
            .then(function (st) {
              if (st.paired && st.account) {
                clearInterval(pairingTimer);
                pairingTimer = null;
                pairingModal.hidden = true;
                saveAccount(st.account);
              }
            })
            .catch(function () {});
        }, 1500);
      })
      .catch(function (err) {
        pairingStatusEl.textContent = (err && err.message) || "Failed to start pairing.";
      });
  }

  function closePairingFlow() {
    if (pairingTimer) {
      clearInterval(pairingTimer);
      pairingTimer = null;
    }
    pairingModal.hidden = true;
    callService("stopPairing", {}).catch(function () {});
  }

  function renderProfilePreview(targetEl, profile) {
    var av = profile.avatar ? escapeHtml(profile.avatar) : "largeIcon.png";
    targetEl.innerHTML =
      '<img class="profile-avatar" src="' + av + '" alt="" />' +
      '<h3 class="profile-nickname">' + escapeHtml(profile.nickname) + "</h3>" +
      '<p class="profile-handle">@' + escapeHtml(profile.uniqueId) + "</p>" +
      '<div class="profile-stats">' +
        "<div><strong>" + formatCount(profile.stats.followingCount) + "</strong><span>Following</span></div>" +
        "<div><strong>" + formatCount(profile.stats.followerCount) + "</strong><span>Followers</span></div>" +
        "<div><strong>" + formatCount(profile.stats.heartCount) + "</strong><span>Likes</span></div>" +
      "</div>" +
      '<p class="profile-bio">' + escapeHtml(profile.signature) + "</p>";
    targetEl.hidden = false;
  }

  function lookupCreator(username) {
    switchTab("search");
    searchInput.value = "@" + username.replace(/^@+/, "");
    searchResult.hidden = false;
    searchResult.innerHTML = '<p class="status-text">Loading @' + escapeHtml(username) + "...</p>";
    callService("getProfile", {
      username: username,
      sessionid: account && account.sessionid ? account.sessionid : ""
    })
      .then(function (res) {
        renderProfilePreview(searchResult, res.profile);
      })
      .catch(function () {
        searchResult.innerHTML = '<p class="status-text">Could not load profile.</p>';
      });
  }

  function createSlide(item, idx) {
    var slide = document.createElement("article");
    slide.className = "video-slide";
    slide.dataset.index = String(idx);

    var verifiedSvg = item.author && item.author.verified
      ? '<svg class="verified-badge" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4z"/></svg>'
      : "";
    var avatarSrc = item.author && item.author.avatar ? escapeHtml(item.author.avatar) : "largeIcon.png";
    var musicTitle = item.music && item.music.title ? item.music.title : "Original Sound";

    slide.innerHTML =
      '<video class="video-player" playsinline loop preload="metadata" poster="' + escapeHtml(item.cover) + '" src="' + escapeHtml(item.playAddr) + '"></video>' +
      '<div class="slide-scrim"></div>' +
      '<div class="action-rail">' +
        '<div class="avatar-wrap">' +
          '<img class="creator-avatar" src="' + avatarSrc + '" alt="" />' +
          '<span class="follow-plus">+</span>' +
        "</div>" +
        '<button class="action-btn like-btn" type="button" aria-label="Like">' +
          '<svg viewBox="0 0 24 24" width="38" height="38" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' +
          '<span class="action-count">' + formatCount(item.stats.diggCount) + "</span>" +
        "</button>" +
        '<button class="action-btn comment-btn" type="button" aria-label="Comments">' +
          '<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
          '<span class="action-count">' + formatCount(item.stats.commentCount) + "</span>" +
        "</button>" +
        '<button class="action-btn save-btn" type="button" aria-label="Bookmark">' +
          '<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>' +
          '<span class="action-count">' + formatCount(item.stats.collectCount) + "</span>" +
        "</button>" +
        '<div class="music-disc"><img src="' + avatarSrc + '" alt="" /></div>' +
      "</div>" +
      '<div class="video-meta">' +
        '<div class="author-row">' +
          '<span class="author-handle">@' + escapeHtml(item.author.uniqueId) + "</span>" +
          verifiedSvg +
        "</div>" +
        '<p class="video-caption">' + escapeHtml(item.desc) + "</p>" +
        '<div class="music-row">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>' +
          '<span class="music-text">' + escapeHtml(musicTitle) + "</span>" +
        "</div>" +
      "</div>" +
      '<div class="progress-bar-bg"><div class="progress-bar-fill"></div></div>';

    var video = slide.querySelector("video");
    var fill = slide.querySelector(".progress-bar-fill");
    var likeBtn = slide.querySelector(".like-btn");
    var saveBtn = slide.querySelector(".save-btn");
    var commentBtn = slide.querySelector(".comment-btn");
    var avatarWrap = slide.querySelector(".avatar-wrap");
    var authorRow = slide.querySelector(".author-row");

    video.addEventListener("timeupdate", function () {
      if (video.duration > 0) {
        fill.style.width = ((video.currentTime / video.duration) * 100).toFixed(1) + "%";
      }
    });
    video.addEventListener("click", togglePlayback);
    likeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      likeBtn.classList.toggle("liked");
    });
    saveBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      saveBtn.classList.toggle("saved");
    });
    commentBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openCommentsForCurrent();
    });
    avatarWrap.addEventListener("click", function (e) {
      e.stopPropagation();
      lookupCreator(item.author.uniqueId);
    });
    authorRow.addEventListener("click", function (e) {
      e.stopPropagation();
      lookupCreator(item.author.uniqueId);
    });

    return slide;
  }

  function updateStage() {
    feedTrack.style.transform = "translate3d(0, -" + currentIndex * SLIDE_HEIGHT + "px, 0)";
    playBadge.hidden = true;

    for (var i = 0; i < feedTrack.children.length; i++) {
      var vid = feedTrack.children[i].querySelector("video");
      if (!vid) continue;
      if (i === currentIndex && activeTab === "home") {
        vid.currentTime = 0;
        vid.play().catch(function () {});
      } else {
        vid.pause();
      }
    }

    var currentItem = videos[currentIndex];
    if (currentItem && currentItem.cover) {
      ambientBg.style.backgroundImage = "url('" + currentItem.cover + "')";
    }
    videoCounter.textContent = (currentIndex + 1) + " / " + videos.length;
    if (videos.length - currentIndex <= 2) loadMoreVideos(false);
  }

  function togglePlayback() {
    var slide = feedTrack.children[currentIndex];
    var vid = slide ? slide.querySelector("video") : null;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(function () {});
      playBadge.hidden = true;
    } else {
      vid.pause();
      playBadge.hidden = false;
    }
  }

  function goToSlide(nextIndex) {
    if (nextIndex < 0 || nextIndex >= videos.length) return;
    currentIndex = nextIndex;
    updateStage();
  }

  function showError(msg) {
    errorDetail.textContent = msg || "Please check your TV connection and retry.";
    loadingOverlay.hidden = true;
    errorOverlay.hidden = false;
    errorFocusIdx = 0;
    retryBtn.classList.add("focused");
  }

  function exitApp() {
    closePairingFlow();
    if (window.webOS && typeof window.webOS.platformBack === "function") {
      window.webOS.platformBack();
      return;
    }
    window.close();
  }

  function loadMoreVideos(isInitial) {
    if (isFetching) return;
    isFetching = true;

    if (isInitial) {
      errorOverlay.hidden = true;
      loadingOverlay.hidden = false;
      statusText.textContent = feedMode === "following" ? "Loading Following feed..." : "Loading For You feed...";
    }

    callService("getFeed", {
      count: isInitial ? 4 : 3,
      tab: feedMode,
      sessionid: account && account.sessionid ? account.sessionid : ""
    })
      .then(function (res) {
        var items = res.items || [];
        items.forEach(function (item) {
          if (!item.id || seenIds[item.id]) return;
          seenIds[item.id] = true;
          var idx = videos.length;
          videos.push(item);
          feedTrack.appendChild(createSlide(item, idx));
        });

        if (isInitial) {
          if (videos.length === 0) showError("No TikTok videos returned. Please retry.");
          else {
            loadingOverlay.hidden = true;
            updateStage();
          }
        } else {
          videoCounter.textContent = (currentIndex + 1) + " / " + videos.length;
        }
      })
      .catch(function (err) {
        if (isInitial && videos.length === 0) {
          showError((err && err.message) || "Unable to reach TikTok.");
        }
      })
      .finally(function () {
        isFetching = false;
      });
  }

  function resetFeed(mode) {
    feedMode = mode;
    tabFollowing.classList.toggle("active", mode === "following");
    tabForyou.classList.toggle("active", mode === "foryou");
    videos = [];
    seenIds = {};
    currentIndex = 0;
    feedTrack.innerHTML = "";
    loadMoreVideos(true);
  }

  function onKeyDown(event) {
    var code = event.keyCode || event.which;

    if (code === KEY_BACK || code === KEY_ESCAPE || code === KEY_STOP) {
      event.preventDefault();
      if (!pairingModal.hidden) {
        closePairingFlow();
        return;
      }
      if (!commentsDrawer.hidden) {
        commentsDrawer.hidden = true;
        return;
      }
      if (activeTab !== "home") {
        switchTab("home");
        return;
      }
      exitApp();
      return;
    }

    if (document.activeElement && document.activeElement.tagName === "INPUT") {
      return;
    }

    if (code === KEY_1) { switchTab("home"); return; }
    if (code === KEY_2) { switchTab("search"); return; }
    if (code === KEY_3) { switchTab("profile"); return; }

    if (activeTab === "home") {
      if (!errorOverlay.hidden) {
        if (code === KEY_LEFT || code === KEY_RIGHT) {
          errorFocusIdx = errorFocusIdx === 0 ? 1 : 0;
          errorButtons.forEach(function (b, i) { b.classList.toggle("focused", i === errorFocusIdx); });
        } else if (code === KEY_ENTER) {
          errorButtons[errorFocusIdx].click();
        }
        return;
      }

      if (code === KEY_DOWN) {
        event.preventDefault();
        goToSlide(currentIndex + 1);
      } else if (code === KEY_UP) {
        event.preventDefault();
        goToSlide(currentIndex - 1);
      } else if (code === KEY_ENTER || code === KEY_PLAY || code === KEY_PAUSE) {
        event.preventDefault();
        togglePlayback();
      } else if (code === KEY_RIGHT) {
        event.preventDefault();
        var slide = feedTrack.children[currentIndex];
        var likeBtn = slide ? slide.querySelector(".like-btn") : null;
        if (likeBtn) likeBtn.classList.toggle("liked");
      } else if (code === KEY_LEFT) {
        event.preventDefault();
        openCommentsForCurrent();
      }
    }
  }

  var wheelLock = false;
  window.addEventListener("wheel", function (e) {
    if (wheelLock || activeTab !== "home" || !commentsDrawer.hidden || !errorOverlay.hidden) return;
    if (Math.abs(e.deltaY) < 20) return;
    wheelLock = true;
    goToSlide(e.deltaY > 0 ? currentIndex + 1 : currentIndex - 1);
    setTimeout(function () { wheelLock = false; }, 360);
  });

  navHome.addEventListener("click", function () { switchTab("home"); });
  navSearch.addEventListener("click", function () { switchTab("search"); });
  navProfile.addEventListener("click", function () { switchTab("profile"); });

  tabFollowing.addEventListener("click", function () { resetFeed("following"); });
  tabForyou.addEventListener("click", function () { resetFeed("foryou"); });

  closeCommentsBtn.addEventListener("click", function () { commentsDrawer.hidden = true; });
  btnStartPairing.addEventListener("click", startPairingFlow);
  closePairingBtn.addEventListener("click", closePairingFlow);

  quickLoginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var u = quickUsernameInput.value.replace(/^@+/, "").trim();
    if (!u) return;
    saveAccount({ username: u, sessionid: "" });
  });

  btnLogout.addEventListener("click", function () {
    saveAccount(null);
  });

  searchForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = searchInput.value.replace(/^@+/, "").trim();
    if (q) lookupCreator(q);
  });

  var chips = document.querySelectorAll(".creator-chip");
  for (var i = 0; i < chips.length; i++) {
    chips[i].addEventListener("click", function () {
      lookupCreator(this.getAttribute("data-user"));
    });
  }

  retryBtn.addEventListener("click", function () { loadMoreVideos(true); });
  exitBtn.addEventListener("click", exitApp);

  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("load", function () {
    syncAccountUI();
    loadMoreVideos(true);
  });
})();
