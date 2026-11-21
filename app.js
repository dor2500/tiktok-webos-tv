(function () {
  "use strict";

  var TIKTOK_URL = "https://www.tiktok.com";
  var PROBE_TIMEOUT_MS = 6500;

  // LG webOS TV Remote Key Codes
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

  var loadingScreen = document.getElementById("loading-screen");
  var errorScreen = document.getElementById("error-screen");
  var statusText = document.getElementById("status-text");
  var errorDetail = document.getElementById("error-detail");
  var retryBtn = document.getElementById("retry-btn");
  var exitBtn = document.getElementById("exit-btn");

  var focusables = [retryBtn, exitBtn];
  var focusedIndex = 0;

  function setFocus(index) {
    focusedIndex = Math.max(0, Math.min(focusables.length - 1, index));
    focusables.forEach(function (el, idx) {
      if (!el) return;
      if (idx === focusedIndex) {
        el.classList.add("focused");
        el.focus();
      } else {
        el.classList.remove("focused");
      }
    });
  }

  function showLoading(message) {
    statusText.textContent = message || "Connecting to TikTok...";
    errorScreen.hidden = true;
    loadingScreen.hidden = false;
  }

  function showError(reason) {
    errorDetail.textContent =
      reason || "Please check your TV's internet connection and try again.";
    loadingScreen.hidden = true;
    errorScreen.hidden = false;
    setFocus(0);
  }

  function exitApp() {
    if (window.webOS && typeof window.webOS.platformBack === "function") {
      window.webOS.platformBack();
      return;
    }
    window.close();
  }

  function handleBackKey() {
    if (!errorScreen.hidden) {
      exitApp();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      exitApp();
    }
  }

  function toggleActiveVideoPlayback() {
    var video = document.querySelector("video");
    if (!video) return false;
    if (video.paused) {
      video.play().catch(function () {});
    } else {
      video.pause();
    }
    return true;
  }

  function scrollFeed(direction) {
    var delta = direction === "down" ? window.innerHeight : -window.innerHeight;
    window.scrollBy({ top: delta, behavior: "smooth" });
  }

  function onKeyDown(event) {
    var code = event.keyCode || event.which;

    if (code === KEY_BACK || code === KEY_ESCAPE || code === KEY_BACKSPACE) {
      event.preventDefault();
      handleBackKey();
      return;
    }

    if (!errorScreen.hidden) {
      if (code === KEY_LEFT || code === KEY_UP) {
        event.preventDefault();
        setFocus(focusedIndex - 1);
      } else if (code === KEY_RIGHT || code === KEY_DOWN) {
        event.preventDefault();
        setFocus(focusedIndex + 1);
      } else if (code === KEY_ENTER) {
        event.preventDefault();
        if (focusables[focusedIndex]) {
          focusables[focusedIndex].click();
        }
      }
      return;
    }

    // Feed navigation & playback controls
    if (code === KEY_UP) {
      event.preventDefault();
      scrollFeed("up");
    } else if (code === KEY_DOWN) {
      event.preventDefault();
      scrollFeed("down");
    } else if (code === KEY_ENTER || code === KEY_PLAY || code === KEY_PAUSE) {
      if (toggleActiveVideoPlayback()) {
        event.preventDefault();
      }
    } else if (code === KEY_STOP) {
      event.preventDefault();
      exitApp();
    }
  }

  function probeAndLaunch() {
    showLoading("Connecting to TikTok...");

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      showError("Your TV appears to be offline. Connect to Wi-Fi or Ethernet and retry.");
      return;
    }

    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      showError("Connection timed out while reaching TikTok.");
    }, PROBE_TIMEOUT_MS);

    fetch(TIKTOK_URL + "/favicon.ico", {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store"
    })
      .then(function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        showLoading("Launching TikTok...");
        window.location.replace(TIKTOK_URL);
      })
      .catch(function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        showError("Unable to reach TikTok servers. Please verify your network connection.");
      });
  }

  // Magic Remote pointer support
  focusables.forEach(function (el, idx) {
    if (!el) return;
    el.addEventListener("mouseenter", function () {
      setFocus(idx);
    });
  });

  retryBtn.addEventListener("click", probeAndLaunch);
  exitBtn.addEventListener("click", exitApp);
  document.addEventListener("keydown", onKeyDown, true);

  // webOS relaunch handler
  document.addEventListener("webOSRelaunch", function () {
    probeAndLaunch();
  });

  window.addEventListener("load", probeAndLaunch);
})();
