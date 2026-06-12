/**
 * EduTower — 首页（今日工作台）
 */
(function () {
  "use strict";

  var API_BASE = window.EDUTOWER_API || "";
  var PANEL_API = API_BASE + "/api/agent/panel";
  var SESSION_KEY = "edutower_session_id";

  var greetingEl = document.getElementById("homeGreeting");
  var dateEl = document.getElementById("homeDate");
  var progressEl = document.getElementById("homeProgressCard");
  var checklistEl = document.getElementById("homeChecklistCard");
  var weakPointEl = document.getElementById("homeWeakPoint");
  var primaryCtaEl = document.getElementById("homePrimaryCta");
  var graphMountEl = document.getElementById("homeKnowledgeGraphMount");
  var graphSubtitleEl = document.getElementById("homeGraphSubtitle");
  var graphMounted = false;

  if (!greetingEl) {
    return;
  }

  bindEvents();
  refresh();

  function bindEvents() {
    document.querySelectorAll("[data-go-view]").forEach(function (el) {
      el.addEventListener("click", function (event) {
        var view = el.getAttribute("data-go-view");
        if (!view) return;

        if (el.tagName === "A") {
          event.preventDefault();
        }

        if (window.EduTowerShell && typeof window.EduTowerShell.switchView === "function") {
          window.EduTowerShell.switchView(view);
        }
      });
    });

    document.querySelectorAll("[data-action='relayout-home-graph']").forEach(function (el) {
      el.addEventListener("click", function () {
        if (window.EduTowerKnowledgeGraph && typeof window.EduTowerKnowledgeGraph.relayout === "function") {
          window.EduTowerKnowledgeGraph.relayout();
        }
      });
    });

    if (checklistEl) {
      checklistEl.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) return;

        var btn = target.closest("[data-action='home-cycle-task']");
        if (!btn) return;

        var taskId = btn.getAttribute("data-task-id") || "";
        var currentStatus = btn.getAttribute("data-current-status") || "todo";
        if (!taskId) return;

        cycleHomeTask(taskId, currentStatus);
      });
    }
  }

  async function cycleHomeTask(taskId, currentStatus) {
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
      await fetchPlanChecklistPreview();
      if (window.EduTowerAgentPanel && typeof window.EduTowerAgentPanel.refreshChecklist === "function") {
        window.EduTowerAgentPanel.refreshChecklist();
      }
    } catch (_err) {
      /* ignore */
    }
  }

  async function renderKnowledgeGraph() {
    if (!graphMountEl) return;

    if (!window.EduTowerGraphData || !window.EduTowerKnowledgeGraph || typeof d3 === "undefined") {
      graphMountEl.innerHTML =
        '<p class="home-card__empty">知识图谱模块加载中，请稍候刷新页面。</p>';
      return;
    }

    var graph = window.EduTowerGraphData.buildFullGraph();

    if (window.EduTowerApi && typeof window.EduTowerGraphData.buildGraphFromSkillTree === "function") {
      try {
        var query =
          window.EduTowerSkillsModel && window.EduTowerSkillsModel.buildTreeQuery
            ? window.EduTowerSkillsModel.buildTreeQuery()
            : "";
        var data = await window.EduTowerApi.get("/api/skills/tree" + query);
        var items = data && Array.isArray(data.items) ? data.items : [];
        var edges =
          data && Array.isArray(data.dependencyEdges) ? data.dependencyEdges : [];
        if (items.length) {
          graph = window.EduTowerGraphData.buildGraphFromSkillTree(items, {
            title: "我的技能图谱",
            subtitle: "来自技能树的先修关系与掌握度",
            dependencyEdges: edges,
          });
        }
      } catch (_err) {
        /* 回退到演示数据 */
      }
    }

    if (graphSubtitleEl) {
      graphSubtitleEl.textContent =
        graph.subtitle + " · 共 " + graph.links.length + " 条关联";
    }

    var mounted = window.EduTowerKnowledgeGraph.mount(graphMountEl, graph, {
      compact: true,
      canvasId: "homeKnowledgeGraphCanvas",
      detailId: "homeKnowledgeGraphDetail",
    });

    graphMounted = mounted;

    if (!mounted) {
      graphMountEl.innerHTML =
        '<p class="home-card__empty">知识图谱渲染失败，请检查网络后刷新。</p>';
    }
  }

  function refresh() {
    renderGreeting();
    renderDate();
    fetchPlanChecklistPreview();
    fetchProgress();
    renderKnowledgeGraph();
  }

  function renderGreeting() {
    if (window.EduTowerUser && typeof window.EduTowerUser.getGreetingText === "function") {
      greetingEl.textContent = window.EduTowerUser.getGreetingText();
      return;
    }

    var hour = new Date().getHours();
    var prefix = "你好";
    if (hour >= 5 && hour < 12) prefix = "上午好";
    else if (hour >= 12 && hour < 18) prefix = "下午好";
    else prefix = "晚上好";

    greetingEl.textContent = prefix + "，同学";
  }

  function renderDate() {
    if (!dateEl) return;
    var now = new Date();
    var y = now.getFullYear();
    var mo = String(now.getMonth() + 1).padStart(2, "0");
    var d = String(now.getDate()).padStart(2, "0");
    var weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    dateEl.textContent = y + "年" + mo + "月" + d + "日 · " + weekdays[now.getDay()];
  }

  function getSessionId() {
    return sessionStorage.getItem(SESSION_KEY) || "default";
  }

  function updatePrimaryCta(hasTasks) {
    if (!primaryCtaEl) return;
    if (hasTasks) {
      primaryCtaEl.textContent = "继续今日学习";
      primaryCtaEl.setAttribute("data-go-view", "plan");
      return;
    }
    primaryCtaEl.textContent = "开始 AI 复习";
    primaryCtaEl.setAttribute("data-go-view", "chat");
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

  async function fetchPlanChecklistPreview() {
    if (!checklistEl) return;

    checklistEl.innerHTML = '<p class="home-card__loading">正在同步今日学习任务…</p>';
    updatePrimaryCta(false);

    if (window.EduTowerPlan && typeof window.EduTowerPlan.loadTodayTasks === "function") {
      try {
        var dailyPayload = await window.EduTowerPlan.loadTodayTasks();
        var dailyTasks =
          dailyPayload && Array.isArray(dailyPayload.tasks) ? dailyPayload.tasks : [];
        if (dailyTasks.length) {
          renderChecklistItems(dailyTasks.map(mapDailyTask), true);
          return;
        }
      } catch (_planErr) {
        /* fallback below */
      }
    }

    try {
      var api = window.EduTowerApi;
      var getJson = api
        ? function (path) {
            return api.get(path);
          }
        : function (path) {
            return fetch(API_BASE + path)
              .then(function (r) {
                return r.json();
              })
              .then(function (r) {
                return r.data;
              });
          };

      var planData = await getJson("/api/plan");
      var plans = planData && Array.isArray(planData.items) ? planData.items : [];
      var active =
        plans.find(function (p) {
          return p.status === "active";
        }) || plans[0];

      if (!active) {
        checklistEl.innerHTML =
          '<p class="home-card__empty">今日还没有学习任务。</p>' +
          '<button type="button" class="btn btn--primary btn--compact" data-go-view="plan">一键启用学习计划</button>';
        bindChecklistGoView();
        return;
      }

      var daily;
      try {
        daily = api
          ? await api.post("/api/daily/" + encodeURIComponent(active.id) + "/today", {})
          : await fetch(API_BASE + "/api/daily/" + encodeURIComponent(active.id) + "/today", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            })
              .then(function (r) {
                return r.json();
              })
              .then(function (r) {
                return r.data;
              });
      } catch (_dailyErr) {
        daily = null;
      }

      var sheetTasks =
        daily && daily.sheet && Array.isArray(daily.sheet.tasks) ? daily.sheet.tasks : [];

      if (sheetTasks.length) {
        renderChecklistItems(
          sheetTasks
            .filter(function (task) {
              return task.status !== "cancelled";
            })
            .map(mapDailyTask),
          true
        );
        return;
      }

      checklistEl.innerHTML =
        '<p class="home-card__empty">今日任务尚未生成。打开「学习计划」点击「一键启用」即可。</p>' +
        '<button type="button" class="btn btn--primary btn--compact" data-go-view="plan">去启用今日学习</button>';
      bindChecklistGoView();
    } catch (_err) {
      checklistEl.innerHTML =
        '<p class="home-card__empty">暂时无法加载今日任务，请确认后端已启动。</p>' +
        '<button type="button" class="btn btn--ghost btn--compact" data-go-view="plan">查看学习计划</button>';
      bindChecklistGoView();
    }
  }

  function renderChecklistItems(checklist, interactive) {
    if (!checklist.length) {
      checklistEl.innerHTML =
        '<p class="home-card__empty">今日还没有学习任务。</p>' +
        '<button type="button" class="btn btn--primary btn--compact" data-go-view="plan">去启用今日学习</button>';
      bindChecklistGoView();
      updatePrimaryCta(false);
      return;
    }

    updatePrimaryCta(true);

    var preview = checklist.slice(0, 6);
    var itemsHtml = preview
      .map(function (item) {
        var cls = "home-checklist-item";
        if (item.status === "done") cls += " home-checklist-item--done";
        if (item.status === "active") cls += " home-checklist-item--active";

        var toggleHtml = "";
        if (interactive && item.id) {
          var iconCls = "home-checklist-item__check";
          var iconContent = "";
          if (item.status === "done") {
            iconCls += " home-checklist-item__check--done";
            iconContent = "✓";
          } else if (item.status === "active") {
            iconCls += " home-checklist-item__check--active";
          } else {
            iconCls += " home-checklist-item__check--empty";
          }

          toggleHtml =
            '<button type="button" class="' +
            iconCls +
            '" data-action="home-cycle-task" data-task-id="' +
            escapeAttr(item.id) +
            '" data-current-status="' +
            escapeAttr(item.rawStatus || "todo") +
            '" aria-label="切换任务状态">' +
            iconContent +
            "</button>";
        }

        return (
          '<li class="' +
          cls +
          '">' +
          toggleHtml +
          '<div class="home-checklist-item__body"><span class="home-checklist-item__title">' +
          escapeHtml(item.title) +
          "</span>" +
          (item.timeRange
            ? '<span class="home-checklist-item__time">' + escapeHtml(item.timeRange) + "</span>"
            : "") +
          "</div></li>"
        );
      })
      .join("");

    checklistEl.innerHTML =
      '<ul class="home-checklist">' +
      itemsHtml +
      "</ul>" +
      (checklist.length > 6
        ? '<p class="home-card__more">还有 ' + (checklist.length - 6) + " 项</p>"
        : "") +
      '<button type="button" class="btn btn--primary btn--compact" data-go-view="plan">继续今日学习</button>';

    bindChecklistGoView();
  }

  function bindChecklistGoView() {
    if (!checklistEl) return;
    checklistEl.querySelectorAll("[data-go-view]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (window.EduTowerShell) {
          window.EduTowerShell.switchView(el.getAttribute("data-go-view") || "plan");
        }
      });
    });
  }

  async function fetchProgress() {
    if (!progressEl) return;

    progressEl.innerHTML = '<p class="home-card__loading">正在同步学习进度…</p>';

    try {
      var url = PANEL_API + "?session_id=" + encodeURIComponent(getSessionId());
      var response = await fetch(url);
      var result = await response.json();

      if (!response.ok || !result || result.ok !== true || !result.data) {
        throw new Error("load failed");
      }

      var progress = result.data.progress || {};
      var agent = result.data.agent || {};
      var stats = progress.stats || {};
      var pct = clampPercent(progress.percent);

      if (weakPointEl && agent.activeLabel) {
        weakPointEl.textContent = agent.activeLabel.replace(/^推理中 · /, "");
      }

      progressEl.innerHTML =
        '<div class="home-progress">' +
        '<div class="home-progress__top">' +
        '<span class="home-progress__value">' +
        pct +
        '<small>%</small></span>' +
        '<div class="home-progress__meta">' +
        '<span class="home-progress__subject">' +
        escapeHtml(progress.subject || "综合") +
        " · " +
        escapeHtml(progress.topic || "今日复习") +
        "</span>" +
        '<span class="home-progress__hint">基于当前学习档案统计</span></div></div>' +
        '<div class="progress-bar" role="progressbar" aria-valuenow="' +
        pct +
        '"><div class="progress-bar__fill" style="width:' +
        pct +
        '%"></div></div>' +
        '<ul class="home-progress__stats">' +
        "<li><strong>" +
        (stats.knowledgePoints || 0) +
        "</strong><span>知识点</span></li>" +
        "<li><strong>" +
        (stats.practiceQuestions || 0) +
        "</strong><span>练习题</span></li>" +
        "<li><strong>" +
        (stats.errorCorrections || 0) +
        "</strong><span>错题订正</span></li></ul></div>";
    } catch (_err) {
      progressEl.innerHTML =
        '<p class="home-card__empty">暂时无法加载进度，请确认后端服务已启动。</p>';
      if (weakPointEl) {
        weakPointEl.textContent = "待同步";
      }
    }
  }

  function clampPercent(value) {
    var num = Number(value);
    if (Number.isNaN(num)) return 0;
    return Math.min(100, Math.max(0, Math.round(num)));
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

  window.EduTowerHome = {
    refresh: refresh,
    resizeKnowledgeGraph: function () {
      if (graphMounted && window.EduTowerKnowledgeGraph) {
        window.EduTowerKnowledgeGraph.resize();
      }
    },
  };
})();
