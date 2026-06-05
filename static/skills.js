/**
 * EduTower — 技能图谱（列表视图 + 知识图谱视图）
 */
(function () {
  "use strict";

  var rootEl = document.getElementById("skillsRoot");
  if (!rootEl) return;

  var api = window.EduTowerApi;
  var viewMode = "list";
  var treeData = [];

  var STATUS_LABEL = {
    locked: "未解锁",
    available: "可学习",
    in_progress: "学习中",
    mastered: "已掌握",
  };

  refresh();

  async function refresh() {
    rootEl.innerHTML = '<p class="module-empty module-empty--loading">正在加载技能图谱…</p>';

    try {
      var data = await api.get("/api/skills/tree");
      treeData = data && Array.isArray(data.items) ? data.items : [];
      render();
    } catch (err) {
      rootEl.innerHTML =
        '<p class="module-empty module-empty--error">加载失败：' +
        api.escapeHtml(api.networkError(err)) +
        "</p>";
    }
  }

  function render() {
    if (viewMode === "graph") {
      renderGraphView();
      return;
    }
    renderListView();
  }

  function renderToolbar(activeMode) {
    return (
      '<div class="skills-toolbar">' +
      '<div class="skills-toolbar__copy">' +
      '<h2 class="skills-toolbar__title">技能与考点</h2>' +
      '<p class="skills-toolbar__desc">' +
      (activeMode === "graph"
        ? "力导向知识图谱：拖拽节点时关联考点会弹性跟随，松手后自然回弹稳定。"
        : "技能树展示掌握路径。前置技能解锁后，后续节点才会开放。") +
      "</p></div>" +
      '<div class="skills-view-toggle" role="tablist" aria-label="视图切换">' +
      '<button type="button" class="skills-view-toggle__btn' +
      (activeMode === "list" ? " is-active" : "") +
      '" data-view-mode="list" role="tab" aria-selected="' +
      (activeMode === "list" ? "true" : "false") +
      '">列表视图</button>' +
      '<button type="button" class="skills-view-toggle__btn' +
      (activeMode === "graph" ? " is-active" : "") +
      '" data-view-mode="graph" role="tab" aria-selected="' +
      (activeMode === "graph" ? "true" : "false") +
      '">图谱视图</button></div></div>'
    );
  }

  function renderListView() {
    if (window.EduTowerKnowledgeGraph && typeof window.EduTowerKnowledgeGraph.destroy === "function") {
      window.EduTowerKnowledgeGraph.destroy();
    }

    if (!treeData.length) {
      rootEl.innerHTML =
        renderToolbar("list") + '<p class="module-empty">暂无技能节点。</p>';
      return;
    }

    rootEl.innerHTML =
      renderToolbar("list") +
      '<ul class="skill-tree">' +
      treeData.map(renderNode).join("") +
      "</ul>";

    bindToolbarEvents();
  }

  function renderGraphView() {
    if (!window.EduTowerGraphData || !window.EduTowerKnowledgeGraph) {
      rootEl.innerHTML =
        renderToolbar("graph") +
        '<p class="module-empty module-empty--error">图谱模块未加载，请刷新页面。</p>';
      bindToolbarEvents();
      return;
    }

    var graph = window.EduTowerGraphData.buildDemoGraph();

    rootEl.innerHTML =
      renderToolbar("graph") +
      '<section class="knowledge-graph-panel">' +
      '<header class="knowledge-graph-panel__header">' +
      '<div><h3 class="knowledge-graph-panel__title">' +
      api.escapeHtml(graph.title) +
      "</h3>" +
      '<p class="knowledge-graph-panel__subtitle">' +
      api.escapeHtml(graph.subtitle) +
      " · 共 " +
      graph.nodes.length +
      " 个考点，" +
      graph.links.length +
      " 条关联</p></div>" +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="relayout-graph">重置布局</button></header>' +
      '<div class="knowledge-graph-panel__body" id="knowledgeGraphMount"></div></section>';

    bindToolbarEvents();

    var mountEl = document.getElementById("knowledgeGraphMount");
    var mounted = window.EduTowerKnowledgeGraph.mount(mountEl, graph, {
      canvasId: "skillsKnowledgeGraphCanvas",
      detailId: "skillsKnowledgeGraphDetail",
    });

    if (!mounted) {
      mountEl.innerHTML =
        '<p class="module-empty module-empty--error">图谱渲染库未加载，请检查网络后刷新。</p>';
    }
  }

  function bindToolbarEvents() {
    rootEl.querySelectorAll("[data-view-mode]").forEach(function (button) {
      button.addEventListener("click", function () {
        var nextMode = button.getAttribute("data-view-mode");
        if (!nextMode || nextMode === viewMode) return;
        viewMode = nextMode;
        render();
      });
    });

    var relayoutBtn = rootEl.querySelector("[data-action='relayout-graph']");
    if (relayoutBtn) {
      relayoutBtn.addEventListener("click", function () {
        if (window.EduTowerKnowledgeGraph && typeof window.EduTowerKnowledgeGraph.relayout === "function") {
          window.EduTowerKnowledgeGraph.relayout();
        }
      });
    }
  }

  function renderNode(node) {
    var mastery = Math.min(100, Math.max(0, Number(node.mastery) || 0));
    var children =
      node.children && node.children.length
        ? '<ul class="skill-tree skill-tree--nested">' + node.children.map(renderNode).join("") + "</ul>"
        : "";

    return (
      '<li class="skill-node skill-node--' +
      api.escapeAttr(node.status || "available") +
      '">' +
      '<div class="skill-node__card">' +
      '<div class="skill-node__header">' +
      '<h3 class="skill-node__title">' +
      api.escapeHtml(node.title) +
      "</h3>" +
      '<span class="module-badge module-badge--skill-' +
      api.escapeAttr(node.status || "available") +
      '">' +
      api.escapeHtml(STATUS_LABEL[node.status] || node.status) +
      "</span></div>" +
      (node.description
        ? '<p class="skill-node__desc">' + api.escapeHtml(node.description) + "</p>"
        : "") +
      '<div class="skill-node__progress">' +
      '<div class="progress-bar" role="progressbar" aria-valuenow="' +
      mastery +
      '"><div class="progress-bar__fill" style="width:' +
      mastery +
      '%"></div></div>' +
      '<span class="skill-node__mastery">' +
      mastery +
      "%</span></div></div>" +
      children +
      "</li>"
    );
  }

  window.EduTowerSkills = {
    refresh: refresh,
    setViewMode: function (mode) {
      if (mode === "list" || mode === "graph") {
        viewMode = mode;
        render();
      }
    },
  };
})();
