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
    },
    chat: {
      breadcrumb: "AI 智能助教",
      panelId: "view-chat",
      sideId: "agentPanel",
    },
    materials: {
      breadcrumb: "资料录入",
      panelId: "view-materials",
      sideId: "materialsPanel",
    },
  };

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
      breadcrumbEl.textContent = config.breadcrumb;
    }

    if (viewName === "home" && window.EduTowerHome) {
      window.EduTowerHome.refresh();
    }

    if (viewName === "materials" && window.EduTowerMaterials) {
      window.EduTowerMaterials.refresh();
    }

    if (viewName === "chat" && window.EduTowerAgentPanel) {
      window.EduTowerAgentPanel.refreshFromBackend();
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

  window.EduTowerShell = {
    switchView: switchView,
    getCurrentView: function () {
      return currentView;
    },
  };
})();
