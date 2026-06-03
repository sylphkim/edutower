/**
 * EduTower — Agent 侧栏面板
 * Agent 状态 / 复习进度：GET /api/agent/panel（后端生成）
 * 今日复习清单：用户本地录入
 */
(function () {
  "use strict";

  var API_BASE = window.EDUTOWER_API || "";
  var PANEL_API = API_BASE + "/api/agent/panel";
  var CHECKLIST_STORAGE_KEY = "edutower_review_checklist";
  var SESSION_KEY = "edutower_session_id";

  var statusEl = document.getElementById("agentStatusDisplay");
  var progressEl = document.getElementById("agentProgressDisplay");
  var checklistEl = document.getElementById("agentChecklistDisplay");
  var checklistEditorEl = document.getElementById("checklistEditor");
  var checklistToggleBtn = document.getElementById("checklistEditToggle");

  if (!statusEl || !progressEl || !checklistEl) {
    return;
  }

  var backendData = null;
  var checklist = loadChecklist();
  var isLoadingPanel = false;

  bindEvents();
  renderChecklist();
  refreshFromBackend();

  function getSessionId() {
    return sessionStorage.getItem(SESSION_KEY) || "default";
  }

  function loadChecklist() {
    try {
      var raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeChecklistItem).filter(function (item) {
            return item.title;
          });
        }
      }
    } catch (_err) {
      /* ignore */
    }
    return [];
  }

  function saveChecklist() {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklist));
  }

  function normalizeChecklistItem(item) {
    var timeRange = formatTimeRange(parseTimeRange(item && item.timeRange));
    return {
      title: String(item && item.title ? item.title : "").trim(),
      timeRange: timeRange,
      status: validChecklistStatus(item && item.status),
    };
  }

  function parseTimePart(part) {
    if (!part) return "";
    var match = String(part).trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return "";

    var hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
    var minute = Math.min(59, Math.max(0, parseInt(match[2], 10)));
    return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
  }

  function parseTimeRange(timeRange) {
    if (!timeRange) {
      return { start: "", end: "" };
    }

    var parts = String(timeRange)
      .split(/\s*(?:~|～|–|—|至|到|-)\s*/)
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);

    return {
      start: parseTimePart(parts[0]),
      end: parseTimePart(parts[1]),
    };
  }

  function formatTimeRange(times) {
    if (!times || (!times.start && !times.end)) {
      return "";
    }
    if (times.start && times.end) {
      return times.start + " – " + times.end;
    }
    return times.start || times.end;
  }

  function readTimeRangeFromRow(row) {
    var startInput = row.querySelector('[data-field="checklist-time-start"]');
    var endInput = row.querySelector('[data-field="checklist-time-end"]');
    return formatTimeRange({
      start: startInput ? startInput.value : "",
      end: endInput ? endInput.value : "",
    });
  }

  function buildChecklistTimeFieldsHtml(item) {
    var times = parseTimeRange(item.timeRange);
    return (
      '<div class="checklist-time-range">' +
      '<input class="form-input form-input--compact form-input--time" type="time" data-field="checklist-time-start" value="' +
      escapeAttr(times.start) +
      '" aria-label="开始时间" title="开始时间" />' +
      '<span class="checklist-time-range__sep" aria-hidden="true">至</span>' +
      '<input class="form-input form-input--compact form-input--time" type="time" data-field="checklist-time-end" value="' +
      escapeAttr(times.end) +
      '" aria-label="结束时间" title="结束时间" />' +
      "</div>"
    );
  }

  function buildChecklistEditorRowHtml(item, index) {
    return (
      '<div class="checklist-editor-row" data-checklist-row>' +
      '<label class="checklist-editor-row__label">任务名称</label>' +
      '<input class="form-input form-input--compact checklist-editor-row__title" type="text" data-field="checklist-title" value="' +
      escapeAttr(item.title) +
      '" placeholder="例如：导数定义与几何意义" />' +
      '<label class="checklist-editor-row__label">时间段</label>' +
      '<div class="checklist-editor-row__meta">' +
      buildChecklistTimeFieldsHtml(item) +
      '<select class="form-input form-input--compact checklist-editor-row__status" data-field="checklist-status">' +
      checklistStatusOptions(item.status) +
      "</select>" +
      '<button type="button" class="agent-editor-remove" data-action="remove-checklist" data-index="' +
      index +
      '" aria-label="删除清单项">×</button></div></div>'
    );
  }

  function validChecklistStatus(status) {
    return status === "done" || status === "active" || status === "pending" ? status : "pending";
  }

  function bindEvents() {
    if (checklistToggleBtn && checklistEditorEl) {
      checklistToggleBtn.addEventListener("click", function () {
        var hidden = checklistEditorEl.classList.toggle("is-hidden");
        checklistToggleBtn.setAttribute("aria-expanded", hidden ? "false" : "true");
        checklistToggleBtn.textContent = hidden ? "编辑清单" : "收起";
        if (!hidden) {
          renderChecklistEditor();
        }
      });
    }

    if (checklistEditorEl) {
      checklistEditorEl.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) return;

        if (target.matches("[data-action='apply-checklist']")) {
          applyChecklistForm();
          return;
        }
        if (target.matches("[data-action='add-checklist']")) {
          checklist.push({ title: "", timeRange: "09:00 – 10:00", status: "pending" });
          renderChecklistEditor();
          return;
        }
        if (target.matches("[data-action='remove-checklist']")) {
          var listIdx = parseInt(target.getAttribute("data-index") || "-1", 10);
          if (listIdx >= 0) {
            checklist.splice(listIdx, 1);
            renderChecklistEditor();
          }
        }
      });
    }
  }

  function applyChecklistForm() {
    checklist = collectChecklistFromEditor().filter(function (item) {
      return item.title;
    });
    saveChecklist();
    renderChecklist();
    showChecklistStatus("清单已保存");
  }

  function collectChecklistFromEditor() {
    if (!checklistEditorEl) return checklist;

    var rows = checklistEditorEl.querySelectorAll("[data-checklist-row]");
    var items = [];
    rows.forEach(function (row) {
      var titleInput = row.querySelector("[data-field='checklist-title']");
      var statusSelect = row.querySelector("[data-field='checklist-status']");
      items.push(
        normalizeChecklistItem({
          title: titleInput ? titleInput.value : "",
          timeRange: readTimeRangeFromRow(row),
          status: statusSelect ? statusSelect.value : "pending",
        })
      );
    });
    return items;
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
    if (!checklist.length) {
      checklistEl.innerHTML =
        '<li class="checklist-empty">暂无复习项，点击右上角「编辑清单」自行添加。</li>';
      return;
    }

    checklistEl.innerHTML = checklist
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
          '"><span class="' +
          iconCls +
          '" aria-hidden="true">' +
          iconContent +
          '</span><div class="checklist-body"><span class="checklist-title">' +
          escapeHtml(item.title) +
          '</span><span class="checklist-time">' +
          escapeHtml(item.timeRange || "未设置时间") +
          "</span></div></li>"
        );
      })
      .join("");
  }

  function renderChecklistEditor() {
    if (!checklistEditorEl) return;

    var rows = checklist.length ? checklist : [{ title: "", timeRange: "09:00 – 10:00", status: "pending" }];
    var checklistHtml = rows
      .map(function (item, index) {
        return buildChecklistEditorRowHtml(item, index);
      })
      .join("");

    checklistEditorEl.innerHTML =
      '<p class="agent-editor-intro">自行规划今日复习安排。请用时间选择器设定起止时间，填写后点击「保存清单」。</p>' +
      checklistHtml +
      '<div class="agent-editor-actions">' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="add-checklist">+ 添加一项</button>' +
      '<button type="button" class="btn btn--primary btn--compact" data-action="apply-checklist">保存清单</button></div>' +
      '<p id="checklistEditorStatus" class="agent-editor-status" role="status" aria-live="polite" hidden></p>';
  }

  function checklistStatusOptions(selected) {
    return ["done", "active", "pending"]
      .map(function (value) {
        var label = value === "done" ? "已完成" : value === "active" ? "进行中" : "待开始";
        return '<option value="' + value + '"' + (selected === value ? " selected" : "") + ">" + label + "</option>";
      })
      .join("");
  }

  function showChecklistStatus(message) {
    var el = document.getElementById("checklistEditorStatus");
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    clearTimeout(showChecklistStatus._timer);
    showChecklistStatus._timer = setTimeout(function () {
      el.hidden = true;
    }, 2200);
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

  window.EduTowerAgentPanel = {
    refreshFromBackend: refreshFromBackend,
    getChecklist: function () {
      return checklist.slice();
    },
    setChecklist: function (items) {
      checklist = Array.isArray(items) ? items.map(normalizeChecklistItem) : [];
      saveChecklist();
      renderChecklist();
    },
  };
})();
