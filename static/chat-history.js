/**
 * EduTower — AI 复习历史对话（浏览器本地存储，按主题分组展示）
 * 注：后端 Conversation API 尚未接入，会话数据保存在本机 localStorage。
 */
(function () {
  "use strict";

  var historyBtn = document.getElementById("chatHistoryBtn");
  var chatZone = document.querySelector(".chat-zone");

  if (!historyBtn || !chatZone) {
    return;
  }

  var drawerEl = null;
  var overlayEl = null;
  var isOpen = false;

  historyBtn.addEventListener("click", function () {
    openDrawer();
  });

  function ensureDrawer() {
    if (drawerEl) return;

    overlayEl = document.createElement("div");
    overlayEl.className = "chat-history-overlay is-hidden";
    overlayEl.setAttribute("aria-hidden", "true");
    overlayEl.addEventListener("click", closeDrawer);

    drawerEl = document.createElement("aside");
    drawerEl.className = "chat-history-drawer is-hidden";
    drawerEl.setAttribute("aria-label", "历史对话");
    drawerEl.innerHTML =
      '<header class="chat-history-drawer__header">' +
      '<div><h2 class="chat-history-drawer__title">历史对话</h2>' +
      '<p class="chat-history-drawer__subtitle">按复习主题查看过往会话（保存在本机浏览器）</p></div>' +
      '<button type="button" class="icon-btn chat-history-drawer__close" data-action="close-history" aria-label="关闭">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 6L6 18M6 6l12 12"/></svg></button></header>' +
      '<div class="chat-history-drawer__toolbar">' +
      '<button type="button" class="btn btn--primary btn--compact" data-action="new-session">+ 新对话</button></div>' +
      '<div class="chat-history-drawer__body" id="chatHistoryBody"></div>';

    drawerEl.addEventListener("click", handleDrawerClick);
    chatZone.appendChild(overlayEl);
    chatZone.appendChild(drawerEl);
  }

  function handleDrawerClick(event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-action='close-history']")) {
      closeDrawer();
      return;
    }

    if (target.matches("[data-action='new-session']")) {
      if (window.EduTowerChat && typeof window.EduTowerChat.startNewSession === "function") {
        window.EduTowerChat.startNewSession();
      }
      closeDrawer();
      return;
    }

    if (target.matches("[data-action='open-session']")) {
      var sessionId = target.getAttribute("data-session-id");
      if (!sessionId || !window.EduTowerChat || typeof window.EduTowerChat.listSessionsGrouped !== "function") {
        return;
      }

      var groups = window.EduTowerChat.listSessionsGrouped();
      var session = null;

      groups.some(function (group) {
        return (group.sessions || []).some(function (entry) {
          if (entry.id === sessionId) {
            session = entry;
            return true;
          }
          return false;
        });
      });

      if (session) {
        window.EduTowerChat.loadSession(session);
        closeDrawer();
      }
      return;
    }

    if (target.matches("[data-action='delete-session']")) {
      var deleteId = target.getAttribute("data-session-id");
      if (deleteId && window.EduTowerChat && typeof window.EduTowerChat.deleteSession === "function") {
        window.EduTowerChat.deleteSession(deleteId);
        renderDrawer();
      }
    }
  }

  function openDrawer() {
    ensureDrawer();
    isOpen = true;
    overlayEl.classList.remove("is-hidden");
    drawerEl.classList.remove("is-hidden");
    overlayEl.setAttribute("aria-hidden", "false");
    drawerEl.setAttribute("aria-hidden", "false");
    renderDrawer();
  }

  function closeDrawer() {
    if (!drawerEl || !overlayEl) return;
    isOpen = false;
    overlayEl.classList.add("is-hidden");
    drawerEl.classList.add("is-hidden");
    overlayEl.setAttribute("aria-hidden", "true");
    drawerEl.setAttribute("aria-hidden", "true");
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(text) {
    return escapeHtml(text).replace(/'/g, "&#39;");
  }

  function formatWhen(iso) {
    if (!iso) return "";
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    var hour = String(date.getHours()).padStart(2, "0");
    var minute = String(date.getMinutes()).padStart(2, "0");
    return month + "/" + day + " " + hour + ":" + minute;
  }

  function renderSessionItem(session) {
    var activeId =
      window.EduTowerChat && typeof window.EduTowerChat.getSessionId === "function"
        ? window.EduTowerChat.getSessionId()
        : "";
    var activeClass = session.id === activeId ? " chat-history-item--active" : "";

    return (
      '<div class="chat-history-item-wrap' +
      activeClass +
      '">' +
      '<button type="button" class="chat-history-item" data-action="open-session" data-session-id="' +
      escapeAttr(session.id) +
      '">' +
      '<span class="chat-history-item__title">' +
      escapeHtml(session.title || "未命名对话") +
      "</span>" +
      '<span class="chat-history-item__preview">' +
      escapeHtml(session.preview || "暂无消息") +
      "</span>" +
      '<span class="chat-history-item__meta">' +
      escapeHtml(formatWhen(session.updatedAt)) +
      " · " +
      ((session.messages && session.messages.length) || 0) +
      " 条</span></button>" +
      '<button type="button" class="chat-history-item__delete" data-action="delete-session" data-session-id="' +
      escapeAttr(session.id) +
      '" aria-label="删除此对话">×</button></div>'
    );
  }

  function renderDrawer() {
    var body = document.getElementById("chatHistoryBody");
    if (!body) return;

    if (!window.EduTowerChat || typeof window.EduTowerChat.listSessionsGrouped !== "function") {
      body.innerHTML = '<p class="chat-history-empty">对话模块尚未就绪，请刷新页面。</p>';
      return;
    }

    var groups = window.EduTowerChat.listSessionsGrouped();
    var sections = groups
      .map(function (group) {
        var sessions = Array.isArray(group.sessions) ? group.sessions : [];
        if (!sessions.length) return "";

        return (
          '<section class="chat-history-group">' +
          '<h3 class="chat-history-group__title">' +
          escapeHtml(group.topicLabel) +
          '<span class="chat-history-group__count">' +
          sessions.length +
          "</span></h3>" +
          '<div class="chat-history-list">' +
          sessions.map(renderSessionItem).join("") +
          "</div></section>"
        );
      })
      .filter(Boolean)
      .join("");

    body.innerHTML =
      sections || '<p class="chat-history-empty">还没有历史对话，点击「新对话」或发送第一条消息开始。</p>';
  }

  window.EduTowerChatHistory = {
    refresh: function () {
      if (isOpen) {
        renderDrawer();
      }
    },
    close: closeDrawer,
  };
})();
