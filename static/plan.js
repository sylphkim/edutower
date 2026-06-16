/**
 * EduTower — 学习计划（含每日任务与资料关联）
 */
(function () {
  "use strict";

  var rootEl = document.getElementById("planRoot");
  if (!rootEl) return;

  var api = window.EduTowerApi;
  var plans = [];
  var materials = [];
  var skills = [];
  var selectedId = null;
  var isBusy = false;
  var viewMode = "hub";
  var banner = { type: "", message: "" };
  var pendingDeletePlanId = null;
  var draftDays = [];
  var editingDays = [];
  var dailyRecord = null;
  var planVersions = [];
  var currentPlanVersion = null;
  var selectedVersionId = null;
  var dependencyEdges = [];
  var suggestionDecisions = {};
  var DAILY_CONV_STORAGE_KEY = "edutower_daily_conversation_map";
  var sheetHistory = [];
  var showProjectSettings = false;
  var projectSetup = null;
  var editingDraftVersionId = null;
  var draftPhaseForms = [];
  var MIN_DAILY_MINUTES = 15;
  var MAX_DAILY_MINUTES = 480;

  var TASK_STATUS_LABEL = {
    todo: "待开始",
    in_progress: "进行中",
    done: "已完成",
  };

  var TASK_TYPE_LABEL = {
    read_material: "阅读资料",
    practice_quiz: "练习测验",
    review_wrongbook: "错题复盘",
    master_skill: "掌握技能",
  };

  var PLAN_STATUS_LABEL = {
    draft: "草稿",
    active: "进行中",
    completed: "已完成",
  };

  bindEvents();
  refresh();

  function bindEvents() {
    rootEl.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      var action = target.getAttribute("data-action");
      if (!action) return;

      if (action === "plan-view-hub") {
        leaveTimetableView();
        setViewMode("hub");
        loadHubData();
      } else if (action === "plan-view-timetable") {
        setViewMode("timetable");
        render();
      } else if (action === "plan-view-advanced") {
        leaveTimetableView();
        setViewMode("advanced");
        render();
      } else if (action === "plan-quick-start") {
        quickStartPlan();
      } else if (action === "plan-view-create") {
        draftDays = [emptyDay(1)];
        setViewMode("create");
        render();
      } else if (action === "plan-view-edit") {
        setViewMode("edit");
        render();
      } else if (action === "plan-view-tasks") {
        var plan = getSelectedPlan();
        if (plan) {
          editingDays = cloneDays(plan.days);
          if (!editingDays.length) {
            editingDays = [emptyDay(1)];
          }
        }
        setViewMode("tasks");
        render();
      } else if (action === "plan-view-today" || action === "plan-view-phases") {
        setViewMode("hub");
        loadHubData();
      } else if (action === "phase-select-version") {
        selectedVersionId = target.getAttribute("data-id");
        render();
      } else if (action === "phase-apply-tree") {
        applyTreeProposal();
      } else if (action === "phase-ai-generate") {
        generateAiPlanProposal();
      } else if (action === "phase-edit-draft") {
        beginEditDraftVersion(target.getAttribute("data-id"));
      } else if (action === "phase-save-draft") {
        saveDraftVersion();
      } else if (action === "phase-cancel-edit") {
        editingDraftVersionId = null;
        draftPhaseForms = [];
        setViewMode("phases");
        render();
      } else if (action === "phase-confirm") {
        confirmPlanVersion(target.getAttribute("data-id"));
      } else if (action === "phase-revise") {
        revisePlanVersion(target.getAttribute("data-id"));
      } else if (action === "daily-regenerate") {
        regenerateDailyToday();
      } else if (action === "daily-open-chat") {
        openDailyChat("");
      } else if (action === "daily-open-conversation") {
        openDailyChat(target.getAttribute("data-conversation-id"));
      } else if (action === "daily-close") {
        closeDailyToday();
      } else if (action === "daily-cycle-task") {
        updateDailyTaskStatus(
          target.getAttribute("data-task-id"),
          target.getAttribute("data-next-status")
        );
      } else if (action === "daily-decide-suggestion") {
        decideSuggestion(
          target.getAttribute("data-suggestion-id"),
          target.getAttribute("data-decision")
        );
      } else if (action === "daily-submit-decisions") {
        submitSummaryDecisions();
      } else if (action === "toggle-project-settings") {
        showProjectSettings = !showProjectSettings;
        render();
      } else if (action === "submit-project-settings") {
        submitProjectSettings();
      } else if (action === "select-plan") {
        selectedId = target.getAttribute("data-id");
        render();
      } else if (action === "activate-plan") {
        updatePlanStatus(target.getAttribute("data-id"), "active");
      } else if (action === "cycle-task") {
        cycleTaskStatus(target.getAttribute("data-plan-id"), target.getAttribute("data-task-id"));
      } else if (action === "submit-create-plan") {
        submitCreatePlan();
      } else if (action === "submit-edit-plan") {
        submitEditPlan();
      } else if (action === "submit-save-tasks") {
        submitSaveTasks();
      } else if (action === "add-plan-day") {
        addDayToDraft();
      } else if (action === "remove-plan-day") {
        removeDayFromDraft(parseInt(target.getAttribute("data-day-index") || "-1", 10));
      } else if (action === "add-plan-task") {
        addTaskToDay(parseInt(target.getAttribute("data-day-index") || "-1", 10));
      } else if (action === "remove-plan-task") {
        removeTaskFromDay(
          parseInt(target.getAttribute("data-day-index") || "-1", 10),
          parseInt(target.getAttribute("data-task-index") || "-1", 10)
        );
      } else if (action === "start-delete-plan") {
        pendingDeletePlanId = target.getAttribute("data-id");
        render();
      } else if (action === "cancel-delete-plan") {
        pendingDeletePlanId = null;
        render();
      } else if (action === "confirm-delete-plan") {
        confirmDeletePlan(target.getAttribute("data-id"));
      }
    });
  }

  function createTaskId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return "task_" + crypto.randomUUID();
    }
    return "task_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function emptyDay(dayNum) {
    return {
      day: dayNum,
      title: "第 " + dayNum + " 天",
      tasks: [],
    };
  }

  function emptyTask() {
    return {
      id: createTaskId(),
      title: "",
      type: "read_material",
      materialId: "",
      status: "todo",
    };
  }

  function cloneDays(days) {
    return (days || []).map(function (day) {
      return {
        day: day.day,
        title: day.title,
        tasks: (day.tasks || []).map(function (task) {
          return {
            id: task.id,
            title: task.title,
            type: task.type,
            materialId: task.materialId || "",
            skillId: task.skillId || "",
            status: task.status || "todo",
          };
        }),
      };
    });
  }

  function setViewMode(mode) {
    if (viewMode === "timetable" && mode !== "timetable") {
      leaveTimetableView();
    }
    viewMode = mode;
    pendingDeletePlanId = null;
    clearBanner();
  }

  function setBanner(type, message) {
    banner = { type: type, message: message };
  }

  function clearBanner() {
    banner = { type: "", message: "" };
  }

  function renderBanner() {
    if (!banner.message) return "";
    return (
      '<div class="module-banner module-banner--' +
      api.escapeAttr(banner.type || "info") +
      '" role="status">' +
      api.escapeHtml(banner.message) +
      "</div>"
    );
  }

  function leaveTimetableView() {
    if (window.EduTowerTimetable && typeof window.EduTowerTimetable.unmount === "function") {
      window.EduTowerTimetable.unmount();
    }
  }

  function renderSubnav() {
    if (viewMode === "create" || viewMode === "edit" || viewMode === "tasks") {
      return (
        '<nav class="module-subnav" aria-label="计划视图">' +
        '<button type="button" class="module-subnav__item" data-action="plan-view-hub">← 返回今日学习</button>' +
        '<span class="module-subnav__hint">' +
        (viewMode === "create"
          ? "新建手动课表"
          : viewMode === "edit"
            ? "编辑计划信息"
            : "编辑手动课表") +
        "</span></nav>"
      );
    }

    return (
      '<nav class="module-subnav" aria-label="计划视图">' +
      '<button type="button" class="module-subnav__item' +
      (viewMode === "hub" ? " module-subnav__item--active" : "") +
      '" data-action="plan-view-hub">今日学习</button>' +
      '<button type="button" class="module-subnav__item' +
      (viewMode === "timetable" ? " module-subnav__item--active" : "") +
      '" data-action="plan-view-timetable">平日课表</button>' +
      '<button type="button" class="module-subnav__item' +
      (viewMode === "advanced" ? " module-subnav__item--active" : "") +
      '" data-action="plan-view-advanced">手动课表</button>' +
      "</nav>"
    );
  }

  function getActivePlan() {
    return (
      plans.find(function (p) {
        return p.status === "active";
      }) || getSelectedPlan()
    );
  }

  function formatDeadlineInputValue(value) {
    if (!value || typeof value !== "string") return "";
    var match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    return match ? match[1] : "";
  }

  async function fetchDailyTodayRecord(projectId, options) {
    var ensure = options && options.ensure;

    if (ensure) {
      return api.post("/api/daily/" + encodeURIComponent(projectId) + "/today", {});
    }

    var record = await api.get("/api/daily/" + encodeURIComponent(projectId) + "/today");
    // 学习单已关闭/终结 → 重新开启（POST 触发后端 resetSheet）
    if (record && record.sheet && record.sheet.id) {
      var closedStatuses = ["completed", "forced_closed", "awaiting_confirmation"];
      if (closedStatuses.indexOf(record.sheet.status) !== -1) {
        return api.post("/api/daily/" + encodeURIComponent(projectId) + "/today", {});
      }
    }
    if (!record || !record.sheet || !record.sheet.id) {
      return api.post("/api/daily/" + encodeURIComponent(projectId) + "/today", {});
    }

    return record;
  }

  function getProjectId() {
    var active = getActivePlan();
    return active ? active.id : "";
  }

  async function loadMaterials() {
    try {
      var data = await api.get("/api/materials");
      materials = data && Array.isArray(data.items) ? data.items : [];
    } catch (_err) {
      materials = [];
    }

    try {
      var model = window.EduTowerSkillsModel;
      var projectId = getProjectId();
      var query = model
        ? model.buildTreeQuery({ projectId: projectId || undefined })
        : projectId
          ? "?projectId=" + encodeURIComponent(projectId)
          : "";
      var skillData = await api.get("/api/skills/tree" + query);
      if (model) {
        var normalized = model.normalizeTreeResponse(skillData);
        skills = normalized.flatSkills;
        dependencyEdges = normalized.dependencyEdges;
      } else {
        skills = skillData && Array.isArray(skillData.items) ? skillData.items : [];
        dependencyEdges =
          skillData && Array.isArray(skillData.dependencyEdges) ? skillData.dependencyEdges : [];
      }
    } catch (_err) {
      skills = [];
      dependencyEdges = [];
    }
  }

  function skillOptions(selectedId) {
    var model = window.EduTowerSkillsModel;
    return (
      '<option value="">不关联技能</option>' +
      skills
        .map(function (s) {
          var label = model ? model.formatSkillOptionLabel(s) : s.title;
          var disabled = s.isUnlocked === false ? " disabled" : "";
          return (
            '<option value="' +
            api.escapeAttr(s.id) +
            '"' +
            (selectedId === s.id ? " selected" : "") +
            disabled +
            ">" +
            api.escapeHtml(label) +
            "</option>"
          );
        })
        .join("")
    );
  }

  async function refresh() {
    rootEl.innerHTML = '<p class="module-empty module-empty--loading">正在加载学习计划…</p>';

    try {
      await loadMaterials();
      var data = await api.get("/api/plan");
      plans = data && Array.isArray(data.items) ? data.items : [];
      if (!selectedId && plans.length) {
        selectedId = plans[0].id;
      }
      if (viewMode === "hub" || viewMode === "today" || viewMode === "phases") {
        viewMode = "hub";
        await loadPlanPhaseMeta();
        render();
        await syncDailyRecord();
        render();
      } else {
        render();
      }
    } catch (err) {
      rootEl.innerHTML =
        renderSubnav() +
        '<p class="module-empty module-empty--error">加载失败：' +
        api.escapeHtml(api.networkError(err)) +
        "</p>";
    }
  }

  async function loadPlanPhaseMeta() {
    var projectId = getProjectId();
    if (!projectId) {
      planVersions = [];
      currentPlanVersion = null;
      return;
    }

    try {
      var versionsData = await api.get(
        "/api/plan/" + encodeURIComponent(projectId) + "/versions"
      );
      planVersions =
        versionsData && Array.isArray(versionsData.items) ? versionsData.items : [];

      try {
        currentPlanVersion = await api.get(
          "/api/plan/" + encodeURIComponent(projectId) + "/versions/current"
        );
      } catch (_err) {
        currentPlanVersion = null;
      }

      if (!selectedVersionId && planVersions.length) {
        selectedVersionId = currentPlanVersion
          ? currentPlanVersion.id
          : planVersions[0].id;
      }
    } catch (_err) {
      planVersions = [];
      currentPlanVersion = null;
    }
  }

  function readDailyConvMap() {
    try {
      var raw = localStorage.getItem(DAILY_CONV_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_err) {
      return {};
    }
  }

  function writeDailyConvMap(map) {
    localStorage.setItem(DAILY_CONV_STORAGE_KEY, JSON.stringify(map));
  }

  function dailyConvCacheKey(projectId, localDate) {
    return projectId + "|" + localDate;
  }

  async function ensureTodayConversation() {
    var projectId = getProjectId();
    var sheet = dailyRecord && dailyRecord.sheet ? dailyRecord.sheet : null;
    if (!projectId || !sheet || !sheet.localDate) {
      return null;
    }

    if (sheet.status !== "active" && sheet.status !== "generating") {
      return null;
    }

    var cacheKey = dailyConvCacheKey(projectId, sheet.localDate);
    var map = readDailyConvMap();
    var cachedId = map[cacheKey];
    var serverConv = null;

    if (dailyRecord.conversations && dailyRecord.conversations.length) {
      serverConv = dailyRecord.conversations
        .filter(function (conversation) {
          return conversation.type === "project_study";
        })
        .sort(function (left, right) {
          return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
        })[0];
    }

    var conversationId = (serverConv && serverConv.id) || cachedId || null;

    if (!conversationId) {
      var title = "今日学习 " + sheet.localDate;
      var created = await api.post("/api/conversations", {
        projectId: projectId,
        type: "project_study",
        title: title,
      });
      conversationId = created && created.id ? created.id : null;
    }

    if (!conversationId) {
      return null;
    }

    map[cacheKey] = conversationId;
    writeDailyConvMap(map);

    if (
      window.EduTowerChat &&
      typeof window.EduTowerChat.activateStudyConversation === "function"
    ) {
      await window.EduTowerChat.activateStudyConversation({
        conversationId: conversationId,
        projectId: projectId,
        localDate: sheet.localDate,
        title: (serverConv && serverConv.title) || "今日学习 " + sheet.localDate,
      });
    }

    return conversationId;
  }

  async function syncDailyRecord(options) {
    var projectId = getProjectId();
    if (!projectId) return;

    try {
      dailyRecord = await fetchDailyTodayRecord(projectId, options);
      try {
        await ensureTodayConversation();
      } catch (_convErr) {
        /* 子对话绑定失败不阻断今日任务 */
      }
    } catch (err) {
      setBanner("error", "同步今日任务失败：" + api.networkError(err));
    }
  }

  async function loadProjectSetup() {
    try {
      projectSetup = await api.get("/api/projects/current");
    } catch (_err) {
      projectSetup = null;
    }
  }

  function getProjectSettingsView() {
    var plan = getActivePlan();
    if (!plan) return null;
    return {
      goal: (projectSetup && projectSetup.goal) || plan.goal || "",
      deadline:
        (projectSetup && projectSetup.deadline) || plan.deadline || null,
      dailyMinutes:
        projectSetup && projectSetup.dailyMinutes != null
          ? projectSetup.dailyMinutes
          : plan.dailyMinutes != null
            ? plan.dailyMinutes
            : 60,
      targetScore:
        (projectSetup && projectSetup.targetScore) || plan.targetScore || "",
      goalConfirmedAt:
        (projectSetup && projectSetup.goalConfirmedAt) || plan.goalConfirmedAt || null,
    };
  }

  async function loadSheetHistory() {
    var projectId = getProjectId();
    if (!projectId) {
      sheetHistory = [];
      return;
    }

    try {
      var data = await api.get(
        "/api/daily/" + encodeURIComponent(projectId) + "/sheets?limit=14"
      );
      sheetHistory = data && Array.isArray(data.items) ? data.items : [];
    } catch (_err) {
      sheetHistory = [];
    }
  }

  async function loadHubData(showLoading) {
    if (showLoading !== false) {
      isBusy = true;
      clearBanner();
    }

    try {
      await loadPlanPhaseMeta();
      await loadProjectSetup();
      await loadSheetHistory();
      render();
      await syncDailyRecord();
      render();
    } catch (err) {
      setBanner("error", "加载失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  function getSelectedPlan() {
    return plans.find(function (plan) {
      return plan.id === selectedId;
    });
  }

  function materialOptions(selectedId) {
    var html =
      '<option value="">不关联资料</option>' +
      materials
        .map(function (m) {
          return (
            '<option value="' +
            api.escapeAttr(m.id) +
            '"' +
            (selectedId === m.id ? " selected" : "") +
            ">" +
            api.escapeHtml(m.title) +
            "</option>"
          );
        })
        .join("");
    return html;
  }

  function taskTypeOptions(selected) {
    return Object.keys(TASK_TYPE_LABEL)
      .map(function (key) {
        return (
          '<option value="' +
          api.escapeAttr(key) +
          '"' +
          (selected === key ? " selected" : "") +
          ">" +
          api.escapeHtml(TASK_TYPE_LABEL[key]) +
          "</option>"
        );
      })
      .join("");
  }

  function renderTaskEditorRow(task, dayIndex, taskIndex, readOnly) {
    if (readOnly) return "";

    return (
      '<div class="plan-task-editor__row" data-day-index="' +
      dayIndex +
      '" data-task-index="' +
      taskIndex +
      '">' +
      '<input type="hidden" data-field="task-id" value="' +
      api.escapeAttr(task.id || "") +
      '" />' +
      '<input type="hidden" data-field="task-status" value="' +
      api.escapeAttr(task.status || "todo") +
      '" />' +
      '<input class="form-input form-input--compact plan-task-editor__title" type="text" data-field="task-title" value="' +
      api.escapeAttr(task.title) +
      '" placeholder="任务名称" maxlength="120" />' +
      '<select class="form-input form-input--compact" data-field="task-type" aria-label="任务类型">' +
      taskTypeOptions(task.type) +
      "</select>" +
      '<select class="form-input form-input--compact" data-field="task-material" aria-label="关联资料">' +
      materialOptions(task.materialId || "") +
      "</select>" +
      '<select class="form-input form-input--compact" data-field="task-skill" aria-label="关联技能">' +
      skillOptions(task.skillId || "") +
      "</select>" +
      '<button type="button" class="btn btn--ghost btn--compact plan-task-editor__remove" data-action="remove-plan-task" data-day-index="' +
      dayIndex +
      '" data-task-index="' +
      taskIndex +
      '" aria-label="删除任务">×</button></div>'
    );
  }

  function renderDaysEditor(days, readOnly) {
    if (!days.length) {
      return '<p class="module-empty module-empty--inline">暂无日程，点击下方添加第一天。</p>';
    }

    return days
      .map(function (day, dayIndex) {
        var tasksHtml = (day.tasks || [])
          .map(function (task, taskIndex) {
            return renderTaskEditorRow(task, dayIndex, taskIndex, readOnly);
          })
          .join("");

        return (
          '<article class="plan-day-editor" data-day-index="' +
          dayIndex +
          '">' +
          '<div class="plan-day-editor__header">' +
          '<label class="plan-day-editor__label">第</label>' +
          '<input class="form-input form-input--compact plan-day-editor__day-num" type="number" min="1" max="365" data-field="day-num" value="' +
          api.escapeAttr(String(day.day)) +
          '" />' +
          '<label class="plan-day-editor__label">天标题</label>' +
          '<input class="form-input form-input--compact plan-day-editor__day-title" type="text" data-field="day-title" value="' +
          api.escapeAttr(day.title) +
          '" placeholder="例如：基础巩固" />' +
          (readOnly
            ? ""
            : '<button type="button" class="btn btn--ghost btn--compact module-danger-btn" data-action="remove-plan-day" data-day-index="' +
              dayIndex +
              '">删除本天</button>') +
          "</div>" +
          '<div class="plan-task-editor">' +
          tasksHtml +
          (readOnly
            ? ""
            : '<button type="button" class="btn btn--ghost btn--compact" data-action="add-plan-task" data-day-index="' +
              dayIndex +
              '">+ 添加任务</button>') +
          "</div></article>"
        );
      })
      .join("");
  }

  function collectDaysFromDom() {
    var editorRoot = rootEl.querySelector(".plan-days-editor");
    if (!editorRoot) return [];

    var dayArticles = editorRoot.querySelectorAll(".plan-day-editor");
    var days = [];

    dayArticles.forEach(function (article) {
      var dayNumInput = article.querySelector("[data-field='day-num']");
      var dayTitleInput = article.querySelector("[data-field='day-title']");
      var dayNum = parseInt(dayNumInput && dayNumInput.value ? dayNumInput.value : "1", 10);
      var dayTitle =
        dayTitleInput && dayTitleInput.value.trim()
          ? dayTitleInput.value.trim()
          : "第 " + dayNum + " 天";

      var tasks = [];
      article.querySelectorAll(".plan-task-editor__row").forEach(function (row) {
        var idInput = row.querySelector("[data-field='task-id']");
        var statusInput = row.querySelector("[data-field='task-status']");
        var titleInput = row.querySelector("[data-field='task-title']");
        var typeSelect = row.querySelector("[data-field='task-type']");
        var materialSelect = row.querySelector("[data-field='task-material']");
        var skillSelect = row.querySelector("[data-field='task-skill']");
        var title = titleInput ? titleInput.value.trim() : "";
        if (!title) return;

        var task = {
          id: idInput && idInput.value.trim() ? idInput.value.trim() : createTaskId(),
          title: title,
          type: typeSelect ? typeSelect.value : "read_material",
          status: statusInput && statusInput.value ? statusInput.value : "todo",
        };

        if (materialSelect && materialSelect.value) {
          task.materialId = materialSelect.value;
        }

        if (skillSelect && skillSelect.value) {
          task.skillId = skillSelect.value;
        }

        tasks.push(task);
      });

      days.push({
        day: Number.isFinite(dayNum) ? dayNum : 1,
        title: dayTitle,
        tasks: tasks,
      });
    });

    return days;
  }

  function collectMaterialIdsFromDays(days) {
    var ids = new Set();
    days.forEach(function (day) {
      (day.tasks || []).forEach(function (task) {
        if (task.materialId) ids.add(task.materialId);
      });
    });
    return Array.from(ids);
  }

  function renderCreateForm() {
    return (
      '<section class="module-mini-page">' +
      '<h2 class="module-mini-page__title">新建手动课表</h2>' +
      '<p class="module-mini-page__desc">可选功能：按「第几天」手动排任务。日常使用建议回到「今日学习」一键启用自动计划。</p>' +
      renderBanner() +
      '<div class="form-row"><label class="form-label" for="planCreateTitle">计划标题</label>' +
      '<input id="planCreateTitle" class="form-input" type="text" maxlength="120" placeholder="例如：期末数学复习" required /></div>' +
      '<div class="form-row"><label class="form-label" for="planCreateGoal">学习目标（可选）</label>' +
      '<textarea id="planCreateGoal" class="form-textarea" rows="3" placeholder="描述你想达成的目标…"></textarea></div>' +
      '<div class="form-row"><span class="form-label">每日任务</span>' +
      '<div class="plan-days-editor">' +
      renderDaysEditor(draftDays, false) +
      "</div>" +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="add-plan-day">+ 添加一天</button></div>' +
      '<div class="module-mini-page__actions">' +
      '<button type="button" class="btn btn--ghost" data-action="plan-view-advanced">取消</button>' +
      '<button type="button" class="btn btn--primary" data-action="submit-create-plan">创建计划</button></div></section>'
    );
  }

  function renderEditForm(plan) {
    var deleteBlock =
      pendingDeletePlanId === plan.id
        ? '<div class="module-inline-confirm">' +
          '<p>确定删除「' +
          api.escapeHtml(plan.title) +
          "」吗？关联任务将一并删除。</p>" +
          '<div class="module-inline-confirm__actions">' +
          '<button type="button" class="btn btn--primary btn--compact" data-action="confirm-delete-plan" data-id="' +
          api.escapeAttr(plan.id) +
          '">确认删除</button>' +
          '<button type="button" class="btn btn--ghost btn--compact" data-action="cancel-delete-plan">取消</button></div></div>'
        : '<button type="button" class="btn btn--ghost btn--compact module-danger-btn" data-action="start-delete-plan" data-id="' +
          api.escapeAttr(plan.id) +
          '">删除计划</button>';

    return (
      '<section class="module-mini-page">' +
      '<h2 class="module-mini-page__title">编辑学习计划</h2>' +
      renderBanner() +
      '<div class="form-row"><label class="form-label" for="planEditTitle">计划标题</label>' +
      '<input id="planEditTitle" class="form-input" type="text" maxlength="120" value="' +
      api.escapeAttr(plan.title) +
      '" required /></div>' +
      '<div class="form-row"><label class="form-label" for="planEditGoal">学习目标</label>' +
      '<textarea id="planEditGoal" class="form-textarea" rows="4">' +
      api.escapeHtml(plan.goal || "") +
      "</textarea></div>" +
      '<div class="plan-settings__row">' +
      '<div class="form-row"><label class="form-label" for="planEditDeadline">目标日期</label>' +
      '<input id="planEditDeadline" class="form-input" type="date" value="' +
      api.escapeAttr(formatDeadlineInputValue(plan.deadline)) +
      '" /></div>' +
      '<div class="form-row"><label class="form-label" for="planEditDailyMinutes">每日可用时长（分钟）</label>' +
      '<input id="planEditDailyMinutes" class="form-input" type="number" min="' +
      MIN_DAILY_MINUTES +
      '" max="' +
      MAX_DAILY_MINUTES +
      '" step="5" value="' +
      api.escapeAttr(
        plan.dailyMinutes != null && plan.dailyMinutes !== ""
          ? String(plan.dailyMinutes)
          : "60"
      ) +
      '" /></div></div>' +
      '<p class="module-mini-page__desc">任务安排请使用「管理任务」视图。</p>' +
      '<div class="module-mini-page__actions">' +
      '<button type="button" class="btn btn--ghost" data-action="plan-view-advanced">返回手动课表</button>' +
      '<button type="button" class="btn btn--ghost" data-action="plan-view-tasks">管理任务</button>' +
      deleteBlock +
      '<button type="button" class="btn btn--primary" data-action="submit-edit-plan">保存修改</button></div></section>'
    );
  }

  function renderTasksForm(plan) {
    return (
      '<section class="module-mini-page">' +
      '<h2 class="module-mini-page__title">管理任务 · ' +
      api.escapeHtml(plan.title) +
      "</h2>" +
      '<p class="module-mini-page__desc">为每一天添加学习任务，并关联资料库文件。保存后可在列表页切换任务状态。</p>' +
      renderBanner() +
      '<div class="plan-days-editor">' +
      renderDaysEditor(editingDays, false) +
      "</div>" +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="add-plan-day">+ 添加一天</button>' +
      '<div class="module-mini-page__actions">' +
      '<button type="button" class="btn btn--ghost" data-action="plan-view-advanced">返回手动课表</button>' +
      '<button type="button" class="btn btn--primary" data-action="submit-save-tasks">保存任务</button></div></section>'
    );
  }

  function nextDailyTaskStatus(current) {
    if (current === "todo") return "in_progress";
    if (current === "in_progress") return "done";
    return "todo";
  }

  function getCurrentPhasePreview() {
    if (!currentPlanVersion || !currentPlanVersion.phases || !currentPlanVersion.phases.length) {
      return null;
    }
    return currentPlanVersion.phases[0];
  }

  function renderDailyTasksHtml() {
    var sheet = dailyRecord && dailyRecord.sheet ? dailyRecord.sheet : null;
    var tasks = sheet && Array.isArray(sheet.tasks) ? sheet.tasks : [];

    return tasks
      .filter(function (task) {
        return task.status !== "cancelled";
      })
      .map(function (task) {
        var cls = "plan-task plan-task--" + (task.status || "todo");
        var nextStatus = nextDailyTaskStatus(task.status);
        var meta =
          api.escapeHtml(TASK_TYPE_LABEL[task.type] || task.type) +
          " · " +
          api.escapeHtml(TASK_STATUS_LABEL[task.status] || task.status);
        if (task.selectionReason) {
          meta += " · " + api.escapeHtml(task.selectionReason);
        }
        return (
          '<li class="' +
          cls +
          '">' +
          '<button type="button" class="plan-task__check" data-action="daily-cycle-task" data-task-id="' +
          api.escapeAttr(task.id) +
          '" data-next-status="' +
          api.escapeAttr(nextStatus) +
          '" aria-label="切换任务状态"></button>' +
          '<div class="plan-task__body">' +
          '<span class="plan-task__title">' +
          api.escapeHtml(task.title) +
          "</span>" +
          '<span class="plan-task__meta">' +
          meta +
          "</span></div></li>"
        );
      })
      .join("");
  }

  function renderOnboardingCard() {
    var draftVersion = planVersions.find(function (v) {
      return v.status === "draft";
    });

    if (draftVersion) {
      return (
        '<section class="plan-onboarding plan-onboarding--draft">' +
        '<h3 class="plan-onboarding__title">阶段计划草案已生成</h3>' +
        '<p class="plan-onboarding__desc">还差一步：确认后系统会按技能掌握度自动编排每日任务。</p>' +
        '<button type="button" class="btn btn--primary" data-action="phase-confirm" data-id="' +
        api.escapeAttr(draftVersion.id) +
        '"' +
        (isBusy ? " disabled" : "") +
        ">确认并启用</button></section>"
      );
    }

    return (
      '<section class="plan-onboarding">' +
      '<h3 class="plan-onboarding__title">一键启用学习计划</h3>' +
      '<p class="plan-onboarding__desc">系统会根据你的技能树自动生成阶段计划，并编排今天要学的任务。无需手动排课表。</p>' +
      '<ol class="plan-onboarding__steps">' +
      "<li>按技能树生成学习阶段</li>" +
      "<li>确认计划</li>" +
      "<li>开始今日学习</li>" +
      "</ol>" +
      '<div class="plan-onboarding__actions">' +
      '<button type="button" class="btn btn--primary" data-action="plan-quick-start"' +
      (isBusy ? " disabled" : "") +
      ">一键启用</button>" +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="phase-apply-tree"' +
      (isBusy ? " disabled" : "") +
      ">仅生成草案</button></div></section>"
    );
  }

  function renderPhaseStrip() {
    if (!currentPlanVersion) {
      return "";
    }

    var phase = getCurrentPhasePreview();
    var nodesHtml = "";
    if (phase && phase.knowledgeNodeIds && phase.knowledgeNodeIds.length) {
      nodesHtml =
        '<div class="plan-hub__phase-nodes">' +
        phase.knowledgeNodeIds
          .slice(0, 6)
          .map(function (nodeId) {
            return (
              '<span class="plan-phase__node">' + api.escapeHtml(skillTitleById(nodeId)) + "</span>"
            );
          })
          .join("") +
        (phase.knowledgeNodeIds.length > 6
          ? '<span class="plan-phase__node">+' + (phase.knowledgeNodeIds.length - 6) + "</span>"
          : "") +
        "</div>";
    }

    return (
      '<section class="plan-hub__phase">' +
      '<div class="plan-hub__phase-head">' +
      "<div>" +
      '<h3 class="plan-hub__phase-title">当前学习阶段</h3>' +
      '<p class="plan-today__meta">已启用 v' +
      currentPlanVersion.version +
      " · " +
      (phase ? api.escapeHtml(phase.title) : "按技能进度推进") +
      "</p>" +
      (phase && phase.goal
        ? '<p class="plan-hub__phase-goal">' + api.escapeHtml(phase.goal) + "</p>"
        : "") +
      "</div>" +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="phase-revise" data-id="' +
      api.escapeAttr(currentPlanVersion.id) +
      '"' +
      (isBusy ? " disabled" : "") +
      ">调整阶段</button></div>" +
      nodesHtml +
      "</section>"
    );
  }

  function renderProjectSettings(plan) {
    if (!plan) return "";

    var settings = getProjectSettingsView() || {
      goal: plan.goal || "",
      deadline: plan.deadline || null,
      dailyMinutes: plan.dailyMinutes != null ? plan.dailyMinutes : 60,
      targetScore: plan.targetScore || "",
      goalConfirmedAt: plan.goalConfirmedAt || null,
    };

    var settingsBody = showProjectSettings
      ? '<div class="plan-settings__body">' +
        '<div class="form-row"><label class="form-label" for="projectSettingsGoal">学习目标</label>' +
        '<textarea id="projectSettingsGoal" class="form-textarea" rows="3" placeholder="例如：期末数学达到 90 分">' +
        api.escapeHtml(settings.goal || "") +
        "</textarea></div>" +
        '<div class="plan-settings__row">' +
        '<div class="form-row"><label class="form-label" for="projectSettingsDeadline">目标日期</label>' +
        '<input id="projectSettingsDeadline" class="form-input" type="date" value="' +
        api.escapeAttr(formatDeadlineInputValue(settings.deadline)) +
        '" /></div>' +
        '<div class="form-row"><label class="form-label" for="projectSettingsTargetScore">目标分档</label>' +
        '<select id="projectSettingsTargetScore" class="form-input">' +
        '<option value="">未设置</option>' +
        '<option value="及格"' +
        (settings.targetScore === "及格" ? " selected" : "") +
        ">及格</option>" +
        '<option value="冲高分"' +
        (settings.targetScore === "冲高分" ? " selected" : "") +
        ">冲高分</option></select></div></div>' +
        '<div class="form-row"><label class="form-label" for="projectSettingsDailyMinutes">每日可用时长（分钟）</label>' +
        '<input id="projectSettingsDailyMinutes" class="form-input" type="number" min="' +
        MIN_DAILY_MINUTES +
        '" max="' +
        MAX_DAILY_MINUTES +
        '" step="5" value="' +
        api.escapeAttr(
          settings.dailyMinutes != null && settings.dailyMinutes !== ""
            ? String(settings.dailyMinutes)
            : "60"
        ) +
        '" /></div>' +
        '<p class="plan-settings__hint">每日时长会影响「今天要学什么」的任务编排上限（' +
        MIN_DAILY_MINUTES +
        "–" +
        MAX_DAILY_MINUTES +
        " 分钟）。修改后对新创建的学习单生效。</p>" +
        '<div class="plan-settings__actions">' +
        '<button type="button" class="btn btn--primary btn--compact" data-action="submit-project-settings"' +
        (isBusy ? " disabled" : "") +
        ">保存并确认目标</button></div></div>"
      : '<p class="plan-settings__summary">' +
        (settings.goal ? api.escapeHtml(settings.goal) : "尚未填写学习目标") +
        (settings.targetScore ? " · " + api.escapeHtml(settings.targetScore) : "") +
        " · 每日 " +
        (settings.dailyMinutes != null ? settings.dailyMinutes : 60) +
        " 分钟" +
        (settings.deadline
          ? " · 目标 " + api.escapeHtml(formatDeadlineInputValue(settings.deadline))
          : "") +
        (settings.goalConfirmedAt ? " · 目标已确认" : "") +
        "</p>";

    return (
      '<section class="plan-settings">' +
      '<header class="plan-settings__header">' +
      "<div><h3 class=\"plan-settings__title\">项目设置</h3>" +
      '<p class="plan-settings__meta">目标、截止日期与每日学习时长</p></div>' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="toggle-project-settings">' +
      (showProjectSettings ? "收起" : "编辑") +
      "</button></header>" +
      settingsBody +
      "</section>"
    );
  }

  function renderSheetHistory() {
    if (!sheetHistory.length) return "";

    var items = sheetHistory
      .map(function (entry) {
        var sheet = entry && entry.sheet ? entry.sheet : null;
        var summary = entry && entry.summary ? entry.summary : null;
        if (!sheet) return "";

        var statusLabel =
          sheet.status === "closed"
            ? "已结束"
            : sheet.status === "forced_closed"
              ? "系统结束"
              : sheet.status === "active"
                ? "进行中"
                : sheet.status || "未知";
        var summaryText =
          summary && (summary.confirmedContent || summary.aiDraft)
            ? summary.confirmedContent || summary.aiDraft
            : "";

        return (
          '<li class="plan-history-item">' +
          '<div class="plan-history-item__body">' +
          '<strong class="plan-history-item__date">' +
          api.escapeHtml(sheet.localDate || "未知日期") +
          "</strong>" +
          '<span class="plan-history-item__meta">' +
          api.escapeHtml(statusLabel) +
          " · " +
          (Array.isArray(sheet.tasks) ? sheet.tasks.length : 0) +
          " 项任务</span>" +
          (summaryText
            ? '<p class="plan-history-item__summary">' + api.escapeHtml(summaryText) + "</p>"
            : "") +
          "</div></li>"
        );
      })
      .filter(Boolean)
      .join("");

    if (!items) return "";

    return (
      '<section class="plan-history">' +
      '<h3 class="plan-history__title">最近学习记录</h3>' +
      '<ul class="plan-history-list">' +
      items +
      "</ul></section>"
    );
  }

  function renderHub() {
    var projectId = getProjectId();
    if (!projectId) {
      return (
        renderSubnav() +
        renderBanner() +
        '<p class="module-empty">暂无学习项目。请先在「手动课表」中新建计划。</p>'
      );
    }

    var sheet = dailyRecord && dailyRecord.sheet ? dailyRecord.sheet : null;
    var summary = dailyRecord && dailyRecord.summary ? dailyRecord.summary : null;
    var activePlan = getActivePlan();
    var tasksHtml = renderDailyTasksHtml();
    var sheetMeta = sheet
      ? "今天 · " +
        api.escapeHtml(sheet.localDate) +
        " · 可用 " +
        sheet.availableMinutes +
        " 分钟"
      : "正在同步今日任务…";

    var emptyTasksHint = currentPlanVersion
      ? "今日暂无任务。可点击下方「重新编排」，或先去练习/错题本积累学习信号。"
      : "启用学习计划后，这里会显示今天要完成的任务。";

    return (
      renderSubnav() +
      renderBanner() +
      '<section class="plan-hub">' +
      renderProjectSettings(activePlan) +
      (!currentPlanVersion ? renderOnboardingCard() : renderPhaseStrip()) +
      '<section class="plan-hub__today">' +
      '<header class="plan-detail__header">' +
      "<div>" +
      '<h2 class="plan-detail__title">今天要学什么</h2>' +
      '<p class="plan-today__meta">' +
      sheetMeta +
      "</p></div>" +
      '<div class="plan-detail__actions">' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="daily-open-chat"' +
      (isBusy ? " disabled" : "") +
      ">去 AI 答疑</button>" +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="daily-regenerate"' +
      (isBusy ? " disabled" : "") +
      ">重新编排</button>" +
      '<button type="button" class="btn btn--primary btn--compact" data-action="daily-close"' +
      (isBusy ? " disabled" : "") +
      ">结束今日学习</button></div></header>" +
      '<ul class="plan-task-list">' +
      (tasksHtml || '<li class="module-empty module-empty--inline">' + emptyTasksHint + "</li>") +
      "</ul>" +
      renderTodayConversations(dailyRecord && dailyRecord.conversations ? dailyRecord.conversations : []) +
      (summary && summary.aiDraft
        ? '<section class="plan-today-summary">' +
          '<h3 class="plan-day__title">今日总结</h3>' +
          (summary.status === "awaiting_confirmation"
            ? '<p class="plan-settings__hint">AI 已生成总结，可在提交建议前微调正文。</p>' +
              '<textarea id="dailySummaryEdit" class="form-textarea" rows="6">' +
              api.escapeHtml(summary.confirmedContent || summary.aiDraft) +
              "</textarea>"
            : '<p class="plan-today-summary__text">' +
              api.escapeHtml(summary.confirmedContent || summary.aiDraft) +
              "</p>") +
          "</section>"
        : "") +
      renderSummaryDecisions(summary) +
      renderSheetHistory() +
      "</section></section>"
    );
  }

  async function submitProjectSettings() {
    if (isBusy) return;

    var plan = getActivePlan();
    if (!plan) return;

    var goalInput = document.getElementById("projectSettingsGoal");
    var deadlineInput = document.getElementById("projectSettingsDeadline");
    var minutesInput = document.getElementById("projectSettingsDailyMinutes");
    var targetScoreInput = document.getElementById("projectSettingsTargetScore");
    var goal = goalInput ? goalInput.value.trim() : "";
    var deadline = deadlineInput ? deadlineInput.value.trim() : "";
    var targetScore = targetScoreInput ? targetScoreInput.value.trim() : "";
    var dailyMinutesRaw = minutesInput ? minutesInput.value.trim() : "";
    var dailyMinutes = dailyMinutesRaw ? parseInt(dailyMinutesRaw, 10) : null;

    if (
      dailyMinutes !== null &&
      (!Number.isFinite(dailyMinutes) ||
        dailyMinutes < MIN_DAILY_MINUTES ||
        dailyMinutes > MAX_DAILY_MINUTES)
    ) {
      setBanner(
        "error",
        "每日时长需在 " + MIN_DAILY_MINUTES + "–" + MAX_DAILY_MINUTES + " 分钟之间。"
      );
      render();
      return;
    }

    isBusy = true;
    clearBanner();

    try {
      projectSetup = await api.patch("/api/projects/current", {
        goal: goal,
        deadline: deadline || null,
        dailyMinutes: dailyMinutes,
        targetScore: targetScore || null,
        goalConfirmed: true,
      });
      var data = await api.get("/api/plan");
      plans = data && Array.isArray(data.items) ? data.items : [];
      showProjectSettings = false;
      setBanner("success", "项目设置已保存。");
      render();
    } catch (err) {
      setBanner("error", "保存失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function loadDailyToday() {
    viewMode = "hub";
    await loadHubData();
  }

  async function regenerateDailyToday() {
    var projectId = getProjectId();
    if (!projectId || isBusy) return;

    isBusy = true;
    clearBanner();
    try {
      dailyRecord = await api.post(
        "/api/daily/" + encodeURIComponent(projectId) + "/today/regenerate",
        {}
      );
      setBanner("success", "已重排今日未完成任务。");
      render();
    } catch (err) {
      setBanner("error", "重排失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  function renderTodayConversations(conversations) {
    if (!conversations || !conversations.length) {
      return "";
    }

    var items = conversations
      .map(function (conversation) {
        return (
          '<li class="plan-today-conversation">' +
          '<span class="module-badge">' +
          api.escapeHtml(conversation.type === "project_study" ? "今日学习" : conversation.type) +
          "</span>" +
          '<span class="plan-today-conversation__title">' +
          api.escapeHtml(conversation.title || "学习对话") +
          "</span>" +
          '<span class="plan-today-conversation__meta">' +
          conversation.messageCount +
          " 条消息</span>" +
          '<button type="button" class="btn btn--ghost btn--compact" data-action="daily-open-conversation" data-conversation-id="' +
          api.escapeAttr(conversation.id) +
          '">查看对话</button></li>'
        );
      })
      .join("");

    return (
      '<section class="plan-today-conversations">' +
      '<h3 class="plan-day__title">今日学习对话</h3>' +
      '<ul class="plan-today-conversation-list">' +
      items +
      "</ul></section>"
    );
  }

  async function openDailyChat(conversationId) {
    if (isBusy) return;

    isBusy = true;
    clearBanner();
    try {
      if (conversationId) {
        var projectId = getProjectId();
        var sheet = dailyRecord && dailyRecord.sheet ? dailyRecord.sheet : null;
        if (
          window.EduTowerChat &&
          typeof window.EduTowerChat.activateStudyConversation === "function"
        ) {
          await window.EduTowerChat.activateStudyConversation({
            conversationId: conversationId,
            projectId: projectId,
            localDate: sheet ? sheet.localDate : null,
            title: "今日学习对话",
          });
        }
      } else {
        await ensureTodayConversation();
      }

      if (window.EduTowerShell && typeof window.EduTowerShell.switchView === "function") {
        window.EduTowerShell.switchView("chat");
      }
    } catch (err) {
      setBanner("error", "打开学习对话失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function closeDailyToday() {
    var projectId = getProjectId();
    if (!projectId || isBusy) return;

    isBusy = true;
    clearBanner();
    try {
      dailyRecord = await api.post(
        "/api/daily/" + encodeURIComponent(projectId) + "/today/close",
        {}
      );
      if (
        window.EduTowerChat &&
        typeof window.EduTowerChat.clearStudyConversation === "function"
      ) {
        window.EduTowerChat.clearStudyConversation();
      }
      suggestionDecisions = {};
      var needsConfirm =
        dailyRecord &&
        dailyRecord.summary &&
        dailyRecord.summary.status === "awaiting_confirmation";
      setBanner(
        "success",
        needsConfirm
          ? "今日学习已结束，请确认下方 AI 建议后提交。"
          : "今日学习已结束，AI 总结已生成。"
      );
      render();
    } catch (err) {
      setBanner("error", "结束失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  var SUGGESTION_TYPE_LABEL = {
    knowledge_status: "掌握度",
    weakness: "薄弱点",
    weakness_resolved: "建议解决",
    review_suggestion: "复习建议",
  };

  var VERSION_STATUS_LABEL = {
    draft: "草案",
    confirmed: "已确认",
    superseded: "已替代",
  };

  function renderSummaryDecisions(summary) {
    if (!summary || summary.status !== "awaiting_confirmation") return "";

    var pending = (summary.suggestions || []).filter(function (s) {
      return s.status === "pending";
    });
    if (!pending.length) return "";

    var itemsHtml = pending
      .map(function (suggestion) {
        var decided = suggestionDecisions[suggestion.id];
        var decidedLabel = "";
        if (decided === "accept") decidedLabel = " · 已选：采纳";
        if (decided === "reject") decidedLabel = " · 已选：拒绝";
        var skillTitle = "";
        if (suggestion.knowledgeNodeId) {
          var model = window.EduTowerSkillsModel;
          skillTitle = model
            ? model.findSkillTitle(skills, suggestion.knowledgeNodeId)
            : suggestion.knowledgeNodeId;
        }

        return (
          '<li class="plan-suggestion">' +
          '<div class="plan-suggestion__header">' +
          '<span class="module-badge">' +
          api.escapeHtml(SUGGESTION_TYPE_LABEL[suggestion.type] || suggestion.type) +
          "</span>" +
          (skillTitle
            ? '<span class="plan-suggestion__skill">' + api.escapeHtml(skillTitle) + "</span>"
            : "") +
          "</div>" +
          '<p class="plan-suggestion__content">' +
          api.escapeHtml(suggestion.content) +
          decidedLabel +
          "</p>" +
          '<div class="plan-suggestion__actions">' +
          '<button type="button" class="btn btn--ghost btn--compact' +
          (decided === "accept" ? " btn--primary" : "") +
          '" data-action="daily-decide-suggestion" data-suggestion-id="' +
          api.escapeAttr(suggestion.id) +
          '" data-decision="accept">采纳</button>' +
          '<button type="button" class="btn btn--ghost btn--compact' +
          (decided === "reject" ? " btn--primary" : "") +
          '" data-action="daily-decide-suggestion" data-suggestion-id="' +
          api.escapeAttr(suggestion.id) +
          '" data-decision="reject">拒绝</button></div></li>'
        );
      })
      .join("");

    var allDecided = pending.every(function (s) {
      return suggestionDecisions[s.id] === "accept" || suggestionDecisions[s.id] === "reject";
    });

    return (
      '<section class="plan-suggestions">' +
      '<h3 class="plan-day__title">待确认建议</h3>' +
      '<p class="module-intro">结束今日学习后，请逐条确认 AI 生成的掌握度与复习建议。</p>' +
      '<ul class="plan-suggestion-list">' +
      itemsHtml +
      "</ul>" +
      '<button type="button" class="btn btn--primary btn--compact" data-action="daily-submit-decisions"' +
      (isBusy || !allDecided ? " disabled" : "") +
      ">提交确认</button></section>"
    );
  }

  function decideSuggestion(suggestionId, decision) {
    if (!suggestionId || !decision) return;
    suggestionDecisions[suggestionId] = decision;
    render();
  }

  async function submitSummaryDecisions() {
    var projectId = getProjectId();
    var summary =
      dailyRecord && dailyRecord.summary ? dailyRecord.summary : null;
    if (!projectId || !summary || isBusy) return;

    var pending = (summary.suggestions || []).filter(function (s) {
      return s.status === "pending";
    });
    var decisions = pending
      .map(function (s) {
        var action = suggestionDecisions[s.id];
        if (action !== "accept" && action !== "reject") return null;
        return { suggestionId: s.id, action: action };
      })
      .filter(Boolean);

    if (!decisions.length || decisions.length !== pending.length) {
      setBanner("error", "请先为每条建议选择采纳或拒绝。");
      render();
      return;
    }

    isBusy = true;
    clearBanner();
    try {
      var summaryEdit = document.getElementById("dailySummaryEdit");
      var confirmedContent =
        summaryEdit && summaryEdit.value.trim()
          ? summaryEdit.value.trim()
          : summary.confirmedContent || summary.aiDraft || undefined;

      var result = await api.post(
        "/api/daily/" +
          encodeURIComponent(projectId) +
          "/summaries/" +
          encodeURIComponent(summary.id) +
          "/decisions",
        {
          decisions: decisions,
          confirmedContent: confirmedContent,
        }
      );
      suggestionDecisions = {};
      dailyRecord = {
        sheet: result.sheet,
        summary: result.summary,
        conversations: dailyRecord ? dailyRecord.conversations : [],
      };
      setBanner("success", "建议已确认，今日学习已完结。");
      render();
    } catch (err) {
      setBanner("error", "提交失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  function skillTitleById(id) {
    var model = window.EduTowerSkillsModel;
    return model ? model.findSkillTitle(skills, id) : id;
  }

  function renderPhases() {
    var projectId = getProjectId();
    if (!projectId) {
      return (
        renderSubnav() +
        renderBanner() +
        '<p class="module-empty">请先创建或选择一个学习计划项目。</p>'
      );
    }

    var selected =
      planVersions.find(function (v) {
        return v.id === selectedVersionId;
      }) ||
      currentPlanVersion ||
      planVersions[0] ||
      null;

    var versionTabs = planVersions
      .map(function (version) {
        var active = selected && version.id === selected.id ? " plan-tab--active" : "";
        return (
          '<button type="button" class="plan-tab' +
          active +
          '" data-action="phase-select-version" data-id="' +
          api.escapeAttr(version.id) +
          '">v' +
          version.version +
          " · " +
          api.escapeHtml(VERSION_STATUS_LABEL[version.status] || version.status) +
          "</button>"
        );
      })
      .join("");

    var phasesHtml = "";
    if (selected && selected.phases && selected.phases.length) {
      phasesHtml = selected.phases
        .map(function (phase, index) {
          var nodesHtml = (phase.knowledgeNodeIds || [])
            .map(function (nodeId) {
              return (
                '<span class="plan-phase__node">' + api.escapeHtml(skillTitleById(nodeId)) + "</span>"
              );
            })
            .join("");
          return (
            '<article class="plan-phase-card">' +
            '<h3 class="plan-phase-card__title">阶段 ' +
            (index + 1) +
            " · " +
            api.escapeHtml(phase.title) +
            "</h3>" +
            '<p class="plan-phase-card__goal">' +
            api.escapeHtml(phase.goal) +
            "</p>" +
            (phase.description
              ? '<p class="plan-phase-card__desc">' + api.escapeHtml(phase.description) + "</p>"
              : "") +
            (phase.completionCriteria
              ? '<p class="plan-phase-card__criteria">完成标准：' +
                api.escapeHtml(phase.completionCriteria) +
                "</p>"
              : "") +
            (nodesHtml
              ? '<div class="plan-phase-card__nodes">' + nodesHtml + "</div>"
              : '<p class="module-empty module-empty--inline">未关联技能节点</p>') +
            "</article>"
          );
        })
        .join("");
    } else {
      phasesHtml =
        '<p class="module-empty">暂无阶段计划。可从技能树一键生成草案，确认后每日任务将据此编排。</p>';
    }

    var actionHtml = "";
    if (selected) {
      if (selected.status === "draft") {
        actionHtml +=
          '<button type="button" class="btn btn--ghost btn--compact" data-action="phase-edit-draft" data-id="' +
          api.escapeAttr(selected.id) +
          '"' +
          (isBusy ? " disabled" : "") +
          ">编辑草案</button>" +
          '<button type="button" class="btn btn--primary btn--compact" data-action="phase-confirm" data-id="' +
          api.escapeAttr(selected.id) +
          '"' +
          (isBusy ? " disabled" : "") +
          ">确认此版本</button>";
      } else if (selected.status === "confirmed") {
        actionHtml +=
          '<button type="button" class="btn btn--ghost btn--compact" data-action="phase-revise" data-id="' +
          api.escapeAttr(selected.id) +
          '"' +
          (isBusy ? " disabled" : "") +
          ">基于此版本修订</button>";
      }
    }

    return (
      renderSubnav() +
      renderBanner() +
      '<section class="plan-phases">' +
      '<header class="plan-detail__header">' +
      "<div>" +
      '<h2 class="plan-detail__title">阶段学习计划</h2>' +
      '<p class="module-intro">阶段计划驱动「今日学习」任务生成。需先确认一版阶段计划，系统才会按掌握度编排每日任务。</p>' +
      (currentPlanVersion
        ? '<p class="plan-today__meta">当前生效：v' +
          currentPlanVersion.version +
          "（" +
          api.escapeHtml(
            VERSION_STATUS_LABEL[currentPlanVersion.status] || currentPlanVersion.status
          ) +
          "）</p>"
        : '<p class="plan-today__meta">尚未确认阶段计划</p>') +
      "</div>" +
      '<div class="plan-detail__actions">' +
      '<button type="button" class="btn btn--primary btn--compact" data-action="phase-ai-generate"' +
      (isBusy ? " disabled" : "") +
      ">AI 生成计划</button>" +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="phase-apply-tree"' +
      (isBusy ? " disabled" : "") +
      ">从技能树生成草案</button>" +
      actionHtml +
      "</div></header>" +
      (versionTabs ? '<div class="plan-tabs" role="tablist">' + versionTabs + "</div>" : "") +
      '<div class="plan-phase-list">' +
      phasesHtml +
      "</div></section>"
    );
  }

  function buildProposalFromSkills() {
    var unlocked = skills.filter(function (skill) {
      return skill.isUnlocked !== false && !skill.archivedAt;
    });
    if (!unlocked.length) {
      return null;
    }

    var unlockedIds = {};
    unlocked.forEach(function (s) { unlockedIds[s.id] = true; });

    var nodes = unlocked.map(function (skill) {
      var node = {
        key: "node_" + skill.id,
        title: skill.title,
      };
      if (skill.description) node.description = skill.description;
      if (skill.parentId) node.parentKey = "node_" + skill.parentId;
      return node;
    });

    // 只保留两端都已解锁的依赖边
    var edges = (dependencyEdges || [])
      .filter(function (edge) {
        return edge && edge.sourceId && edge.targetId
          && unlockedIds[edge.sourceId] && unlockedIds[edge.targetId];
      })
      .map(function (edge) {
        return {
          prerequisiteKey: "node_" + edge.sourceId,
          nodeKey: "node_" + edge.targetId,
        };
      });

    var phaseCount = Math.min(3, Math.max(1, Math.ceil(unlocked.length / 4)));
    var chunkSize = Math.ceil(unlocked.length / phaseCount);
    var phases = [];

    for (var i = 0; i < phaseCount; i++) {
      var chunk = unlocked.slice(i * chunkSize, (i + 1) * chunkSize);
      if (!chunk.length) continue;
      phases.push({
        title: "第 " + (i + 1) + " 阶段",
        goal: "掌握 " + chunk.map(function (s) { return s.title; }).slice(0, 3).join("、") +
          (chunk.length > 3 ? " 等技能" : ""),
        nodeKeys: chunk.map(function (s) {
          return "node_" + s.id;
        }),
      });
    }

    return {
      proposalId: "ui_tree_" + Date.now(),
      metadata: {
        provider: "ui",
        model: "skills-tree",
        generatedAt: new Date().toISOString(),
      },
      nodes: nodes,
      prerequisiteEdges: edges,
      phases: phases,
    };
  }

  async function loadPlanPhases() {
    viewMode = "hub";
    await loadHubData();
  }

  async function quickStartPlan() {
    var projectId = getProjectId();
    if (!projectId || isBusy) return;

    var unlockedSkills = skills.filter(function (s) {
      return s.isUnlocked !== false && !s.archivedAt;
    });
    if (!unlockedSkills.length) {
      setBanner("error", "技能树为空或全部未解锁。请先在「技能图谱」中解锁一些技能。");
      render();
      return;
    }

    isBusy = true;
    clearBanner();
    rootEl.innerHTML =
      renderSubnav() +
      '<p class="module-empty module-empty--loading">正在启用学习计划…</p>';

    try {
      // 先尝试 proposals/apply（仅空项目可用）
      var proposal = buildProposalFromSkills();
      var result;
      if (proposal) {
        result = await api.post(
          "/api/plan/" + encodeURIComponent(projectId) + "/proposals/apply",
          proposal
        );
      }

      var versionId =
        result && result.planVersion && result.planVersion.id
          ? result.planVersion.id
          : null;

      if (!versionId) {
        // proposals/apply 不可用（项目已有技能），用已有技能创建计划版本
        await loadMaterials();
        var total = unlockedSkills.length;
        var phaseCount = Math.min(3, Math.max(1, Math.ceil(total / 4)));
        var chunkSize = Math.ceil(total / phaseCount);
        var phases = [];

        for (var i = 0; i < phaseCount; i++) {
          var chunk = unlockedSkills.slice(i * chunkSize, (i + 1) * chunkSize);
          if (!chunk.length) continue;
          phases.push({
            title: "第 " + (i + 1) + " 阶段",
            goal: "掌握 " + chunk.map(function (s) { return s.title; }).slice(0, 3).join("、") +
              (chunk.length > 3 ? " 等技能" : ""),
            knowledgeNodeIds: chunk.map(function (s) { return s.id; })
          });
        }

        var versionResult = await api.post(
          "/api/plan/" + encodeURIComponent(projectId) + "/versions",
          { inputSnapshot: {}, phases: phases }
        );
        versionId = versionResult && versionResult.id ? versionResult.id : null;
      }

      // 确认并启用
      if (versionId) {
        await api.post(
          "/api/plan/" +
            encodeURIComponent(projectId) +
            "/versions/" +
            encodeURIComponent(versionId) +
            "/confirm",
          {}
        );
      }

      // 重新加载 plans（确认后项目状态变成 active，plans 需要同步）
      var planData = await api.get("/api/plan");
      plans = planData && Array.isArray(planData.items) ? planData.items : [];

      await loadHubData(false);
      setBanner("success", "学习计划已启用，今日任务已更新。");
      render();
    } catch (err) {
      setBanner("error", "启用失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function generateAiPlanProposal() {
    var projectId = getProjectId();
    if (!projectId || isBusy) return;

    isBusy = true;
    clearBanner();
    rootEl.innerHTML =
      renderSubnav() +
      '<p class="module-empty module-empty--loading">AI 正在生成整体学习计划…</p>';

    try {
      await loadMaterials();
      var generated = await api.post(
        "/api/plan/" + encodeURIComponent(projectId) + "/proposals/generate",
        {}
      );
      var proposal = generated && generated.proposal ? generated.proposal : null;
      if (!proposal) {
        throw new Error("AI 未返回可用计划");
      }

      var result = await api.post(
        "/api/plan/" + encodeURIComponent(projectId) + "/proposals/apply",
        proposal
      );

      if (result && result.planVersion && result.planVersion.status === "draft") {
        selectedVersionId = result.planVersion.id;
      }

      await loadPlanPhaseMeta();
      setViewMode("phases");
      setBanner(
        "success",
        generated.source === "ai" ? "AI 计划已生成并保存为草案。" : "AI 不可用，已使用规则草案。"
      );
      render();
    } catch (err) {
      setViewMode("phases");
      setBanner("error", "AI 生成失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  function beginEditDraftVersion(versionId) {
    var version = planVersions.find(function (entry) {
      return entry.id === versionId;
    });
    if (!version || version.status !== "draft") {
      setBanner("error", "只能编辑草案版本。");
      render();
      return;
    }

    editingDraftVersionId = version.id;
    draftPhaseForms = (version.phases || []).map(function (phase) {
      return {
        title: phase.title || "",
        goal: phase.goal || "",
        description: phase.description || "",
        completionCriteria: phase.completionCriteria || "",
        knowledgeNodeIds: Array.isArray(phase.knowledgeNodeIds)
          ? phase.knowledgeNodeIds.slice()
          : [],
      };
    });
    setViewMode("phase-edit");
    render();
  }

  function renderPhaseEdit() {
    var version = planVersions.find(function (entry) {
      return entry.id === editingDraftVersionId;
    });
    if (!version) {
      return (
        renderSubnav() +
        renderBanner() +
        '<p class="module-empty">草案不存在或已失效。</p>'
      );
    }

    var phasesHtml = draftPhaseForms
      .map(function (phase, index) {
        var skillLabels = (phase.knowledgeNodeIds || [])
          .map(function (id) {
            return skillTitleById(id);
          })
          .join("、");

        return (
          '<article class="plan-phase-editor" data-phase-index="' +
          index +
          '">' +
          '<h3 class="plan-phase-card__title">阶段 ' +
          (index + 1) +
          "</h3>" +
          '<div class="form-row"><label class="form-label">标题</label>' +
          '<input class="form-input phase-field-title" type="text" maxlength="120" value="' +
          api.escapeAttr(phase.title) +
          '" /></div>' +
          '<div class="form-row"><label class="form-label">目标</label>' +
          '<textarea class="form-textarea phase-field-goal" rows="2">' +
          api.escapeHtml(phase.goal) +
          "</textarea></div>" +
          '<div class="form-row"><label class="form-label">说明</label>' +
          '<textarea class="form-textarea phase-field-description" rows="2">' +
          api.escapeHtml(phase.description || "") +
          "</textarea></div>" +
          '<div class="form-row"><label class="form-label">完成标准</label>' +
          '<input class="form-input phase-field-criteria" type="text" maxlength="200" value="' +
          api.escapeAttr(phase.completionCriteria || "") +
          '" /></div>' +
          (skillLabels
            ? '<p class="plan-phase-card__nodes">关联技能：' + api.escapeHtml(skillLabels) + "</p>"
            : "") +
          "</article>"
        );
      })
      .join("");

    return (
      renderSubnav() +
      renderBanner() +
      '<section class="module-mini-page">' +
      '<h2 class="module-mini-page__title">编辑阶段草案 · v' +
      version.version +
      "</h2>" +
      '<p class="module-mini-page__desc">可修改阶段标题、目标与说明；关联技能需通过「从技能树生成」或 AI 生成调整。</p>' +
      phasesHtml +
      '<div class="module-mini-page__actions">' +
      '<button type="button" class="btn btn--ghost" data-action="phase-cancel-edit">取消</button>' +
      '<button type="button" class="btn btn--primary" data-action="phase-save-draft"' +
      (isBusy ? " disabled" : "") +
      ">保存草案</button></div></section>"
    );
  }

  function collectDraftPhasesFromDom() {
    return Array.from(rootEl.querySelectorAll(".plan-phase-editor")).map(function (article, index) {
      var base = draftPhaseForms[index] || { knowledgeNodeIds: [] };
      return {
        title: (article.querySelector(".phase-field-title") || {}).value || "",
        goal: (article.querySelector(".phase-field-goal") || {}).value || "",
        description: (article.querySelector(".phase-field-description") || {}).value || "",
        completionCriteria: (article.querySelector(".phase-field-criteria") || {}).value || "",
        knowledgeNodeIds: base.knowledgeNodeIds || [],
      };
    });
  }

  async function saveDraftVersion() {
    if (!editingDraftVersionId || isBusy) return;

    var phases = collectDraftPhasesFromDom()
      .map(function (phase) {
        return {
          title: phase.title.trim(),
          goal: phase.goal.trim(),
          description: phase.description.trim() || undefined,
          completionCriteria: phase.completionCriteria.trim() || undefined,
          knowledgeNodeIds: phase.knowledgeNodeIds,
        };
      })
      .filter(function (phase) {
        return phase.title && phase.goal;
      });

    if (!phases.length) {
      setBanner("error", "至少保留一个有效阶段。");
      render();
      return;
    }

    var projectId = getProjectId();
    if (!projectId) return;

    isBusy = true;
    clearBanner();
    try {
      await api.patch(
        "/api/plan/" +
          encodeURIComponent(projectId) +
          "/versions/" +
          encodeURIComponent(editingDraftVersionId),
        { phases: phases }
      );
      editingDraftVersionId = null;
      draftPhaseForms = [];
      await loadPlanPhaseMeta();
      setViewMode("phases");
      setBanner("success", "阶段草案已保存。");
      render();
    } catch (err) {
      setBanner("error", "保存失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function applyTreeProposal() {
    var projectId = getProjectId();
    if (!projectId || isBusy) return;

    var proposal = buildProposalFromSkills();
    if (!proposal) {
      setBanner("error", "技能树为空或全部未解锁，无法生成阶段计划。");
      render();
      return;
    }

    isBusy = true;
    clearBanner();
    try {
      // 先尝试 proposals/apply（仅空项目可用）
      var result = await api.post(
        "/api/plan/" + encodeURIComponent(projectId) + "/proposals/apply",
        proposal
      );
      if (result && result.planVersion) {
        selectedVersionId = result.planVersion.id;
      }
      viewMode = "hub";
      await loadHubData(false);
      setBanner(
        "success",
        result && result.idempotentReplay
          ? "已存在相同草案，请点击「确认并启用」。"
          : "草案已生成，请点击「确认并启用」。"
      );
      render();
    } catch (err) {
      // 项目已有知识节点时 proposals/apply 不可用，改用已有技能创建计划版本
      var treeSkills = skills.filter(function (s) { return s.id; });
      if (!treeSkills.length) {
        setBanner("error", "技能树中没有可用技能。");
        render();
        return;
      }

      var total = treeSkills.length;
      var phaseCount = Math.min(3, Math.max(1, Math.ceil(total / 4)));
      var chunkSize = Math.ceil(total / phaseCount);
      var phases = [];

      for (var i = 0; i < phaseCount; i++) {
        var chunk = treeSkills.slice(i * chunkSize, (i + 1) * chunkSize);
        if (!chunk.length) continue;
        phases.push({
          title: "第 " + (i + 1) + " 阶段",
          goal: "掌握 " + chunk.map(function (s) { return s.title; }).slice(0, 3).join("、") +
            (chunk.length > 3 ? " 等技能" : ""),
          knowledgeNodeIds: chunk.map(function (s) { return s.id; })
        });
      }

      try {
        var versionResult = await api.post(
          "/api/plan/" + encodeURIComponent(projectId) + "/versions",
          { inputSnapshot: {}, phases: phases }
        );
        if (versionResult && versionResult.id) {
          selectedVersionId = versionResult.id;
        }
        viewMode = "hub";
        await loadHubData(false);
        setBanner("success", "草案已生成，请点击「确认并启用」。");
        render();
      } catch (versionErr) {
        setBanner("error", "生成失败：" + api.networkError(versionErr));
        render();
      }
    } finally {
      isBusy = false;
    }
  }

  async function confirmPlanVersion(versionId) {
    var projectId = getProjectId();
    if (!projectId || !versionId || isBusy) return;

    isBusy = true;
    clearBanner();
    try {
      await api.post(
        "/api/plan/" +
          encodeURIComponent(projectId) +
          "/versions/" +
          encodeURIComponent(versionId) +
          "/confirm",
        {}
      );
      // 重新加载 plans（确认后项目状态变成 active）
      var planData = await api.get("/api/plan");
      plans = planData && Array.isArray(planData.items) ? planData.items : [];
      viewMode = "hub";
      await loadHubData(false);
      setBanner("success", "学习计划已启用，今日任务将据此编排。");
      render();
    } catch (err) {
      setBanner("error", "确认失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function revisePlanVersion(versionId) {
    var projectId = getProjectId();
    if (!projectId || !versionId || isBusy) return;

    isBusy = true;
    clearBanner();
    try {
      var revised = await api.post(
        "/api/plan/" +
          encodeURIComponent(projectId) +
          "/versions/" +
          encodeURIComponent(versionId) +
          "/revise",
        {}
      );
      if (revised && revised.id) {
        selectedVersionId = revised.id;
      }
      viewMode = "hub";
      await loadHubData(false);
      setBanner("success", "已创建修订草案，请确认后生效。");
      render();
    } catch (err) {
      setBanner("error", "修订失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function updateDailyTaskStatus(taskId, nextStatus) {
    var projectId = getProjectId();
    if (!projectId || !taskId || !nextStatus || isBusy) return;

    isBusy = true;
    clearBanner();
    try {
      var result = await api.patch(
        "/api/daily/" +
          encodeURIComponent(projectId) +
          "/tasks/" +
          encodeURIComponent(taskId),
        { status: nextStatus }
      );
      dailyRecord = {
        sheet: result.sheet,
        summary: result.summary,
        conversations: dailyRecord ? dailyRecord.conversations : [],
      };
      if (result.autoClosed) {
        suggestionDecisions = {};
        var needsConfirm =
          result.summary && result.summary.status === "awaiting_confirmation";
        setBanner(
          "success",
          needsConfirm
            ? "全部任务已完成，请确认下方 AI 建议。"
            : "全部任务已完成，今日学习已自动结束。"
        );
      }
      render();
    } catch (err) {
      setBanner("error", "更新任务失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  function renderAdvanced() {
    if (!plans.length) {
      return (
        renderSubnav() +
        renderBanner() +
        '<section class="plan-advanced-empty">' +
        '<p class="module-empty">手动课表用于自定义「第几天做什么」。日常使用请回到「今日学习」。</p>' +
        '<button type="button" class="btn btn--primary btn--compact" data-action="plan-view-create">新建手动课表</button>' +
        '<button type="button" class="btn btn--ghost btn--compact" data-action="plan-view-hub">返回今日学习</button></section>'
      );
    }

    var plan = getSelectedPlan();
    if (!plan) {
      selectedId = plans[0].id;
      plan = plans[0];
    }

    var planTabs = plans
      .map(function (entry) {
        var active = entry.id === selectedId ? " plan-tab--active" : "";
        return (
          '<button type="button" class="plan-tab' +
          active +
          '" data-action="select-plan" data-id="' +
          api.escapeAttr(entry.id) +
          '">' +
          api.escapeHtml(entry.title) +
          "</button>"
        );
      })
      .join("");

    var statusBadge =
      '<span class="module-badge module-badge--' +
      api.escapeAttr(plan.status) +
      '">' +
      api.escapeHtml(PLAN_STATUS_LABEL[plan.status] || plan.status) +
      "</span>";

    var activateBtn =
      plan.status !== "active"
        ? '<button type="button" class="btn btn--primary btn--compact" data-action="activate-plan" data-id="' +
          api.escapeAttr(plan.id) +
          '">设为进行中</button>'
        : "";

    var daysHtml = (plan.days || [])
      .map(function (day) {
        var tasksHtml = (day.tasks || [])
          .map(function (task) {
            var cls = "plan-task plan-task--" + (task.status || "todo");
            var materialHint = "";
            if (task.materialId) {
              var mat = materials.find(function (m) {
                return m.id === task.materialId;
              });
              if (mat) {
                materialHint = " · 资料：" + mat.title;
              }
            }
            return (
              '<li class="' +
              cls +
              '">' +
              '<button type="button" class="plan-task__check" data-action="cycle-task" data-plan-id="' +
              api.escapeAttr(plan.id) +
              '" data-task-id="' +
              api.escapeAttr(task.id) +
              '" aria-label="切换任务状态"></button>' +
              '<div class="plan-task__body">' +
              '<span class="plan-task__title">' +
              api.escapeHtml(task.title) +
              "</span>" +
              '<span class="plan-task__meta">' +
              api.escapeHtml(TASK_TYPE_LABEL[task.type] || task.type) +
              " · " +
              api.escapeHtml(TASK_STATUS_LABEL[task.status] || task.status) +
              api.escapeHtml(materialHint) +
              "</span></div></li>"
            );
          })
          .join("");

        return (
          '<article class="plan-day">' +
          '<h3 class="plan-day__title">第 ' +
          day.day +
          " 天 · " +
          api.escapeHtml(day.title) +
          "</h3>" +
          '<ul class="plan-task-list">' +
          (tasksHtml || '<li class="module-empty module-empty--inline">暂无任务</li>') +
          "</ul></article>"
        );
      })
      .join("");

    return (
      renderSubnav() +
      renderBanner() +
      '<div class="plan-tabs" role="tablist">' +
      planTabs +
      "</div>" +
      '<header class="plan-detail__header">' +
      "<div>" +
      '<h2 class="plan-detail__title">' +
      api.escapeHtml(plan.title) +
      "</h2>" +
      (plan.goal ? '<p class="plan-detail__goal">' + api.escapeHtml(plan.goal) + "</p>" : "") +
      "</div>" +
      '<div class="plan-detail__actions">' +
      statusBadge +
      activateBtn +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="plan-view-tasks">编辑课表</button>' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="plan-view-edit">编辑信息</button>' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="plan-view-create">新建课表</button>' +
      "</div></header>" +
      '<p class="module-intro plan-advanced__hint">这是可选的手动课表，与「今日学习」的自动编排相互独立。大多数情况只需使用「今日学习」。</p>' +
      '<div class="plan-days">' +
      (daysHtml ||
        '<p class="module-empty">还没有手动安排日程。点击「编辑课表」添加，或返回「今日学习」使用自动计划。</p>') +
      "</div>"
    );
  }

  function render() {
    if (viewMode === "phase-edit") {
      rootEl.innerHTML = renderPhaseEdit();
      return;
    }

    if (viewMode === "create") {
      rootEl.innerHTML = renderSubnav() + renderCreateForm();
      return;
    }

    if (viewMode === "edit") {
      var plan = getSelectedPlan();
      if (!plan) {
        setViewMode("advanced");
        rootEl.innerHTML = renderAdvanced();
        return;
      }
      rootEl.innerHTML = renderSubnav() + renderEditForm(plan);
      return;
    }

    if (viewMode === "tasks") {
      var taskPlan = getSelectedPlan();
      if (!taskPlan) {
        setViewMode("advanced");
        rootEl.innerHTML = renderAdvanced();
        return;
      }
      rootEl.innerHTML = renderSubnav() + renderTasksForm(taskPlan);
      return;
    }

    if (viewMode === "hub") {
      rootEl.innerHTML = renderHub();
      return;
    }

    if (viewMode === "timetable") {
      rootEl.innerHTML =
        renderSubnav() + '<div id="planTimetableMount" class="plan-timetable-mount"></div>';
      var mountEl = document.getElementById("planTimetableMount");
      if (mountEl && window.EduTowerTimetable && typeof window.EduTowerTimetable.mount === "function") {
        window.EduTowerTimetable.mount(mountEl);
      } else if (mountEl) {
        mountEl.innerHTML =
          '<p class="module-empty">课表模块加载失败，请刷新页面后重试。</p>';
      }
      return;
    }

    if (viewMode === "advanced" || viewMode === "browse") {
      rootEl.innerHTML = renderAdvanced();
      return;
    }

    rootEl.innerHTML = renderHub();
  }

  function syncDraftFromDom() {
    var collected = collectDaysFromDom();
    if (viewMode === "create") {
      draftDays = collected;
    } else if (viewMode === "tasks") {
      editingDays = collected;
    }
  }

  function addDayToDraft() {
    syncDraftFromDom();
    var days = viewMode === "create" ? draftDays : editingDays;
    var nextDay = days.length
      ? Math.max.apply(
          null,
          days.map(function (d) {
            return d.day;
          })
        ) + 1
      : 1;
    days.push(emptyDay(nextDay));
    render();
  }

  function removeDayFromDraft(dayIndex) {
    if (dayIndex < 0) return;
    syncDraftFromDom();
    var days = viewMode === "create" ? draftDays : editingDays;
    days.splice(dayIndex, 1);
    render();
  }

  function addTaskToDay(dayIndex) {
    if (dayIndex < 0) return;
    syncDraftFromDom();
    var days = viewMode === "create" ? draftDays : editingDays;
    if (!days[dayIndex]) return;
    if (!days[dayIndex].tasks) days[dayIndex].tasks = [];
    days[dayIndex].tasks.push(emptyTask());
    render();
  }

  function removeTaskFromDay(dayIndex, taskIndex) {
    if (dayIndex < 0 || taskIndex < 0) return;
    syncDraftFromDom();
    var days = viewMode === "create" ? draftDays : editingDays;
    if (!days[dayIndex] || !days[dayIndex].tasks) return;
    days[dayIndex].tasks.splice(taskIndex, 1);
    render();
  }

  async function submitCreatePlan() {
    if (isBusy) return;

    var titleInput = document.getElementById("planCreateTitle");
    var goalInput = document.getElementById("planCreateGoal");
    var title = titleInput ? titleInput.value.trim() : "";
    var goal = goalInput ? goalInput.value.trim() : "";
    var days = collectDaysFromDom();

    if (!title) {
      setBanner("error", "计划标题不能为空。");
      render();
      return;
    }

    isBusy = true;
    clearBanner();

    try {
      var created = await api.post("/api/plan", {
        title: title,
        goal: goal || undefined,
        materialIds: collectMaterialIdsFromDays(days),
        days: days,
      });
      draftDays = [];
      await refresh();
      if (created && created.id) {
        selectedId = created.id;
      }
      setViewMode("advanced");
      setBanner("success", "已创建计划：" + title);
      render();
    } catch (err) {
      setBanner("error", "创建失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function submitEditPlan() {
    if (isBusy) return;

    var plan = getSelectedPlan();
    if (!plan) return;

    var titleInput = document.getElementById("planEditTitle");
    var goalInput = document.getElementById("planEditGoal");
    var deadlineInput = document.getElementById("planEditDeadline");
    var minutesInput = document.getElementById("planEditDailyMinutes");
    var title = titleInput ? titleInput.value.trim() : "";
    var goal = goalInput ? goalInput.value.trim() : "";
    var deadline = deadlineInput ? deadlineInput.value.trim() : "";
    var dailyMinutesRaw = minutesInput ? minutesInput.value.trim() : "";
    var dailyMinutes = dailyMinutesRaw ? parseInt(dailyMinutesRaw, 10) : null;

    if (!title) {
      setBanner("error", "计划标题不能为空。");
      render();
      return;
    }

    if (
      dailyMinutes !== null &&
      (!Number.isFinite(dailyMinutes) ||
        dailyMinutes < MIN_DAILY_MINUTES ||
        dailyMinutes > MAX_DAILY_MINUTES)
    ) {
      setBanner(
        "error",
        "每日时长需在 " + MIN_DAILY_MINUTES + "–" + MAX_DAILY_MINUTES + " 分钟之间。"
      );
      render();
      return;
    }

    isBusy = true;
    clearBanner();

    try {
      await api.patch("/api/plan/" + encodeURIComponent(plan.id), {
        title: title,
        goal: goal,
        deadline: deadline || null,
        dailyMinutes: dailyMinutes,
      });
      await refresh();
      setViewMode("advanced");
      setBanner("success", "已更新计划：" + title);
      render();
    } catch (err) {
      setBanner("error", "更新失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function submitSaveTasks() {
    if (isBusy) return;

    var plan = getSelectedPlan();
    if (!plan) return;

    var days = collectDaysFromDom();

    isBusy = true;
    clearBanner();

    try {
      await api.patch("/api/plan/" + encodeURIComponent(plan.id), {
        days: days,
        materialIds: collectMaterialIdsFromDays(days),
      });
      await refresh();
      setViewMode("advanced");
      setBanner("success", "任务已保存。");
      render();
    } catch (err) {
      setBanner("error", "保存失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function confirmDeletePlan(planId) {
    if (isBusy || !planId) return;

    isBusy = true;
    clearBanner();

    try {
      await api.delete("/api/plan/" + encodeURIComponent(planId));
      pendingDeletePlanId = null;
      selectedId = null;
      await refresh();
      setViewMode("advanced");
      setBanner("success", "计划已删除。");
      render();
    } catch (err) {
      setBanner("error", "删除失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function updatePlanStatus(planId, status) {
    if (isBusy || !planId) return;
    isBusy = true;
    clearBanner();
    try {
      await api.patch("/api/plan/" + encodeURIComponent(planId), { status: status });
      await refresh();
      setBanner("success", "计划状态已更新。");
      render();
    } catch (err) {
      setBanner("error", "更新失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  function nextTaskStatus(current) {
    if (current === "todo") return "in_progress";
    if (current === "in_progress") return "done";
    return "todo";
  }

  async function cycleTaskStatus(planId, taskId) {
    if (isBusy || !planId || !taskId) return;

    var plan = plans.find(function (entry) {
      return entry.id === planId;
    });
    if (!plan) return;

    var updatedDays = (plan.days || []).map(function (day) {
      return {
        day: day.day,
        title: day.title,
        tasks: (day.tasks || []).map(function (task) {
          if (task.id !== taskId) return task;
          return Object.assign({}, task, { status: nextTaskStatus(task.status) });
        }),
      };
    });

    isBusy = true;
    clearBanner();
    try {
      await api.patch("/api/plan/" + encodeURIComponent(planId), {
        days: updatedDays,
        materialIds: collectMaterialIdsFromDays(updatedDays),
      });
      await refresh();
    } catch (err) {
      setBanner("error", "更新任务失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  window.EduTowerPlan = {
    refresh: refresh,
    getProjectId: getProjectId,
    fetchDailyTodayRecord: fetchDailyTodayRecord,
    getDailyRecord: function () {
      return dailyRecord;
    },
    ensureToday: loadDailyToday,
    ensureTodayConversation: ensureTodayConversation,
    loadTodayTasks: async function () {
      var projectId = getProjectId();
      if (!projectId) {
        try {
          await refresh();
        } catch (_refreshErr) {
          /* ignore */
        }
        projectId = getProjectId();
      }
      if (!projectId) {
        return { projectId: "", tasks: [] };
      }

      try {
        await loadDailyToday();
      } catch (_dailyErr) {
        /* ignore */
      }

      var sheet = dailyRecord && dailyRecord.sheet ? dailyRecord.sheet : null;
      var tasks =
        sheet && Array.isArray(sheet.tasks)
          ? sheet.tasks.filter(function (task) {
              return task.status !== "cancelled";
            })
          : [];

      return { projectId: projectId, tasks: tasks };
    },
    nextDailyTaskStatus: nextDailyTaskStatus,
    updateDailyTaskStatus: updateDailyTaskStatus,
    getActivePlanTasks: function () {
      var active =
        plans.find(function (p) {
          return p.status === "active";
        }) || plans[0];
      if (!active || !active.days || !active.days.length) return [];
      return active.days.reduce(function (tasks, day) {
        return tasks.concat(day.tasks || []);
      }, []);
    },
    getActivePlan: function () {
      return (
        plans.find(function (p) {
          return p.status === "active";
        }) || plans[0] || null
      );
    },
    updateTaskStatusByTitle: async function (title, status) {
      var active = window.EduTowerPlan.getActivePlan();
      if (!active || !title) return false;

      var normalizedTitle = String(title).trim();
      var updated = false;
      var updatedDays = (active.days || []).map(function (day) {
        return {
          day: day.day,
          title: day.title,
          tasks: (day.tasks || []).map(function (task) {
            if (task.title.trim() === normalizedTitle) {
              updated = true;
              return Object.assign({}, task, { status: status });
            }
            return task;
          }),
        };
      });

      if (!updated) return false;

      try {
        await api.patch("/api/plan/" + encodeURIComponent(active.id), {
          days: updatedDays,
          materialIds: collectMaterialIdsFromDays(updatedDays),
        });
        await refresh();
        return true;
      } catch (_err) {
        return false;
      }
    },
  };
})();
