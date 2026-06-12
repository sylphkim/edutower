/**
 * EduTower — 轻量本地用户（昵称登录 + 首次 API 配置向导）
 */
(function () {
  "use strict";

  var STORAGE_KEY = "edutower_user_profile";
  var ONBOARDING_KEY = "edutower_onboarding_complete";

  var loginScreen = document.getElementById("loginScreen");
  var appRoot = document.getElementById("appRoot");
  var loginForm = document.getElementById("loginForm");
  var loginNameInput = document.getElementById("loginName");
  var loginErrorEl = document.getElementById("loginError");
  var loginStepName = document.getElementById("loginStepName");
  var loginStepApi = document.getElementById("loginStepApi");
  var loginApiForm = document.getElementById("loginApiForm");
  var loginApiKeyInput = document.getElementById("loginApiKey");
  var loginApiBaseUrlInput = document.getElementById("loginApiBaseUrl");
  var loginApiModelInput = document.getElementById("loginApiModel");
  var loginApiErrorEl = document.getElementById("loginApiError");
  var loginApiSuccessEl = document.getElementById("loginApiSuccess");
  var loginApiSkipBtn = document.getElementById("loginApiSkipBtn");
  var loginApiTestBtn = document.getElementById("loginApiTestBtn");
  var apiBusy = false;

  var DEFAULT_API = {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  };

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

  function isOnboardingComplete() {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  }

  function markOnboardingComplete() {
    localStorage.setItem(ONBOARDING_KEY, "1");
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

  function showApiMessage(errorMessage, successMessage) {
    if (loginApiErrorEl) {
      if (errorMessage) {
        loginApiErrorEl.hidden = false;
        loginApiErrorEl.textContent = errorMessage;
      } else {
        loginApiErrorEl.hidden = true;
        loginApiErrorEl.textContent = "";
      }
    }
    if (loginApiSuccessEl) {
      if (successMessage) {
        loginApiSuccessEl.hidden = false;
        loginApiSuccessEl.textContent = successMessage;
      } else {
        loginApiSuccessEl.hidden = true;
        loginApiSuccessEl.textContent = "";
      }
    }
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

  function showLoginStep(step) {
    if (loginScreen) {
      loginScreen.classList.remove("is-hidden");
      loginScreen.setAttribute("aria-hidden", "false");
    }
    if (appRoot) {
      appRoot.classList.add("is-hidden");
      appRoot.setAttribute("aria-hidden", "true");
    }

    if (loginStepName) {
      var showName = step === "name";
      loginStepName.classList.toggle("is-hidden", !showName);
      loginStepName.setAttribute("aria-hidden", showName ? "false" : "true");
    }

    if (loginStepApi) {
      var showApi = step === "api";
      loginStepApi.classList.toggle("is-hidden", !showApi);
      loginStepApi.setAttribute("aria-hidden", showApi ? "false" : "true");
    }

    if (step === "name" && loginNameInput) {
      loginNameInput.value = getProfileName();
      loginNameInput.focus();
    }

    if (step === "api") {
      showApiMessage("", "");
      prefillApiForm();
      if (loginApiKeyInput) {
        loginApiKeyInput.focus();
      }
    }
  }

  function showLogin() {
    showLoginError("");
    showLoginStep("name");
  }

  function showApiSetup() {
    showLoginStep("api");
  }

  function prefillApiForm() {
    if (loginApiBaseUrlInput && !loginApiBaseUrlInput.value) {
      loginApiBaseUrlInput.value = DEFAULT_API.baseUrl;
    }
    if (loginApiModelInput && !loginApiModelInput.value) {
      loginApiModelInput.value = DEFAULT_API.model;
    }

    if (!window.EduTowerApi) return;

    window.EduTowerApi.get("/api/settings/llm/status")
      .then(function (status) {
        if (!status) return;
        if (status.baseUrl && loginApiBaseUrlInput) {
          loginApiBaseUrlInput.value = status.baseUrl;
        }
        if (status.model && loginApiModelInput) {
          loginApiModelInput.value = status.model;
        }
        if (status.configured && status.maskedKey) {
          showApiMessage(
            "",
            "当前已配置 Key：" + status.maskedKey + "。重新填写将覆盖原配置。"
          );
        }
      })
      .catch(function () {
        /* ignore */
      });
  }

  function readApiPayload() {
    return {
      apiKey: loginApiKeyInput ? loginApiKeyInput.value.trim() : "",
      baseUrl: loginApiBaseUrlInput
        ? loginApiBaseUrlInput.value.trim() || DEFAULT_API.baseUrl
        : DEFAULT_API.baseUrl,
      model: loginApiModelInput
        ? loginApiModelInput.value.trim() || DEFAULT_API.model
        : DEFAULT_API.model,
    };
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

  function finishLoginFlow() {
    markOnboardingComplete();
    showLoginError("");
    showApiMessage("", "");
    showApp(true);
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

    if (!isOnboardingComplete()) {
      showApiSetup();
      return;
    }

    showApp(true);
  }

  async function handleApiTest() {
    if (apiBusy || !window.EduTowerApi) return;

    var payload = readApiPayload();
    if (!payload.apiKey) {
      showApiMessage("请填写 API Key。", "");
      return;
    }

    apiBusy = true;
    showApiMessage("", "正在测试连接…");
    if (loginApiTestBtn) loginApiTestBtn.disabled = true;

    try {
      var result = await window.EduTowerApi.post("/api/settings/llm/test", payload);
      showApiMessage(
        "",
        "连接成功（模型：" + (result.model || payload.model) + "）。"
      );
    } catch (err) {
      showApiMessage(
        "测试失败：" + (window.EduTowerApi.networkError ? window.EduTowerApi.networkError(err) : err.message),
        ""
      );
    } finally {
      apiBusy = false;
      if (loginApiTestBtn) loginApiTestBtn.disabled = false;
    }
  }

  async function handleApiSave(event) {
    event.preventDefault();
    if (apiBusy || !window.EduTowerApi) return;

    var payload = readApiPayload();
    if (!payload.apiKey) {
      showApiMessage("请填写 API Key。", "");
      return;
    }

    apiBusy = true;
    showApiMessage("", "正在保存配置…");

    try {
      await window.EduTowerApi.post("/api/settings/llm", payload);
      showApiMessage(
        "",
        "配置已保存。若 AI 聊天或出题无响应，请重启 FastAPI 服务（在 AI-Agent 目录运行 python main.py）。"
      );
      if (isOnboardingComplete()) {
        return;
      }
      finishLoginFlow();
    } catch (err) {
      showApiMessage(
        "保存失败：" + (window.EduTowerApi.networkError ? window.EduTowerApi.networkError(err) : err.message),
        ""
      );
    } finally {
      apiBusy = false;
    }
  }

  function handleApiSkip() {
    finishLoginFlow();
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
    if (loginApiForm) {
      loginApiForm.addEventListener("submit", handleApiSave);
    }
    if (loginApiSkipBtn) {
      loginApiSkipBtn.addEventListener("click", handleApiSkip);
    }
    if (loginApiTestBtn) {
      loginApiTestBtn.addEventListener("click", handleApiTest);
    }

    document.querySelectorAll("[data-action='logout']").forEach(function (el) {
      el.addEventListener("click", function (event) {
        event.preventDefault();
        handleLogout();
      });
    });

    document.querySelectorAll("[data-action='open-api-setup']").forEach(function (el) {
      el.addEventListener("click", function (event) {
        event.preventDefault();
        showApiSetup();
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
    openApiSetup: showApiSetup,
    isLoggedIn: function () {
      return !!readProfile();
    },
  };
})();
