(function () {
  "use strict";

  var TIKTOK_URL = "https://www.tiktok.com/foryou";
  var PROBE_TIMEOUT_MS = 6500;

  var KEY_BACK = 461;
  var KEY_ESCAPE = 27;
  var KEY_LEFT = 37;
  var KEY_RIGHT = 39;
  var KEY_ENTER = 13;

  var loadingScreen = document.getElementById("loading-screen");
  var errorScreen = document.getElementById("error-screen");
  var statusText = document.getElementById("status-text");
  var errorDetail = document.getElementById("error-detail");
  var retryBtn = document.getElementById("retry-btn");
  var exitBtn = document.getElementById("exit-btn");

  var focusables = [retryBtn, exitBtn];
  var focusedIndex = 0;

  function setFocus(idx) {
    focusedIndex = Math.max(0, Math.min(focusables.length - 1, idx));
    focusables.forEach(function (el, i) {
      el.classList.toggle("focused", i === focusedIndex);
      if (i === focusedIndex) el.focus();
    });
  }

  function showLoading(msg) {
    statusText.textContent = msg || "Connecting to TikTok...";
    errorScreen.hidden = true;
    loadingScreen.hidden = false;
  }

  function showError(msg) {
    errorDetail.textContent = msg || "Please check your TV's internet connection and try again.";
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

    fetch("https://www.tiktok.com/favicon.ico", {
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

  document.addEventListener("keydown", function (e) {
    var code = e.keyCode || e.which;
    if (code === KEY_BACK || code === KEY_ESCAPE) {
      e.preventDefault();
      exitApp();
      return;
    }
    if (!errorScreen.hidden) {
      if (code === KEY_LEFT) setFocus(focusedIndex - 1);
      else if (code === KEY_RIGHT) setFocus(focusedIndex + 1);
      else if (code === KEY_ENTER) focusables[focusedIndex].click();
    }
  }, true);

  retryBtn.addEventListener("click", probeAndLaunch);
  exitBtn.addEventListener("click", exitApp);
  document.addEventListener("webOSRelaunch", probeAndLaunch);
  window.addEventListener("load", probeAndLaunch);
})();
