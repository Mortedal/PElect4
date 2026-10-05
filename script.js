// Dark / light mode toggle.
// Loaded in <head> so the saved theme is applied before the page paints (no flash).
(function () {
  var root = document.documentElement;

  function getSavedTheme() {
    try {
      return localStorage.getItem("theme");
    } catch (e) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {
      // Storage unavailable (e.g. private mode) - theme just won't persist.
    }
  }

  // Use the saved choice, otherwise follow the device setting.
  var theme = getSavedTheme();
  if (!theme) {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  root.setAttribute("data-theme", theme);

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.querySelector(".theme-toggle");
    if (!button) return;

    function updateIcon() {
      var isDark = root.getAttribute("data-theme") === "dark";
      button.textContent = isDark ? "☀️" : "🌙";
      button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    }

    button.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      saveTheme(next);
      updateIcon();
    });

    updateIcon();
  });
})();
