/**
 * EduTower — 前端与 FastAPI /chat 对接
 */
(function () {
  "use strict";

  const SESSION_STORAGE_KEY = "edutower_session_id";
  const CHAT_API_PATH = "/chat";

  const chatBody = document.getElementById("chatBody");
  const chatMessages = document.getElementById("chat-messages");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const chatDateEl = document.getElementById("chatDate");

  if (!chatMessages || !userInput || !sendBtn) {
    console.error("[EduTower] 缺少必要的 DOM 元素：#chat-messages、#user-input 或 #send-btn");
    return;
  }

  let isSending = false;

  const AI_AVATAR_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">' +
    '<path d="M12 3l1.5 4.5H18l-3.5 2.5 1.5 4.5L12 12l-4 2.5 1.5-4.5L6 7.5h4.5L12 3z"/></svg>';

  initChatDate();
  bindEvents();
  scrollToBottom();

  /** ---------- Session ---------- */

  function getSessionId() {
    let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11);
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
  }

  /** ---------- UI helpers ---------- */

  function initChatDate() {
    if (!chatDateEl) return;
    const now = new Date();
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    chatDateEl.textContent =
      now.getFullYear() +
      "年" +
      (now.getMonth() + 1) +
      "月" +
      now.getDate() +
      "日 · " +
      weekdays[now.getDay()];
  }

  function formatTime() {
    return new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function getScrollContainer() {
    return chatBody || chatMessages;
  }

  function scrollToBottom() {
    const container = getScrollContainer();
    requestAnimationFrame(function () {
      container.scrollTop = container.scrollHeight;
    });
  }

  function autoResizeTextarea() {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  }

  function setComposerDisabled(disabled) {
    userInput.disabled = disabled;
    sendBtn.disabled = disabled;
    isSending = disabled;
  }

  function fillBubbleText(bubbleEl, text) {
    bubbleEl.innerHTML = "";
    const lines = String(text).split(/\n/).filter(function (line, i, arr) {
      return line.length > 0 || (arr.length === 1 && i === 0);
    });
    if (lines.length === 0) {
      const p = document.createElement("p");
      p.textContent = "";
      bubbleEl.appendChild(p);
      return;
    }
    lines.forEach(function (line) {
      const p = document.createElement("p");
      p.textContent = line;
      bubbleEl.appendChild(p);
    });
  }

  /** ---------- Message DOM ---------- */

  function createUserMessage(text) {
    const wrap = document.createElement("div");
    wrap.className = "message message--user user-message";

    const content = document.createElement("div");
    content.className = "message-content message-content--user";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble message-bubble--user";
    const p = document.createElement("p");
    p.textContent = text;
    bubble.appendChild(p);

    const time = document.createElement("time");
    time.className = "message-time";
    time.textContent = formatTime();

    content.appendChild(bubble);
    content.appendChild(time);
    wrap.appendChild(content);
    return wrap;
  }

  function createAiMessageShell(options) {
    const opts = options || {};
    const wrap = document.createElement("div");
    wrap.className = "message message--ai ai-message";
    if (opts.loading) wrap.classList.add("loading-status");
    if (opts.error) wrap.classList.add("message--error");
    if (opts.id) wrap.id = opts.id;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar message-avatar--ai";
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML = AI_AVATAR_SVG;

    const content = document.createElement("div");
    content.className = "message-content";

    const sender = document.createElement("span");
    sender.className = "message-sender";
    sender.textContent = opts.error ? "系统提示" : "EduTower Agent";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble message-bubble--ai";

    const time = document.createElement("time");
    time.className = "message-time";
    time.textContent = formatTime();

    content.appendChild(sender);
    content.appendChild(bubble);
    content.appendChild(time);
    wrap.appendChild(avatar);
    wrap.appendChild(content);

    return { wrap: wrap, bubble: bubble, time: time };
  }

  function createLoadingMessage() {
    const id = "loading-" + Date.now();
    const shell = createAiMessageShell({ loading: true, id: id });
    const loadingLine = document.createElement("p");
    loadingLine.className = "loading-text";
    loadingLine.textContent = "AI 正在思考中";

    const dots = document.createElement("span");
    dots.className = "loading-dots";
    dots.setAttribute("aria-hidden", "true");
    dots.innerHTML = "<span></span><span></span><span></span>";

    loadingLine.appendChild(dots);
    shell.bubble.appendChild(loadingLine);

    return { element: shell.wrap, id: id };
  }

  function appendUserMessage(text) {
    chatMessages.appendChild(createUserMessage(text));
    scrollToBottom();
  }

  function appendLoadingMessage() {
    const loading = createLoadingMessage();
    chatMessages.appendChild(loading.element);
    scrollToBottom();
    return loading;
  }

  function removeLoadingMessage(loadingRef) {
    if (!loadingRef || !loadingRef.element) return;
    loadingRef.element.remove();
  }

  function appendAiReply(text) {
    const shell = createAiMessageShell();
    fillBubbleText(shell.bubble, text);
    chatMessages.appendChild(shell.wrap);
    scrollToBottom();
  }

  function appendErrorMessage(message) {
    const shell = createAiMessageShell({ error: true });
    const p = document.createElement("p");
    p.textContent = message;
    shell.bubble.appendChild(p);
    chatMessages.appendChild(shell.wrap);
    scrollToBottom();
  }

  /** ---------- API ---------- */

  async function requestChatReply(message) {
    const response = await fetch(CHAT_API_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: getSessionId(),
        message: message,
      }),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_parseErr) {
      if (!response.ok) {
        throw new Error("服务器返回了无法解析的响应（HTTP " + response.status + "）");
      }
      throw new Error("服务器返回了无效的 JSON 数据");
    }

    if (!response.ok) {
      const detail =
        (data && (data.detail || data.message)) ||
        "请求失败（HTTP " + response.status + "）";
      const detailText =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map(function (d) {
                return d.msg || JSON.stringify(d);
              }).join("；")
            : JSON.stringify(detail);
      throw new Error(detailText);
    }

    if (!data || typeof data.reply !== "string") {
      throw new Error("服务器响应格式异常，未找到 reply 字段");
    }

    return data.reply;
  }

  /** ---------- Send flow ---------- */

  async function sendMessage() {
    if (isSending) return;

    const text = userInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    userInput.value = "";
    autoResizeTextarea();
    setComposerDisabled(true);

    const loadingRef = appendLoadingMessage();

    try {
      const reply = await requestChatReply(text);
      removeLoadingMessage(loadingRef);
      appendAiReply(reply);
    } catch (err) {
      console.error("[EduTower] /chat 请求失败:", err);
      removeLoadingMessage(loadingRef);

      const friendly =
        err instanceof TypeError && /fetch|network/i.test(String(err.message))
          ? "网络连接似乎出了问题，请确认后端服务已启动，然后稍后再试。"
          : "抱歉，暂时无法获取 AI 回复：" +
            (err.message || "未知错误") +
            "。请稍后重试。";

      appendErrorMessage(friendly);
    } finally {
      setComposerDisabled(false);
      userInput.focus();
    }
  }

  /** ---------- Events ---------- */

  function bindEvents() {
    sendBtn.addEventListener("click", function () {
      sendMessage();
    });

    userInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    userInput.addEventListener("input", autoResizeTextarea);
  }
})();
