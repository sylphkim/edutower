/**
 * EduTower — 首页
 */
(function () {
  "use strict";

  var API_BASE = window.EDUTOWER_API || "";
  var PANEL_API = API_BASE + "/api/agent/panel";
  var CHECKLIST_STORAGE_KEY = "edutower_review_checklist";
  var SESSION_KEY = "edutower_session_id";

  var greetingEl = document.getElementById("homeGreeting");
  var dateEl = document.getElementById("homeDate");
  var progressEl = document.getElementById("homeProgressCard");
  var checklistEl = document.getElementById("homeChecklistCard");
  var weakPointEl = document.getElementById("homeWeakPoint");
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
  }

  function renderKnowledgeGraph() {
    if (!graphMountEl) return;

    if (!window.EduTowerGraphData || !window.EduTowerKnowledgeGraph || typeof d3 === "undefined") {
      graphMountEl.innerHTML =
        '<p class="home-card__empty">知识图谱模块加载中，请稍候刷新页面。</p>';
      return;
    }

    var graph = window.EduTowerGraphData.buildFullGraph();

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
    renderChecklistPreview();
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

  function renderChecklistPreview() {
    if (!checklistEl) return;

    var localChecklist = loadChecklist();
    if (localChecklist.length) {
      renderChecklistItems(localChecklist);
      return;
    }

    fetchPlanChecklistPreview();
  }

  async function fetchPlanChecklistPreview() {
    if (!checklistEl) return;

    checklistEl.innerHTML = '<p class="home-card__loading">正在同步学习计划…</p>';

    try {
      var data = await (window.EduTowerApi
        ? window.EduTowerApi.get("/api/plan")
        : fetch(API_BASE + "/api/plan").then(function (r) {
            return r.json();
          }).then(function (r) {
            return r.data;
          }));

      var plans = data && Array.isArray(data.items) ? data.items : [];
      var active =
        plans.find(function (p) {
          return p.status === "active";
        }) || plans[0];

      if (!active || !active.days || !active.days.length) {
        checklistEl.innerHTML =
          '<p class="home-card__empty">今日还没有安排复习清单。</p>' +
          '<button type="button" class="btn btn--ghost btn--compact" data-go-view="plan">查看学习计划</button>';
        bindChecklistGoView();
        return;
      }

      var tasks = (active.days[0].tasks || []).map(function (task) {
        var status = task.status === "done" ? "done" : task.status === "in_progress" ? "active" : "pending";
        return { title: task.title, timeRange: "", status: status };
      });

      renderChecklistItems(tasks, true);
    } catch (_err) {
      checklistEl.innerHTML =
        '<p class="home-card__empty">今日还没有安排复习清单。</p>' +
        '<button type="button" class="btn btn--ghost btn--compact" data-go-view="chat">去 AI 复习页添加</button>';
      bindChecklistGoView();
    }
  }

  function renderChecklistItems(checklist, fromPlan) {
    if (!checklist.length) {
      checklistEl.innerHTML =
        '<p class="home-card__empty">今日还没有安排复习清单。</p>' +
        '<button type="button" class="btn btn--ghost btn--compact" data-go-view="chat">去 AI 复习页添加</button>';
      bindChecklistGoView();
      return;
    }

    var preview = checklist.slice(0, 4);
    var itemsHtml = preview
      .map(function (item) {
        var cls = "home-checklist-item";
        if (item.status === "done") cls += " home-checklist-item--done";
        if (item.status === "active") cls += " home-checklist-item--active";
        return (
          '<li class="' +
          cls +
          '"><span class="home-checklist-item__title">' +
          escapeHtml(item.title) +
          "</span>" +
          (item.timeRange
            ? '<span class="home-checklist-item__time">' + escapeHtml(item.timeRange) + "</span>"
            : "") +
          "</li>"
        );
      })
      .join("");

    checklistEl.innerHTML =
      '<ul class="home-checklist">' +
      itemsHtml +
      "</ul>" +
      (checklist.length > 4
        ? '<p class="home-card__more">还有 ' + (checklist.length - 4) + " 项</p>"
        : "") +
      (fromPlan
        ? '<button type="button" class="btn btn--ghost btn--compact" data-go-view="plan">查看完整计划</button>'
        : '<button type="button" class="btn btn--ghost btn--compact" data-go-view="chat">进入 AI 复习</button>');

    bindChecklistGoView();
  }

  function bindChecklistGoView() {
    if (!checklistEl) return;
    checklistEl.querySelectorAll("[data-go-view]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (window.EduTowerShell) {
          window.EduTowerShell.switchView(el.getAttribute("data-go-view") || "chat");
        }
      });
    });
  }

  function loadChecklist() {
    try {
      var raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_err) {
      /* ignore */
    }
    return [];
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

  window.EduTowerHome = {
    refresh: refresh,
    resizeKnowledgeGraph: function () {
      if (graphMounted && window.EduTowerKnowledgeGraph) {
        window.EduTowerKnowledgeGraph.resize();
      }
    },
  };
})();
