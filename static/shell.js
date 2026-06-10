/**
 * EduTower — 原生多视图切换
 */
(function () {
  "use strict";

  var VIEW_CONFIG = {
    home: {
      breadcrumb: "学习首页",
      panelId: "view-home",
      sideId: null,
      refresh: function () {
        if (window.EduTowerHome) window.EduTowerHome.refresh();
      },
    },
    chat: {
      breadcrumb: "AI 智能助教",
      panelId: "view-chat",
      sideId: "agentPanel",
      refresh: function () {
        if (window.EduTowerAgentPanel) window.EduTowerAgentPanel.refreshFromBackend();
      },
    },
    wrongbook: {
      breadcrumb: "错题本",
      panelId: "view-wrongbook",
      sideId: null,
      refresh: function () {
        if (window.EduTowerWrongbook) {
          window.EduTowerWrongbook.refresh();
        }
      },
    },
    plan: {
      breadcrumb: "学习计划",
      panelId: "view-plan",
      sideId: null,
      refresh: function () {
        if (window.EduTowerPlan) window.EduTowerPlan.refresh();
      },
    },
    quiz: {
      breadcrumb: "练习测验",
      panelId: "view-quiz",
      sideId: null,
      refresh: function () {
        if (window.EduTowerQuiz) window.EduTowerQuiz.refresh();
      },
    },
    skills: {
      breadcrumb: "技能图谱",
      panelId: "view-skills",
      sideId: null,
      refresh: function () {
        if (window.EduTowerSkills) window.EduTowerSkills.refresh();
      },
    },
    memory: {
      breadcrumb: "学习记忆",
      panelId: "view-memory",
      sideId: null,
      refresh: function () {
        if (window.EduTowerMemory) window.EduTowerMemory.refresh();
      },
    },
    materials: {
      breadcrumb: "资料录入",
      panelId: "view-materials",
      sideId: "materialsPanel",
      refresh: function () {
        if (window.EduTowerMaterials) window.EduTowerMaterials.refresh();
      },
    },
    help: {
      breadcrumb: "使用帮助",
      panelId: "view-help",
      sideId: null,
    },
    about: {
      breadcrumb: "关于 EduTower",
      panelId: "view-about",
      sideId: null,
    },
    privacy: {
      breadcrumb: "隐私说明",
      panelId: "view-privacy",
      sideId: null,
    },
    terms: {
      breadcrumb: "服务条款",
      panelId: "view-terms",
      sideId: null,
    },
  };

  var INFO_VIEWS = new Set(["help", "about", "privacy", "terms"]);
  var navItems = document.querySelectorAll(".sidebar-nav .nav-item[data-view]");
  var breadcrumbEl = document.getElementById("viewBreadcrumb");
  var currentView = "home";

  function switchView(viewName) {
    var config = VIEW_CONFIG[viewName];
    if (!config) {
      showToast("该功能即将上线，敬请期待。");
      return;
    }

    currentView = viewName;

    navItems.forEach(function (item) {
      var isActive = item.getAttribute("data-view") === viewName;
      item.classList.toggle("nav-item--active", isActive);
      if (isActive) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });

    document.querySelectorAll(".view-panel").forEach(function (panel) {
      var isTarget = panel.id === config.panelId;
      panel.classList.toggle("is-hidden", !isTarget);
      panel.setAttribute("aria-hidden", isTarget ? "false" : "true");
    });

    document.querySelectorAll(".view-side-panel").forEach(function (side) {
      var showSide = config.sideId && side.id === config.sideId;
      side.classList.toggle("is-hidden", !showSide);
      side.setAttribute("aria-hidden", showSide ? "false" : "true");
    });

    if (breadcrumbEl) {
      breadcrumbEl.textContent = viewName === "home" ? "学习首页" : config.breadcrumb;
    }

    if (INFO_VIEWS.has(viewName)) {
      try {
        history.replaceState(null, "", "#" + viewName);
      } catch (_err) {
        /* ignore */
      }
    } else if (location.hash && INFO_VIEWS.has(location.hash.replace(/^#/, ""))) {
      try {
        history.replaceState(null, "", location.pathname);
      } catch (_err2) {
        /* ignore */
      }
    }

    if (typeof config.refresh === "function") {
      config.refresh();
    }
  }

  function showToast(message) {
    var toast = document.createElement("div");
    toast.className = "app-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add("app-toast--visible");
    });
    setTimeout(function () {
      toast.classList.remove("app-toast--visible");
      setTimeout(function () {
        toast.remove();
      }, 300);
    }, 2400);
  }

  navItems.forEach(function (item) {
    item.addEventListener("click", function (event) {
      event.preventDefault();
      switchView(item.getAttribute("data-view") || "home");
    });
  });

  document.querySelectorAll("[data-footer-view]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      switchView(link.getAttribute("data-footer-view") || "help");
    });
  });

  document.querySelectorAll("[data-go-view]").forEach(function (el) {
    el.addEventListener("click", function (event) {
      var view = el.getAttribute("data-go-view");
      if (!view) return;
      if (el.tagName === "A") event.preventDefault();
      switchView(view);
    });
  });

  var hashView = (location.hash || "").replace(/^#/, "");
  if (hashView && VIEW_CONFIG[hashView]) {
    switchView(hashView);
  }

  window.EduTowerShell = {
    switchView: switchView,
    getCurrentView: function () {
      return currentView;
    },
  };
})();
