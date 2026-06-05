/**
 * EduTower — 共享 API 与 DOM 工具
 */
(function () {
  "use strict";

  var API_BASE = window.EDUTOWER_API || "";

  function extractErrorMessage(result, response) {
    if (result && result.error && typeof result.error.message === "string") {
      return result.error.message.trim();
    }
    return "请求失败（HTTP " + response.status + "）";
  }

  async function apiFetch(path, options) {
    options = options || {};
    var url = API_BASE + path;
    var response = await fetch(url, options);
    var result = null;

    try {
      result = await response.json();
    } catch (_err) {
      if (!response.ok) {
        throw new Error("服务器返回了无法解析的响应（HTTP " + response.status + "）");
      }
      throw new Error("服务器返回了无效的 JSON 数据");
    }

    if (result && result.ok === true) {
      return result.data;
    }

    throw new Error(extractErrorMessage(result, response));
  }

  function apiGet(path) {
    return apiFetch(path);
  }

  function apiPost(path, body) {
    return apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function apiPatch(path, body) {
    return apiFetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function apiDelete(path) {
    return apiFetch(path, { method: "DELETE" });
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

  function formatDate(iso) {
    if (!iso) return "—";
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    var y = date.getFullYear();
    var mo = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    var h = String(date.getHours()).padStart(2, "0");
    var mi = String(date.getMinutes()).padStart(2, "0");
    return y + "-" + mo + "-" + d + " " + h + ":" + mi;
  }

  function getQuestionPrompt(question) {
    if (!question || typeof question !== "object") return "（无题干）";
    return question.prompt || question.stem || "（无题干）";
  }

  function getQuestionOptions(question) {
    if (!question || !Array.isArray(question.options) || !question.options.length) {
      return [];
    }

    if (typeof question.options[0] === "string") {
      return question.options.map(function (text, index) {
        return { id: String(index), text: text };
      });
    }

    return question.options.map(function (opt) {
      return { id: opt.id || opt.text, text: opt.text || opt.id };
    });
  }

  function networkErrorMessage(err) {
    if (err instanceof TypeError && /fetch|network/i.test(String(err.message))) {
      return "网络连接失败，请确认 Express 后端已启动。";
    }
    return err && err.message ? err.message : "未知错误";
  }

  window.EduTowerApi = {
    base: API_BASE,
    fetch: apiFetch,
    get: apiGet,
    post: apiPost,
    patch: apiPatch,
    delete: apiDelete,
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr,
    formatDate: formatDate,
    getQuestionPrompt: getQuestionPrompt,
    getQuestionOptions: getQuestionOptions,
    networkError: networkErrorMessage,
  };
})();
