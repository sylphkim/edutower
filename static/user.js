/**
 * EduTower — 轻量本地用户（昵称登录，无后端鉴权）
 */
(function () {
  "use strict";

  var STORAGE_KEY = "edutower_user_profile";

  var loginScreen = document.getElementById("loginScreen");
  var appRoot = document.getElementById("appRoot");
  var loginForm = document.getElementById("loginForm");
  var loginNameInput = document.getElementById("loginName");
  var loginErrorEl = document.getElementById("loginError");

  function readProfile() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.name !== "string" || !parsed.name.trim()) {
        return null;
      }
      return {
        name: parsed.name.trim(),
        createdAt: parsed.createdAt || "",
      };
    } catch (_err) {
      return null;
    }
  }

  function saveProfile(name) {
    var profile = {
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return profile;
  }

  function clearProfile() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function formatDisplayName(rawName) {
    var name = String(rawName || "").trim();
    if (!name) return "同学";
    if (name.slice(-2) === "同学") return name;
    return name + "同学";
  }

  function getAvatarInitial(displayName) {
    var base = displayName.replace(/同学$/, "").trim();
    if (!base) return "学";
    return base.charAt(0);
  }

  function getTimeGreetingPrefix() {
    var hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "上午好";
    if (hour >= 12 && hour < 18) return "下午好";
    if (hour >= 18 && hour < 23) return "晚上好";
    return "你好";
  }

  function getGreetingText() {
    return getTimeGreetingPrefix() + "，" + formatDisplayName(getProfileName());
  }

  function getProfileName() {
    var profile = readProfile();
    return profile ? profile.name : "";
  }

  function getDisplayName() {
    return formatDisplayName(getProfileName());
  }

  function applyUserToUI() {
    var displayName = getDisplayName();
    var greetingText = getGreetingText();
    var initial = getAvatarInitial(displayName);

    document.querySelectorAll("[data-user-greeting]").forEach(function (el) {
      el.textContent = greetingText;
    });

    document.querySelectorAll("[data-user-avatar]").forEach(function (el) {
      el.textContent = initial;
    });

    var welcomeEl = document.getElementById("chatWelcomeMessage");
    if (welcomeEl) {
      welcomeEl.textContent =
        "你好，" +
        displayName +
        "。我是你的 AI 智能助教，可以帮你梳理考点、讲解错题、出题演练。直接在下方输入问题即可开始。";
    }
  }

  function showLoginError(message) {
    if (!loginErrorEl) return;
    if (!message) {
      loginErrorEl.hidden = true;
      loginErrorEl.textContent = "";
      return;
    }
    loginErrorEl.hidden = false;
    loginErrorEl.textContent = message;
  }

  function showApp(runAppRefresh) {
    if (loginScreen) {
      loginScreen.classList.add("is-hidden");
      loginScreen.setAttribute("aria-hidden", "true");
    }
    if (appRoot) {
      appRoot.classList.remove("is-hidden");
      appRoot.setAttribute("aria-hidden", "false");
    }
    applyUserToUI();
    if (runAppRefresh) {
      refreshAppViews();
    }
  }

  function refreshAppViews() {
    if (window.EduTowerHome && typeof window.EduTowerHome.refresh === "function") {
      window.EduTowerHome.refresh();
    }
    if (window.EduTowerShell && typeof window.EduTowerShell.switchView === "function") {
      window.EduTowerShell.switchView("home");
    }
  }

  function showLogin() {
    if (loginScreen) {
      loginScreen.classList.remove("is-hidden");
      loginScreen.setAttribute("aria-hidden", "false");
    }
    if (appRoot) {
      appRoot.classList.add("is-hidden");
      appRoot.setAttribute("aria-hidden", "true");
    }
    showLoginError("");
    if (loginNameInput) {
      loginNameInput.value = getProfileName();
      loginNameInput.focus();
    }
  }

  function validateName(name) {
    var trimmed = name.trim();
    if (!trimmed) return "请输入你的称呼";
    if (trimmed.length > 20) return "称呼请控制在 20 字以内";
    if (!/^[\u4e00-\u9fa5A-Za-z0-9·\s]+$/.test(trimmed)) {
      return "称呼仅支持中文、字母、数字";
    }
    return "";
  }

  function handleLoginSubmit(event) {
    event.preventDefault();
    var name = loginNameInput ? loginNameInput.value : "";
    var error = validateName(name);
    if (error) {
      showLoginError(error);
      return;
    }
    saveProfile(name);
    showLoginError("");
    showApp(true);
  }

  function handleLogout() {
    if (!window.confirm("切换账号会清除当前称呼，复习清单等本地数据仍会保留。继续吗？")) {
      return;
    }
    clearProfile();
    showLogin();
  }

  function bindEvents() {
    if (loginForm) {
      loginForm.addEventListener("submit", handleLoginSubmit);
    }

    document.querySelectorAll("[data-action='logout']").forEach(function (el) {
      el.addEventListener("click", function (event) {
        event.preventDefault();
        handleLogout();
      });
    });
  }

  function bootstrap() {
    bindEvents();
    if (readProfile()) {
      showApp(true);
    } else {
      showLogin();
    }
  }

  window.EduTowerUser = {
    bootstrap: bootstrap,
    getProfile: readProfile,
    getDisplayName: getDisplayName,
    getGreetingText: getGreetingText,
    getTimeGreetingPrefix: getTimeGreetingPrefix,
    applyUserToUI: applyUserToUI,
    logout: handleLogout,
    isLoggedIn: function () {
      return !!readProfile();
    },
  };
})();
