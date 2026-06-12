/**
 * EduTower — 前端交互逻辑
 * 与 Express 服务器 POST /api/ai/chat 对接（Express 代理到 FastAPI）
 */
(function () {
  "use strict";

  const API_BASE = window.EDUTOWER_API || "";
  const CHAT_API = API_BASE + "/api/ai/chat";
  const SESSIONS_STORAGE_KEY = "edutower_chat_sessions";
  const SESSION_KEY = "edutower_session_id";
  const CONVERSATION_KEY = "edutower_conversation_id";

  const chatMessages = document.getElementById("chat-messages");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const chatDateEl = document.getElementById("chatDate");
  const chatTopicEl = document.getElementById("chatTopicLabel");

  const AI_AVATAR_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 3l1.5 4.5H18l-3.5 2.5 1.5 4.5L12 12l-4 2.5 1.5-4.5L6 7.5h4.5L12 3z"/></svg>';

  const WELCOME_TEXT =
    "你好。我是你的 AI 智能助教，可以帮你梳理考点、讲解错题、出题演练。直接在下方输入问题即可开始。";

  const DEFAULT_TOPIC_LABEL = "综合复习";
  const PENDING_TOPIC_LABEL = "待分类";

  const TOPIC_RULES = [
    { label: "二次函数", keywords: ["二次函数", "抛物线", "顶点式", "对称轴", "开口方向"] },
    { label: "导数与积分", keywords: ["导数", "积分", "微分", "定积分", "不定积分", "切线斜率"] },
    { label: "线性代数", keywords: ["行列式", "矩阵", "向量", "特征值", "线性方程", "秩"] },
    { label: "三角函数", keywords: ["三角函数", "正弦", "余弦", "正切", "弧度", "诱导公式"] },
    { label: "概率统计", keywords: ["概率", "统计", "期望", "方差", "分布", "抽样"] },
    { label: "立体几何", keywords: ["立体几何", "空间向量", "三视图", "体积", "表面积"] },
    { label: "数列", keywords: ["数列", "等差数列", "等比数列", "递推", "通项公式"] },
    { label: "英语", keywords: ["英语", "单词", "语法", "阅读理解", "作文", "完形填空"] },
    { label: "物理", keywords: ["力学", "电磁", "牛顿", "电路", "动量", "能量守恒"] },
    { label: "化学", keywords: ["化学", "反应方程式", "元素", "摩尔", "有机", "电离"] },
  ];

  const LEGACY_DEMO_TOPIC_PATTERNS = [/二次函数/, /数学\s*·/, /高中数学/];

  if (!chatMessages || !userInput || !sendBtn) {
    console.error("[EduTower] 缺少必要的 DOM 元素");
    return;
  }

  const THINKING_STEPS = [
    "Agent 思考中",
    "正在检索学习档案",
    "正在匹配薄弱知识点",
    "正在组织回答",
  ];

  let thinkingEl = null;
  let thinkingTimer = null;
  let thinkingStep = 0;
  let sessionId = sessionStorage.getItem(SESSION_KEY) || "";
  let conversationId = sessionStorage.getItem(CONVERSATION_KEY) || "";
  let isSending = false;

  function createId(prefix) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return prefix + "_" + crypto.randomUUID();
    }
    return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  function isLegacyDemoTopic(label) {
    if (!label) return true;
    return LEGACY_DEMO_TOPIC_PATTERNS.some(function (pattern) {
      return pattern.test(label);
    });
  }

  function inferTopicFromMessage(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return PENDING_TOPIC_LABEL;

    const lower = normalized.toLowerCase();
    for (let i = 0; i < TOPIC_RULES.length; i += 1) {
      const rule = TOPIC_RULES[i];
      const matched = rule.keywords.some(function (keyword) {
        return lower.indexOf(keyword.toLowerCase()) >= 0;
      });
      if (matched) return rule.label;
    }

    const shortTitle = normalized.length > 18 ? normalized.slice(0, 18) + "…" : normalized;
    return shortTitle;
  }

  function refreshSessionTopic(session) {
    if (!session) return;

    const firstUser = (session.messages || []).find(function (entry) {
      return entry.role === "user";
    });

    if (firstUser) {
      session.topicLabel = inferTopicFromMessage(firstUser.content);
      return;
    }

    if (!session.topicLabel || isLegacyDemoTopic(session.topicLabel)) {
      session.topicLabel = PENDING_TOPIC_LABEL;
    }
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (!raw) return { sessions: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.sessions)) return { sessions: [] };

      let migrated = false;
      parsed.sessions.forEach(function (session) {
        const before = session.topicLabel;
        refreshSessionTopic(session);
        if (before !== session.topicLabel) migrated = true;
      });

      if (migrated) {
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(parsed));
      }

      return parsed;
    } catch (_err) {
      return { sessions: [] };
    }
  }

  function saveStore(store) {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(store));
  }

  function buildPreview(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return "暂无消息";
    return normalized.length > 48 ? normalized.slice(0, 48) + "…" : normalized;
  }

  function getDateGroup(iso) {
    const date = new Date(iso || Date.now());
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    if (date >= startOfToday) return { key: "today", label: "今天", order: 0 };
    if (date >= startOfYesterday) return { key: "yesterday", label: "昨天", order: 1 };
    if (date >= startOfWeek) return { key: "week", label: "最近 7 天", order: 2 };
    return { key: "older", label: "更早", order: 3 };
  }

  function findSession(store, id) {
    return store.sessions.find(function (session) {
      return session.id === id;
    });
  }

  function findSessionByConversationId(store, convId) {
    return store.sessions.find(function (session) {
      return session.conversationId === convId;
    });
  }

  function setActiveConversationId(id) {
    conversationId = id ? String(id).trim() : "";
    if (conversationId) {
      sessionStorage.setItem(CONVERSATION_KEY, conversationId);
    } else {
      sessionStorage.removeItem(CONVERSATION_KEY);
    }
  }

  function getActiveConversationId() {
    return conversationId || sessionStorage.getItem(CONVERSATION_KEY) || "";
  }

  async function fetchConversationDetail(convId) {
    const api = window.EduTowerApi;
    if (!api || typeof api.get !== "function") {
      throw new Error("API 模块未就绪");
    }
    return api.get("/api/conversations/" + encodeURIComponent(convId));
  }

  async function syncSessionFromServer(session) {
    if (!session || !session.conversationId) {
      return session;
    }

    try {
      const detail = await fetchConversationDetail(session.conversationId);
      if (!detail || !Array.isArray(detail.messages)) {
        return session;
      }

      session.messages = detail.messages.map(function (message) {
        return {
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        };
      });
      session.updatedAt = detail.updatedAt || session.updatedAt;
      if (detail.title) {
        session.title = detail.title;
      }

      const lastMessage = session.messages[session.messages.length - 1];
      if (lastMessage) {
        session.preview = buildPreview(lastMessage.content);
      }

      refreshSessionTopic(session);
    } catch (err) {
      console.warn("[EduTower] 拉取子对话失败:", err);
    }

    return session;
  }

  function ensureCurrentSession(store) {
    if (!sessionId) {
      return null;
    }

    let session = findSession(store, sessionId);
    if (session) {
      return session;
    }

    const now = new Date().toISOString();
    session = {
      id: sessionId,
      topicLabel: PENDING_TOPIC_LABEL,
      title: "新对话",
      preview: "暂无消息",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    store.sessions.unshift(session);
    saveStore(store);
    return session;
  }

  function persistMessage(role, content) {
    const store = loadStore();
    const session = ensureCurrentSession(store);
    if (!session) return;

    const now = new Date().toISOString();
    const message = {
      id: createId("msg"),
      role: role,
      content: content,
      createdAt: now,
    };

    session.messages.push(message);
    session.updatedAt = now;
    session.preview = buildPreview(content);

    if (role === "user") {
      const firstUser = session.messages.find(function (entry) {
        return entry.role === "user";
      });
      if (firstUser && firstUser.id === message.id) {
        session.title = buildPreview(content);
        session.topicLabel = inferTopicFromMessage(content);
        updateTopicLabelFromSession();
      }
    }

    saveStore(store);
    notifyHistoryChanged();
  }

  function getOrCreateSessionId() {
    if (sessionId) return sessionId;

    sessionId = createId("sess");
    sessionStorage.setItem(SESSION_KEY, sessionId);

    const store = loadStore();
    ensureCurrentSession(store);
    updateTopicLabelFromSession();

    return sessionId;
  }

  function updateTopicLabelFromSession() {
    if (!chatTopicEl) return;

    const store = loadStore();
    const session = sessionId ? findSession(store, sessionId) : null;
    if (!session) {
      chatTopicEl.textContent = "新对话";
      return;
    }

    const hasMessages = session.messages && session.messages.length > 0;
    if (hasMessages && session.title && session.title !== "新对话") {
      chatTopicEl.textContent = session.title;
      return;
    }

    if (session.topicLabel && session.topicLabel !== PENDING_TOPIC_LABEL) {
      chatTopicEl.textContent = session.topicLabel;
      return;
    }

    chatTopicEl.textContent = "新对话";
  }

  function getTimestamp(iso) {
    const source = iso ? new Date(iso) : new Date();
    const h = String(source.getHours()).padStart(2, "0");
    const m = String(source.getMinutes()).padStart(2, "0");
    return h + ":" + m;
  }

  function setChatDate() {
    if (!chatDateEl) return;
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    chatDateEl.textContent = y + "年" + mo + "月" + d + "日 " + weekdays[now.getDay()];
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

  function clearMessages() {
    chatMessages.innerHTML = "";
  }

  function showWelcomeMessage() {
    clearMessages();

    const div = document.createElement("div");
    div.className = "message message--ai ai-message";
    div.innerHTML =
      '<div class="message-avatar message-avatar--ai" aria-hidden="true">' +
      AI_AVATAR_SVG +
      '</div><div class="message-content"><span class="message-sender">EduTower Agent</span>' +
      '<div class="message-bubble message-bubble--ai"><p>' +
      escapeHtml(WELCOME_TEXT) +
      "</p></div></div>";

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showThinkingIndicator() {
    removeThinkingIndicator();

    const div = document.createElement("div");
    div.className = "message message--ai ai-message loading-status";
    div.id = "chatThinkingIndicator";
    div.setAttribute("aria-live", "polite");
    div.setAttribute("aria-busy", "true");

    const avatar = createAiAvatar();
    const content = document.createElement("div");
    content.className = "message-content";

    const sender = document.createElement("span");
    sender.className = "message-sender";
    sender.textContent = "EduTower Agent";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble message-bubble--ai";

    const text = document.createElement("span");
    text.className = "loading-text";
    text.textContent = THINKING_STEPS[0];

    const dots = document.createElement("span");
    dots.className = "loading-dots";
    dots.setAttribute("aria-hidden", "true");
    dots.innerHTML = "<span></span><span></span><span></span>";

    bubble.appendChild(text);
    bubble.appendChild(dots);
    content.appendChild(sender);
    content.appendChild(bubble);
    div.appendChild(avatar);
    div.appendChild(content);

    chatMessages.appendChild(div);
    thinkingEl = div;
    thinkingStep = 0;

    thinkingTimer = window.setInterval(function () {
      thinkingStep += 1;
      const label = thinkingEl && thinkingEl.querySelector(".loading-text");
      if (label) {
        label.textContent = THINKING_STEPS[thinkingStep % THINKING_STEPS.length];
      }
    }, 2200);

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function removeThinkingIndicator() {
    if (thinkingTimer) {
      window.clearInterval(thinkingTimer);
      thinkingTimer = null;
    }
    if (thinkingEl) {
      thinkingEl.remove();
      thinkingEl = null;
    }
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
    time.textContent = getTimestamp(options.createdAt);

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

  function renderSessionMessages(messages) {
    clearMessages();

    if (!messages || !messages.length) {
      showWelcomeMessage();
      return;
    }

    messages.forEach(function (message) {
      const role = message.role === "user" ? "user" : "ai";
      addMessage(role, message.content, { createdAt: message.createdAt });
    });
  }

  async function loadSession(session) {
    if (!session || !session.id) return;

    const store = loadStore();
    let activeSession = findSession(store, session.id) || session;

    if (activeSession.conversationId) {
      setActiveConversationId(activeSession.conversationId);
      activeSession = await syncSessionFromServer(activeSession);
      saveStore(store);
    } else {
      setActiveConversationId("");
    }

    sessionId = activeSession.id;
    sessionStorage.setItem(SESSION_KEY, sessionId);
    updateTopicLabelFromSession();
    renderSessionMessages(activeSession.messages || []);

    if (window.EduTowerChatHistory && typeof window.EduTowerChatHistory.close === "function") {
      window.EduTowerChatHistory.close();
    }
  }

  function deleteSession(targetSessionId) {
    if (!targetSessionId) return;

    const store = loadStore();
    store.sessions = store.sessions.filter(function (session) {
      return session.id !== targetSessionId;
    });
    saveStore(store);

    if (sessionId === targetSessionId) {
      if (store.sessions.length) {
        loadSession(store.sessions[0]);
      } else {
        startNewSession();
      }
    }

    notifyHistoryChanged();
  }

  function startNewSession() {
    setActiveConversationId("");
    sessionId = createId("sess");
    sessionStorage.setItem(SESSION_KEY, sessionId);

    const store = loadStore();
    const now = new Date().toISOString();
    store.sessions.unshift({
      id: sessionId,
      topicLabel: PENDING_TOPIC_LABEL,
      title: "新对话",
      preview: "暂无消息",
      messages: [],
      createdAt: now,
      updatedAt: now,
    });
    saveStore(store);

    updateTopicLabelFromSession();
    showWelcomeMessage();
    notifyHistoryChanged();

    if (window.EduTowerChatHistory && typeof window.EduTowerChatHistory.close === "function") {
      window.EduTowerChatHistory.close();
    }
  }

  function bootstrapSession() {
    if (!sessionId) {
      updateTopicLabelFromSession();
      return;
    }

    const store = loadStore();
    const session = findSession(store, sessionId);

    if (!session) {
      sessionId = "";
      sessionStorage.removeItem(SESSION_KEY);
      updateTopicLabelFromSession();
      showWelcomeMessage();
      return;
    }

    if (session.conversationId) {
      setActiveConversationId(session.conversationId);
    } else {
      setActiveConversationId("");
    }

    updateTopicLabelFromSession();
    renderSessionMessages(session.messages || []);
  }

  function notifyHistoryChanged() {
    if (window.EduTowerChatHistory && typeof window.EduTowerChatHistory.refresh === "function") {
      window.EduTowerChatHistory.refresh();
    }
  }

  function listSessionsGrouped() {
    const store = loadStore();
    const groups = {};

    store.sessions.forEach(function (session) {
      const group = getDateGroup(session.updatedAt || session.createdAt);
      if (!groups[group.key]) {
        groups[group.key] = { topicLabel: group.label, order: group.order, sessions: [] };
      }
      groups[group.key].sessions.push(session);
    });

    return Object.keys(groups)
      .sort(function (left, right) {
        return groups[left].order - groups[right].order;
      })
      .map(function (key) {
        return {
          topicLabel: groups[key].topicLabel,
          sessions: groups[key].sessions.sort(function (left, right) {
            return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
          }),
        };
      });
  }

  function extractErrorMessage(result, response) {
    if (result && result.error && typeof result.error.message === "string") {
      return result.error.message.trim();
    }
    return "请求失败（HTTP " + response.status + "）";
  }

  async function requestChatReply(message) {
    const payload = {
      message: message,
      session_id: getOrCreateSessionId(),
    };
    const activeConversationId = getActiveConversationId();
    if (activeConversationId) {
      payload.conversationId = activeConversationId;
    }

    const response = await fetch(CHAT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    persistMessage("user", message);

    isSending = true;
    sendBtn.disabled = true;
    userInput.disabled = true;
    sendBtn.textContent = "发送中...";
    showThinkingIndicator();

    try {
      const reply = await requestChatReply(message);
      removeThinkingIndicator();
      addMessage("ai", reply);
      persistMessage("assistant", reply);

      if (window.EduTowerAgentPanel && typeof window.EduTowerAgentPanel.refreshFromBackend === "function") {
        window.EduTowerAgentPanel.refreshFromBackend();
      }

      if (window.EduTowerMemory && typeof window.EduTowerMemory.refresh === "function") {
        window.EduTowerMemory.refresh();
      }
    } catch (err) {
      console.error("[EduTower] /api/ai/chat 请求失败:", err);
      removeThinkingIndicator();

      const friendly =
        err instanceof TypeError && /fetch|network/i.test(String(err.message))
          ? "网络连接似乎出了问题，请确认后端服务已启动，然后稍后再试。"
          : "抱歉，暂时无法获取 AI 回复：" + (err.message || "未知错误") + "。请稍后重试。";

      addMessage("ai", friendly, { error: true });
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      userInput.disabled = false;
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

  async function activateStudyConversation(options) {
    options = options || {};
    const convId = options.conversationId ? String(options.conversationId).trim() : "";
    if (!convId) {
      return;
    }

    const store = loadStore();
    let session = findSessionByConversationId(store, convId);
    const now = new Date().toISOString();

    if (!session) {
      sessionId = createId("sess");
      sessionStorage.setItem(SESSION_KEY, sessionId);
      session = {
        id: sessionId,
        conversationId: convId,
        conversationType: "project_study",
        projectId: options.projectId || null,
        localDate: options.localDate || null,
        topicLabel: options.title || "今日学习",
        title: options.title || "今日学习",
        preview: "暂无消息",
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      store.sessions.unshift(session);
    } else {
      sessionId = session.id;
      sessionStorage.setItem(SESSION_KEY, sessionId);
      if (options.title) {
        session.title = options.title;
        session.topicLabel = options.title;
      }
    }

    setActiveConversationId(convId);
    await syncSessionFromServer(session);
    saveStore(store);
    updateTopicLabelFromSession();
    renderSessionMessages(session.messages || []);
    notifyHistoryChanged();
  }

  function clearStudyConversation() {
    const store = loadStore();
    const session = sessionId ? findSession(store, sessionId) : null;
    if (session && session.conversationType === "project_study") {
      setActiveConversationId("");
    }
  }

  async function refreshCurrentSessionFromServer() {
    const store = loadStore();
    const session = sessionId ? findSession(store, sessionId) : null;
    if (!session || !session.conversationId) {
      return;
    }

    await syncSessionFromServer(session);
    saveStore(store);
    renderSessionMessages(session.messages || []);
    notifyHistoryChanged();
  }

  window.EduTowerChat = {
    getSessionId: function () {
      return sessionId;
    },
    getConversationId: getActiveConversationId,
    loadSession: loadSession,
    startNewSession: startNewSession,
    deleteSession: deleteSession,
    listSessionsGrouped: listSessionsGrouped,
    showWelcomeMessage: showWelcomeMessage,
    activateStudyConversation: activateStudyConversation,
    clearStudyConversation: clearStudyConversation,
    refreshCurrentSessionFromServer: refreshCurrentSessionFromServer,
  };

  setChatDate();
  bootstrapSession();
})();

