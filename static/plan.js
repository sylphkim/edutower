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

      if (action === "select-plan") {
        selectedId = target.getAttribute("data-id");
        render();
      } else if (action === "activate-plan") {
        updatePlanStatus(target.getAttribute("data-id"), "active");
      } else if (action === "cycle-task") {
        cycleTaskStatus(target.getAttribute("data-plan-id"), target.getAttribute("data-task-id"));
      }
    });
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

  function render() {
    if (!plans.length) {
      rootEl.innerHTML = '<p class="module-empty">暂无学习计划，后端 mock 数据会在服务启动时初始化。</p>';
      return;
    }

    var planTabs = plans
      .map(function (plan) {
        var active = plan.id === selectedId ? " plan-tab--active" : "";
        return (
          '<button type="button" class="plan-tab' +
          active +
          '" data-action="select-plan" data-id="' +
          api.escapeAttr(plan.id) +
          '">' +
          api.escapeHtml(plan.title) +
          "</button>"
        );
      })
      .join("");

    var plan = getSelectedPlan();
    if (!plan) {
      selectedId = plans[0].id;
      plan = plans[0];
    }

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

    rootEl.innerHTML =
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
      "</div></header>" +
      '<div class="plan-days">' +
      (daysHtml || '<p class="module-empty">该计划还没有安排每日任务。</p>') +
      "</div>";
  }

  async function updatePlanStatus(planId, status) {
    if (isBusy || !planId) return;
    isBusy = true;
    try {
      await api.patch("/api/plan/" + encodeURIComponent(planId), { status: status });
      await refresh();
    } catch (err) {
      window.alert("更新失败：" + api.networkError(err));
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
    try {
      await api.patch("/api/plan/" + encodeURIComponent(planId), { days: updatedDays });
      await refresh();
    } catch (err) {
      window.alert("更新任务失败：" + api.networkError(err));
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
