/**
 * EduTower — 前端交互逻辑
 * 与 Express 服务器 POST /api/ai/chat 对接（Express 代理到 FastAPI）
 */
(function () {
  "use strict";

  const API_BASE = window.EDUTOWER_API || "";
  const CHAT_API = API_BASE + "/api/ai/chat";

  const chatMessages = document.getElementById("chat-messages");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const chatDateEl = document.getElementById("chatDate");

  const AI_AVATAR_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 3l1.5 4.5H18l-3.5 2.5 1.5 4.5L12 12l-4 2.5 1.5-4.5L6 7.5h4.5L12 3z"/></svg>';

  if (!chatMessages || !userInput || !sendBtn) {
    console.error("[EduTower] 缺少必要的 DOM 元素");
    return;
  }

  const SESSION_KEY = "edutower_session_id";
  let sessionId = sessionStorage.getItem(SESSION_KEY) || "";
  let isSending = false;

  function getOrCreateSessionId() {
    if (sessionId) return sessionId;

    sessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11);

    sessionStorage.setItem(SESSION_KEY, sessionId);
    return sessionId;
  }

  function getTimestamp() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  function setChatDate() {
    if (!chatDateEl) return;
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    chatDateEl.textContent = `${y}年${mo}月${d}日 ${weekdays[now.getDay()]}`;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderAiHtml(text) {
    if (window.EduTowerChatRender && typeof window.EduTowerChatRender.render === "function") {
      return window.EduTowerChatRender.render(text);
    }
    return "<p>" + escapeHtml(text).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
  }

  function createAiAvatar() {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar message-avatar--ai";
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML = AI_AVATAR_SVG;
    return avatar;
  }

  function addMessage(role, text, options) {
    options = options || {};
    const div = document.createElement("div");
    div.className =
      "message message--" + (role === "user" ? "user user-message" : "ai ai-message");
    if (options.error) {
      div.classList.add("message--error");
    }

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = getTimestamp();

    if (role === "user") {
      const content = document.createElement("div");
      content.className = "message-content message-content--user";

      const bubble = document.createElement("div");
      bubble.className = "message-bubble message-bubble--user";
      bubble.textContent = text;

      content.appendChild(bubble);
      content.appendChild(time);
      div.appendChild(content);
    } else {
      const avatar = createAiAvatar();
      const content = document.createElement("div");
      content.className = "message-content";

      const sender = document.createElement("span");
      sender.className = "message-sender";
      sender.textContent = "EduTower Agent";

      const bubble = document.createElement("div");
      bubble.className = "message-bubble message-bubble--ai chat-markdown";
      bubble.innerHTML = renderAiHtml(text);

      content.appendChild(sender);
      content.appendChild(bubble);
      content.appendChild(time);
      div.appendChild(avatar);
      div.appendChild(content);
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function extractErrorMessage(result, response) {
    if (result && result.error && typeof result.error.message === "string") {
      return result.error.message.trim();
    }
    return "请求失败（HTTP " + response.status + "）";
  }

  async function requestChatReply(message) {
    const response = await fetch(CHAT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message,
        session_id: getOrCreateSessionId(),
      }),
    });

    let result = null;
    try {
      result = await response.json();
    } catch (_parseErr) {
      if (!response.ok) {
        throw new Error("服务器返回了无法解析的响应（HTTP " + response.status + "）");
      }
      throw new Error("服务器返回了无效的 JSON 数据");
    }

    if (result && result.ok === true && result.data) {
      const data = result.data;

      if (typeof data.session_id === "string" && data.session_id.trim()) {
        sessionId = data.session_id.trim();
        sessionStorage.setItem(SESSION_KEY, sessionId);
      }

      const replyText = data.answer || data.reply || data.text;
      if (typeof replyText !== "string" || !replyText.trim()) {
        throw new Error("服务器响应格式异常，未找到 answer/reply/text 字段");
      }

      return replyText.trim();
    }

    throw new Error(extractErrorMessage(result, response));
  }

  async function sendMessage() {
    if (isSending) return;

    const message = userInput.value.trim();
    if (!message) return;

    userInput.value = "";
    addMessage("user", message);

    isSending = true;
    sendBtn.disabled = true;
    sendBtn.textContent = "发送中...";

    try {
      const reply = await requestChatReply(message);
      addMessage("ai", reply);
      if (window.EduTowerAgentPanel && typeof window.EduTowerAgentPanel.refreshFromBackend === "function") {
        window.EduTowerAgentPanel.refreshFromBackend();
      }
    } catch (err) {
      console.error("[EduTower] /api/ai/chat 请求失败:", err);

      const friendly =
        err instanceof TypeError && /fetch|network/i.test(String(err.message))
          ? "网络连接似乎出了问题，请确认后端服务已启动，然后稍后再试。"
          : "抱歉，暂时无法获取 AI 回复：" + (err.message || "未知错误") + "。请稍后重试。";

      addMessage("ai", friendly, { error: true });
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      sendBtn.textContent = "发送";
    }
  }

  sendBtn.addEventListener("click", sendMessage);

  userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  setChatDate();
})();
