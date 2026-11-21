(function () {
  "use strict";

  var SERVICE_URI = "luna://com.dorp.tiktok.tv.service/getFeed";
  var SLIDE_HEIGHT = 1080;

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

  var videos = [];
  var seenIds = {};
  var currentIndex = 0;
  var isFetching = false;
  var errorFocusIdx = 0;
  var errorButtons = [retryBtn, exitBtn];

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

  function callLunaService(count) {
    return new Promise(function (resolve, reject) {
      if (typeof window.PalmServiceBridge !== "function") {
        reject(new Error("webOS PalmServiceBridge is unavailable in this environment."));
        return;
      }
      var bridge = new window.PalmServiceBridge();
      bridge.onservicecallback = function (msg) {
        try {
          var res = JSON.parse(msg);
          if (res && res.returnValue && Array.isArray(res.items)) {
            resolve(res.items);
          } else {
            reject(new Error((res && res.errorText) || "Empty feed response"));
          }
        } catch (err) {
          reject(err);
        }
      };
      bridge.call(SERVICE_URI, JSON.stringify({ count: count || 4 }));
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
        '</div>' +
        '<button class="action-btn like-btn" type="button" aria-label="Like">' +
          '<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' +
          '<span class="action-count">' + formatCount(item.stats.diggCount) + '</span>' +
        '</button>' +
        '<button class="action-btn" type="button" aria-label="Comments">' +
          '<svg viewBox="0 0 24 24" width="38" height="38" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
          '<span class="action-count">' + formatCount(item.stats.commentCount) + '</span>' +
        '</button>' +
        '<button class="action-btn save-btn" type="button" aria-label="Bookmark">' +
          '<svg viewBox="0 0 24 24" width="38" height="38" fill="currentColor"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>' +
          '<span class="action-count">' + formatCount(item.stats.collectCount) + '</span>' +
        '</button>' +
        '<button class="action-btn" type="button" aria-label="Share">' +
          '<svg viewBox="0 0 24 24" width="38" height="38" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>' +
          '<span class="action-count">' + formatCount(item.stats.shareCount) + '</span>' +
        '</button>' +
        '<div class="music-disc"><img src="' + avatarSrc + '" alt="" /></div>' +
      '</div>' +
      '<div class="video-meta">' +
        '<div class="author-row">' +
          '<span class="author-handle">@' + escapeHtml(item.author.uniqueId) + '</span>' +
          verifiedSvg +
        '</div>' +
        '<p class="video-caption">' + escapeHtml(item.desc) + '</p>' +
        '<div class="music-row">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>' +
          '<span class="music-text">' + escapeHtml(musicTitle) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="progress-bar-bg"><div class="progress-bar-fill"></div></div>';

    var video = slide.querySelector("video");
    var fill = slide.querySelector(".progress-bar-fill");
    var likeBtn = slide.querySelector(".like-btn");
    var saveBtn = slide.querySelector(".save-btn");

    video.addEventListener("timeupdate", function () {
      if (video.duration > 0) {
        fill.style.width = ((video.currentTime / video.duration) * 100).toFixed(1) + "%";
      }
    });

    video.addEventListener("click", function () {
      togglePlayback();
    });

    likeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      likeBtn.classList.toggle("liked");
    });

    saveBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      saveBtn.classList.toggle("saved");
    });

    return slide;
  }

  function getActiveSlide() {
    return feedTrack.children[currentIndex] || null;
  }

  function updateStage() {
    feedTrack.style.transform = "translate3d(0, -" + currentIndex * SLIDE_HEIGHT + "px, 0)";
    playBadge.hidden = true;

    for (var i = 0; i < feedTrack.children.length; i++) {
      var slide = feedTrack.children[i];
      var vid = slide.querySelector("video");
      if (!vid) continue;
      if (i === currentIndex) {
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

    if (videos.length - currentIndex <= 2) {
      loadMoreVideos(false);
    }
  }

  function togglePlayback() {
    var slide = getActiveSlide();
    if (!slide) return;
    var vid = slide.querySelector("video");
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(function () {});
      playBadge.hidden = true;
    } else {
      vid.pause();
      playBadge.hidden = false;
    }
  }

  function toggleActiveLike() {
    var slide = getActiveSlide();
    if (!slide) return;
    var btn = slide.querySelector(".like-btn");
    if (btn) btn.classList.toggle("liked");
  }

  function goToSlide(nextIndex) {
    if (nextIndex < 0 || nextIndex >= videos.length) return;
    currentIndex = nextIndex;
    updateStage();
  }

  function showError(msg) {
    errorDetail.textContent = msg || "Please check your TV's internet connection and try again.";
    loadingOverlay.hidden = true;
    errorOverlay.hidden = false;
    setErrorFocus(0);
  }

  function setErrorFocus(idx) {
    errorFocusIdx = Math.max(0, Math.min(errorButtons.length - 1, idx));
    errorButtons.forEach(function (btn, i) {
      if (i === errorFocusIdx) {
        btn.classList.add("focused");
        btn.focus();
      } else {
        btn.classList.remove("focused");
      }
    });
  }

  function exitApp() {
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
      statusText.textContent = "Loading For You feed...";
    }

    callLunaService(isInitial ? 4 : 3)
      .then(function (items) {
        var added = 0;
        items.forEach(function (item) {
          if (!item.id || seenIds[item.id]) return;
          seenIds[item.id] = true;
          var idx = videos.length;
          videos.push(item);
          feedTrack.appendChild(createSlide(item, idx));
          added++;
        });

        if (isInitial) {
          if (videos.length === 0) {
            showError("No TikTok videos returned. Please retry.");
          } else {
            loadingOverlay.hidden = true;
            updateStage();
          }
        } else if (added > 0) {
          videoCounter.textContent = (currentIndex + 1) + " / " + videos.length;
        }
      })
      .catch(function (err) {
        if (isInitial && videos.length === 0) {
          showError(err && err.message ? err.message : "Unable to reach TikTok.");
        }
      })
      .finally(function () {
        isFetching = false;
      });
  }

  function onKeyDown(event) {
    var code = event.keyCode || event.which;

    if (code === KEY_BACK || code === KEY_ESCAPE || code === KEY_BACKSPACE || code === KEY_STOP) {
      event.preventDefault();
      exitApp();
      return;
    }

    if (!errorOverlay.hidden) {
      if (code === KEY_LEFT || code === KEY_UP) {
        event.preventDefault();
        setErrorFocus(errorFocusIdx - 1);
      } else if (code === KEY_RIGHT || code === KEY_DOWN) {
        event.preventDefault();
        setErrorFocus(errorFocusIdx + 1);
      } else if (code === KEY_ENTER) {
        event.preventDefault();
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
    } else if (code === KEY_RIGHT || code === KEY_LEFT) {
      event.preventDefault();
      toggleActiveLike();
    }
  }

  var wheelLock = false;
  window.addEventListener("wheel", function (e) {
    if (wheelLock || !errorOverlay.hidden || !loadingOverlay.hidden) return;
    if (Math.abs(e.deltaY) < 20) return;
    wheelLock = true;
    goToSlide(e.deltaY > 0 ? currentIndex + 1 : currentIndex - 1);
    setTimeout(function () {
      wheelLock = false;
    }, 360);
  });

  tabFollowing.addEventListener("click", function () {
    tabFollowing.classList.add("active");
    tabForyou.classList.remove("active");
    loadMoreVideos(false);
  });

  tabForyou.addEventListener("click", function () {
    tabForyou.classList.add("active");
    tabFollowing.classList.remove("active");
  });

  retryBtn.addEventListener("click", function () {
    loadMoreVideos(true);
  });
  exitBtn.addEventListener("click", exitApp);

  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("load", function () {
    loadMoreVideos(true);
  });
})();
