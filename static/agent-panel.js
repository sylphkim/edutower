/**
 * EduTower — Agent 侧栏面板
 * Agent 状态 / 复习进度：GET /api/agent/panel（后端生成）
 * 今日复习清单：只读，来自学习计划「今日学习」任务
 */
(function () {
  "use strict";

  var API_BASE = window.EDUTOWER_API || "";
  var PANEL_API = API_BASE + "/api/agent/panel";
  var SESSION_KEY = "edutower_session_id";

  var statusEl = document.getElementById("agentStatusDisplay");
  var progressEl = document.getElementById("agentProgressDisplay");
  var checklistEl = document.getElementById("agentChecklistDisplay");
  if (!statusEl || !progressEl || !checklistEl) {
    return;
  }

  var backendData = null;
  var dailyTasks = [];
  var isLoadingPanel = false;
  var isLoadingChecklist = false;

  bindEvents();
  refreshChecklistFromDaily();
  refreshFromBackend();

  function getSessionId() {
    return sessionStorage.getItem(SESSION_KEY) || "default";
  }

  function mapDailyTask(task) {
    return {
      id: task.id,
      title: task.title,
      rawStatus: task.status || "todo",
      timeRange: task.estimatedMinutes ? task.estimatedMinutes + " 分钟" : "",
      status:
        task.status === "done"
          ? "done"
          : task.status === "in_progress"
            ? "active"
            : "pending",
    };
  }

  function bindEvents() {
    checklistEl.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.matches("[data-action='agent-open-plan']")) {
        if (window.EduTowerShell && typeof window.EduTowerShell.switchView === "function") {
          window.EduTowerShell.switchView("plan");
        }
        return;
      }

      var btn = target.closest("[data-action='agent-cycle-task']");
      if (!btn) return;

      var taskId = btn.getAttribute("data-task-id") || "";
      var currentStatus = btn.getAttribute("data-current-status") || "todo";
      if (!taskId) return;

      cycleDailyTask(taskId, currentStatus);
    });
  }

  async function refreshChecklistFromDaily() {
    if (isLoadingChecklist) return;
    isLoadingChecklist = true;

    checklistEl.innerHTML =
      '<li class="checklist-empty">正在同步今日学习任务…</li>';

    try {
      if (window.EduTowerPlan && typeof window.EduTowerPlan.loadTodayTasks === "function") {
        var payload = await window.EduTowerPlan.loadTodayTasks();
        var tasks = payload && Array.isArray(payload.tasks) ? payload.tasks : [];
        dailyTasks = tasks.map(mapDailyTask);
        renderChecklist();
        return;
      }

      dailyTasks = [];
      renderChecklist();
    } catch (_err) {
      dailyTasks = [];
      checklistEl.innerHTML =
        '<li class="checklist-empty">暂时无法加载今日任务。</li>';
    } finally {
      isLoadingChecklist = false;
    }
  }

  async function cycleDailyTask(taskId, currentStatus) {
    if (!window.EduTowerPlan || typeof window.EduTowerPlan.updateDailyTaskStatus !== "function") {
      return;
    }

    var nextStatus =
      typeof window.EduTowerPlan.nextDailyTaskStatus === "function"
        ? window.EduTowerPlan.nextDailyTaskStatus(currentStatus)
        : currentStatus === "todo"
          ? "in_progress"
          : currentStatus === "in_progress"
            ? "done"
            : "todo";

    try {
      await window.EduTowerPlan.updateDailyTaskStatus(taskId, nextStatus);
      await refreshChecklistFromDaily();
      if (window.EduTowerHome && typeof window.EduTowerHome.refresh === "function") {
        window.EduTowerHome.refresh();
      }
    } catch (_err) {
      /* ignore */
    }
  }

  async function refreshFromBackend() {
    if (isLoadingPanel) return;
    isLoadingPanel = true;

    renderAgentLoading();
    renderProgressLoading();

    try {
      var url = PANEL_API + "?session_id=" + encodeURIComponent(getSessionId());
      var response = await fetch(url);
      var result = await response.json();

      if (!response.ok || !result || result.ok !== true || !result.data) {
        throw new Error(extractErrorMessage(result, response));
      }

      backendData = result.data;
      renderAgentStatus();
      renderProgress();
    } catch (err) {
      console.error("[EduTower] /api/agent/panel 请求失败:", err);
      renderAgentError();
      renderProgressError();
    } finally {
      isLoadingPanel = false;
    }
  }

  function extractErrorMessage(result, response) {
    if (result && result.error && typeof result.error.message === "string") {
      return result.error.message.trim();
    }
    return "请求失败（HTTP " + response.status + "）";
  }

  function renderAgentLoading() {
    statusEl.innerHTML =
      '<div class="panel-placeholder panel-placeholder--loading">' +
      '<span class="status-dot status-dot--active"></span>' +
      "<span>正在同步 Agent 执行状态…</span></div>";
  }

  function renderProgressLoading() {
    progressEl.innerHTML = '<div class="panel-placeholder panel-placeholder--loading">正在计算今日复习进度…</div>';
  }

  function renderAgentError() {
    statusEl.innerHTML =
      '<div class="panel-placeholder panel-placeholder--error">暂时无法获取 Agent 状态，请确认后端已启动。</div>';
  }

  function renderProgressError() {
    progressEl.innerHTML =
      '<div class="panel-placeholder panel-placeholder--error">暂时无法获取复习进度，请确认后端已启动。</div>';
  }

  function renderAgentStatus() {
    if (!backendData || !backendData.agent) {
      renderAgentError();
      return;
    }

    var agent = backendData.agent;
    var stepsHtml = (agent.steps || [])
      .map(function (step) {
        var cls = "reasoning-step";
        if (step.status === "done") cls += " reasoning-step--done";
        if (step.status === "current") cls += " reasoning-step--current";
        return (
          '<li class="' +
          cls +
          '"><span class="step-index"></span><span class="step-text">' +
          escapeHtml(step.label) +
          "</span></li>"
        );
      })
      .join("");

    statusEl.innerHTML =
      '<div class="agent-status">' +
      '<span class="status-dot status-dot--active"></span>' +
      '<span class="status-label">' +
      escapeHtml(agent.activeLabel || "Agent 就绪") +
      "</span></div>" +
      '<ol class="reasoning-path">' +
      stepsHtml +
      "</ol>";
  }

  function renderProgress() {
    if (!backendData || !backendData.progress) {
      renderProgressError();
      return;
    }

    var progress = backendData.progress;
    var stats = progress.stats || {};
    var pct = clampPercent(progress.percent);
    var subjectLine = escapeHtml(progress.subject || "综合") + " · " + escapeHtml(progress.topic || "今日复习");

    progressEl.innerHTML =
      '<div class="progress-hero">' +
      '<span class="progress-value">' +
      pct +
      "<small>%</small></span>" +
      '<span class="progress-subject">' +
      subjectLine +
      "</span></div>" +
      '<div class="progress-bar" role="progressbar" aria-valuenow="' +
      pct +
      '" aria-valuemin="0" aria-valuemax="100">' +
      '<div class="progress-bar__fill" style="width:' +
      pct +
      '%"></div></div>' +
      '<ul class="progress-stats">' +
      "<li><span class=\"stat-num\">" +
      (stats.knowledgePoints || 0) +
      '</span><span class="stat-label">知识点</span></li>' +
      "<li><span class=\"stat-num\">" +
      (stats.practiceQuestions || 0) +
      '</span><span class="stat-label">练习题</span></li>' +
      "<li><span class=\"stat-num\">" +
      (stats.errorCorrections || 0) +
      '</span><span class="stat-label">错题订正</span></li></ul>';
  }

  function clampPercent(value) {
    var num = Number(value);
    if (Number.isNaN(num)) return 0;
    return Math.min(100, Math.max(0, Math.round(num)));
  }

  function renderChecklist() {
    if (!dailyTasks.length) {
      checklistEl.innerHTML =
        '<li class="checklist-empty">今日任务来自学习计划。<button type="button" class="btn-link" data-action="agent-open-plan">去启用今日学习</button></li>';
      return;
    }

    checklistEl.innerHTML = dailyTasks
      .map(function (item) {
        var cls = "checklist-item";
        if (item.status === "done") cls += " checklist-item--done";
        if (item.status === "active") cls += " checklist-item--active";

        var iconCls = "check-icon";
        var iconContent = "";
        if (item.status === "done") {
          iconContent = "✓";
        } else if (item.status === "active") {
          iconCls += " check-icon--ring";
        } else {
          iconCls += " check-icon--empty";
        }

        return (
          '<li class="' +
          cls +
          '"><button type="button" class="checklist-item__toggle" data-action="agent-cycle-task" data-task-id="' +
          escapeAttr(item.id) +
          '" data-current-status="' +
          escapeAttr(item.rawStatus || "todo") +
          '" aria-label="切换完成状态"><span class="' +
          iconCls +
          '" aria-hidden="true">' +
          iconContent +
          "</span></button><div class=\"checklist-body\"><span class=\"checklist-title\">" +
          escapeHtml(item.title) +
          '</span><span class="checklist-time">' +
          escapeHtml(item.timeRange || "今日任务") +
          "</span></div></li>"
        );
      })
      .join("");
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

  function getProgressTopic() {
    if (!backendData || !backendData.progress) {
      return "";
    }

    var progress = backendData.progress;
    var subject = progress.subject || "";
    var topic = progress.topic || "";

    if (subject && topic) {
      return subject + " · " + topic;
    }

    return subject || topic || "";
  }

  window.EduTowerAgentPanel = {
    refreshFromBackend: refreshFromBackend,
    refreshChecklist: refreshChecklistFromDaily,
    getProgressTopic: getProgressTopic,
    getChecklist: function () {
      return dailyTasks.slice();
    },
  };
})();
