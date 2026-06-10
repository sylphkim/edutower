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
  var viewMode = "browse";
  var banner = { type: "", message: "" };
  var pendingDeletePlanId = null;
  var draftDays = [];
  var editingDays = [];

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

      if (action === "plan-view-browse") {
        setViewMode("browse");
        render();
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

  function renderSubnav() {
    return (
      '<nav class="module-subnav" aria-label="计划视图">' +
      '<button type="button" class="module-subnav__item' +
      (viewMode === "browse" ? " module-subnav__item--active" : "") +
      '" data-action="plan-view-browse">计划列表</button>' +
      '<button type="button" class="module-subnav__item' +
      (viewMode === "create" ? " module-subnav__item--active" : "") +
      '" data-action="plan-view-create">新建计划</button>' +
      (viewMode === "edit"
        ? '<button type="button" class="module-subnav__item module-subnav__item--active" data-action="plan-view-edit">编辑计划</button>'
        : "") +
      (viewMode === "tasks"
        ? '<button type="button" class="module-subnav__item module-subnav__item--active" data-action="plan-view-tasks">管理任务</button>'
        : "") +
      "</nav>"
    );
  }

  async function loadMaterials() {
    try {
      var data = await api.get("/api/materials");
      materials = data && Array.isArray(data.items) ? data.items : [];
    } catch (_err) {
      materials = [];
    }

    try {
      var skillData = await api.get("/api/skills");
      skills = skillData && Array.isArray(skillData.items) ? skillData.items : [];
    } catch (_err) {
      skills = [];
    }
  }

  function skillOptions(selectedId) {
    return (
      '<option value="">不关联技能</option>' +
      skills
        .map(function (s) {
          return (
            '<option value="' +
            api.escapeAttr(s.id) +
            '"' +
            (selectedId === s.id ? " selected" : "") +
            ">" +
            api.escapeHtml(s.title) +
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
      render();
    } catch (err) {
      rootEl.innerHTML =
        renderSubnav() +
        '<p class="module-empty module-empty--error">加载失败：' +
        api.escapeHtml(api.networkError(err)) +
        "</p>";
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
      '" aria-label="删除任务">×</button></div>"
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
      '<h2 class="module-mini-page__title">新建学习计划</h2>' +
      '<p class="module-mini-page__desc">填写目标并安排每日任务。阅读类任务可关联资料；练习/掌握类任务请关联技能，以便在「练习测验」中按计划任务生成题目。</p>' +
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
      '<button type="button" class="btn btn--ghost" data-action="plan-view-browse">取消</button>' +
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
      '<p class="module-mini-page__desc">任务安排请使用「管理任务」视图。</p>' +
      '<div class="module-mini-page__actions">' +
      '<button type="button" class="btn btn--ghost" data-action="plan-view-browse">返回列表</button>' +
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
      '<button type="button" class="btn btn--ghost" data-action="plan-view-browse">返回列表</button>' +
      '<button type="button" class="btn btn--primary" data-action="submit-save-tasks">保存任务</button></div></section>'
    );
  }

  function renderBrowse() {
    if (!plans.length) {
      return (
        renderSubnav() +
        renderBanner() +
        '<p class="module-empty">暂无学习计划，点击「新建计划」创建第一条。</p>'
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
      '<button type="button" class="btn btn--ghost btn--compact" data-action="plan-view-tasks">管理任务</button>' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="plan-view-edit">编辑</button>' +
      "</div></header>" +
      '<div class="plan-days">' +
      (daysHtml || '<p class="module-empty">该计划还没有安排每日任务，点击「管理任务」开始添加。</p>') +
      "</div>"
    );
  }

  function render() {
    if (viewMode === "create") {
      rootEl.innerHTML = renderSubnav() + renderCreateForm();
      return;
    }

    if (viewMode === "edit") {
      var plan = getSelectedPlan();
      if (!plan) {
        setViewMode("browse");
        rootEl.innerHTML = renderBrowse();
        return;
      }
      rootEl.innerHTML = renderSubnav() + renderEditForm(plan);
      return;
    }

    if (viewMode === "tasks") {
      var taskPlan = getSelectedPlan();
      if (!taskPlan) {
        setViewMode("browse");
        rootEl.innerHTML = renderBrowse();
        return;
      }
      rootEl.innerHTML = renderSubnav() + renderTasksForm(taskPlan);
      return;
    }

    rootEl.innerHTML = renderBrowse();
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
      setViewMode("browse");
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
    var title = titleInput ? titleInput.value.trim() : "";
    var goal = goalInput ? goalInput.value.trim() : "";

    if (!title) {
      setBanner("error", "计划标题不能为空。");
      render();
      return;
    }

    isBusy = true;
    clearBanner();

    try {
      await api.patch("/api/plan/" + encodeURIComponent(plan.id), {
        title: title,
        goal: goal,
      });
      await refresh();
      setViewMode("browse");
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
      setViewMode("browse");
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
      setViewMode("browse");
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
