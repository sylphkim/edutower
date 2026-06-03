/**
 * EduTower — 前端交互逻辑
 * 与 Express 服务器 /api/ai/chat 对接（Express 代理到 FastAPI）
 */
(function () {
  "use strict";

  /* ===== DOM 引用 ===== */
  const chatMessages = document.getElementById("chat-messages");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const chatBody = document.getElementById("chatBody");
  const chatDateEl = document.getElementById("chatDate");

  if (!chatMessages || !userInput || !sendBtn) {
    console.error("[EduTower] 缺少必要的 DOM 元素");
    return;
  }

  /* ===== 状态 ===== */
  const SESSION_KEY = "edutower_session_id";
  let sessionId = sessionStorage.getItem(SESSION_KEY) || "";
  let isSending = false;

  /* ===== 工具函数 ===== */
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

  /* ===== 添加消息气泡 ===== */
  function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = `message ${role === "user" ? "message--user" : "message--ai"}`;

    const avatar = document.createElement("div");
    avatar.className = "message__avatar";
    avatar.textContent = role === "user" ? "🧑" : "🤖";

    const content = document.createElement("div");
    content.className = "message__content";
    content.textContent = text;

    const time = document.createElement("div");
    time.className = "message__time";
    time.textContent = getTimestamp();

    div.appendChild(avatar);
    div.appendChild(content);
    div.appendChild(time);
    chatMessages.appendChild(div);

    // 自动滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /* ===== 发送消息 ===== */
  async function sendMessage() {
    if (isSending) return;

    const message = userInput.value.trim();
    if (!message) return;

    // 清空输入
    userInput.value = "";

    // 显示用户消息
    addMessage("user", message);

    // 显示 AI 正在输入提示
    isSending = true;
    sendBtn.disabled = true;
    sendBtn.textContent = "发送中...";

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          session_id: sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`服务器错误: ${response.status}`);
      }

      const responseData = await response.json();

      // 解包 { ok, data } 响应格式
      const data = responseData && responseData.ok === true ? responseData.data : responseData;

      // 保存 session_id（如果是新的）
      if (data && data.session_id) {
        sessionId = data.session_id;
        sessionStorage.setItem(SESSION_KEY, sessionId);
      }

      // 显示 AI 回复（兼容 answer / reply / text 字段）
      const replyText = data && (data.answer || data.reply || data.text);
      addMessage("ai", replyText || "抱歉，我没有理解您的问题。");

    } catch (err) {
      console.error("[EduTower] 请求失败:", err);
      addMessage("ai", `连接失败: ${err.message}。请检查网络连接后重试。`);
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      sendBtn.textContent = "发送";
    }
  }

  /* ===== 事件绑定 ===== */
  sendBtn.addEventListener("click", sendMessage);

  userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 初始设置日期
  setChatDate();

  // 如果有 sessionId 但无消息，清空并重置
  if (sessionId && chatMessages.children.length === 0) {
    // 新会话，显示欢迎语
    addMessage("ai", "你好！我是 EduTower AI 助手，有什么可以帮助你的？");
  }

  console.log("[EduTower] 前端逻辑已加载");
})();
