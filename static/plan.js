/**
 * EduTower — 学习计划
 */
(function () {
  "use strict";

  var rootEl = document.getElementById("planRoot");
  if (!rootEl) return;

  var api = window.EduTowerApi;
  var plans = [];
  var selectedId = null;
  var isBusy = false;
  var viewMode = "browse";
  var banner = { type: "", message: "" };
  var pendingDeletePlanId = null;

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
        setViewMode("create");
        render();
      } else if (action === "plan-view-edit") {
        setViewMode("edit");
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
      "</nav>"
    );
  }

  async function refresh() {
    rootEl.innerHTML = '<p class="module-empty module-empty--loading">正在加载学习计划…</p>';

    try {
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

  function renderCreateForm() {
    return (
      '<section class="module-mini-page">' +
      '<h2 class="module-mini-page__title">新建学习计划</h2>' +
      '<p class="module-mini-page__desc">创建后可在此页面切换任务状态；每日任务可在后续版本继续完善。</p>' +
      renderBanner() +
      '<div class="form-row"><label class="form-label" for="planCreateTitle">计划标题</label>' +
      '<input id="planCreateTitle" class="form-input" type="text" maxlength="120" placeholder="例如：期末数学复习" required /></div>' +
      '<div class="form-row"><label class="form-label" for="planCreateGoal">学习目标（可选）</label>' +
      '<textarea id="planCreateGoal" class="form-textarea" rows="4" placeholder="描述你想达成的目标…"></textarea></div>' +
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
      '<div class="module-mini-page__actions">' +
      '<button type="button" class="btn btn--ghost" data-action="plan-view-browse">返回列表</button>' +
      deleteBlock +
      '<button type="button" class="btn btn--primary" data-action="submit-edit-plan">保存修改</button></div></section>'
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
          (tasksHtml || '<li class="module-empty">暂无任务</li>') +
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
      '<button type="button" class="btn btn--ghost btn--compact" data-action="plan-view-edit">编辑</button>' +
      "</div></header>" +
      '<div class="plan-days">' +
      (daysHtml || '<p class="module-empty">该计划还没有安排每日任务。</p>') +
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

    rootEl.innerHTML = renderBrowse();
  }

  async function submitCreatePlan() {
    if (isBusy) return;

    var titleInput = document.getElementById("planCreateTitle");
    var goalInput = document.getElementById("planCreateGoal");
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
      var created = await api.post("/api/plan", {
        title: title,
        goal: goal || undefined,
        days: [],
      });
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
      await api.patch("/api/plan/" + encodeURIComponent(planId), { days: updatedDays });
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
  };
})();
