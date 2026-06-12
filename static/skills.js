/**
 * EduTower — 技能图谱（列表 / 图谱视图 + CRUD）
 */
(function () {
  "use strict";

  var rootEl = document.getElementById("skillsRoot");
  if (!rootEl) return;

  var api = window.EduTowerApi;
  var model = window.EduTowerSkillsModel;
  var viewMode = "list";
  var treeData = [];
  var dependencyEdges = [];
  var flatSkills = [];
  var includeArchived = false;
  var formMode = null;
  var editingId = null;
  var pendingDeleteId = null;
  var banner = { type: "", message: "" };
  var isBusy = false;

  bindEvents();
  refresh();

  function bindEvents() {
    rootEl.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      var action = target.getAttribute("data-action");
      if (!action) return;

      if (action === "skills-new") {
        openCreateForm();
      } else if (action === "skills-edit") {
        openEditForm(target.getAttribute("data-id"));
      } else if (action === "skills-cancel-form") {
        closeForm();
      } else if (action === "skills-submit-form") {
        submitForm();
      } else if (action === "skills-start-delete") {
        pendingDeleteId = target.getAttribute("data-id");
        render();
      } else if (action === "skills-cancel-delete") {
        pendingDeleteId = null;
        render();
      } else if (action === "skills-confirm-delete") {
        deleteSkill(target.getAttribute("data-id"));
      } else if (action === "skills-set-state") {
        updateLearningState(target.getAttribute("data-id"), target.getAttribute("data-state"));
      }
    });

    rootEl.addEventListener("change", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.getAttribute("data-action") !== "skills-toggle-archived") return;
      includeArchived = target.checked;
      refresh();
    });
  }

  function getNodeCssKey(node) {
    return model ? model.getNodeCssKey(node) : "available";
  }

  function getNodeBadgeLabel(node) {
    return model ? model.getNodeBadgeLabel(node) : node.learningState || "";
  }

  function setBanner(type, message) {
    banner = { type: type, message: message || "" };
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

  function openCreateForm() {
    formMode = "create";
    editingId = null;
    pendingDeleteId = null;
    clearBanner();
    render();
  }

  function openEditForm(id) {
    if (!id) return;
    formMode = "edit";
    editingId = id;
    pendingDeleteId = null;
    clearBanner();
    render();
  }

  function closeForm() {
    formMode = null;
    editingId = null;
    pendingDeleteId = null;
    clearBanner();
    render();
  }

  async function refresh() {
    rootEl.innerHTML = '<p class="module-empty module-empty--loading">正在加载技能图谱…</p>';

    try {
      var query = model ? model.buildTreeQuery({ includeArchived: includeArchived }) : "";
      var data = await api.get("/api/skills/tree" + query);
      if (model) {
        var normalized = model.normalizeTreeResponse(data);
        treeData = normalized.items;
        dependencyEdges = normalized.dependencyEdges;
        flatSkills = normalized.flatSkills;
      } else {
        treeData = data && Array.isArray(data.items) ? data.items : [];
        dependencyEdges =
          data && Array.isArray(data.dependencyEdges) ? data.dependencyEdges : [];
        flatSkills = [];
        (function flatten(nodes) {
          (nodes || []).forEach(function (node) {
            flatSkills.push(node);
            flatten(node.children);
          });
        })(treeData);
      }
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

  function parentOptions(selectedId, excludeId) {
    var html = '<option value="">无（顶级技能）</option>';
    flatSkills.forEach(function (skill) {
      if (skill.id === excludeId) return;
      html +=
        '<option value="' +
        api.escapeAttr(skill.id) +
        '"' +
        (selectedId === skill.id ? " selected" : "") +
        ">" +
        api.escapeHtml(model ? model.formatSkillOptionLabel(skill) : skill.title) +
        "</option>";
    });
    return html;
  }

  function prerequisiteOptions(selectedIds, excludeId) {
    return flatSkills
      .filter(function (skill) {
        return skill.id !== excludeId;
      })
      .map(function (skill) {
        var checked = selectedIds && selectedIds.indexOf(skill.id) !== -1;
        return (
          '<label class="skills-prereq-option">' +
          '<input type="checkbox" name="skill-prereq" value="' +
          api.escapeAttr(skill.id) +
          '"' +
          (checked ? " checked" : "") +
          " /> " +
          api.escapeHtml(model ? model.formatSkillOptionLabel(skill) : skill.title) +
          "</label>"
        );
      })
      .join("");
  }

  function learningStateOptions(selected) {
    var labels = model ? model.LEARNING_STATE_LABEL : { not_started: "未开始", learning: "学习中", mastered: "已掌握" };
    return Object.keys(labels)
      .map(function (key) {
        return (
          '<option value="' +
          api.escapeAttr(key) +
          '"' +
          (selected === key ? " selected" : "") +
          ">" +
          api.escapeHtml(labels[key]) +
          "</option>"
        );
      })
      .join("");
  }

  function renderSkillForm() {
    var skill =
      formMode === "edit"
        ? flatSkills.find(function (s) {
            return s.id === editingId;
          })
        : null;

    if (formMode === "edit" && !skill) {
      closeForm();
      return "";
    }

    var title = formMode === "edit" ? "更新学习状态" : "新建技能";
    var isEdit = formMode === "edit";
    var fieldDisabled = isEdit ? " disabled" : "";
    var metaLines = "";

    if (isEdit && skill) {
      if (skill.isUnlocked && skill.unlockedAt) {
        metaLines +=
          '<p class="skill-node__meta">解锁时间：' +
          api.escapeHtml(api.formatDate(skill.unlockedAt)) +
          "</p>";
      }
      if (skill.prerequisiteRisk && skill.riskPrerequisiteIds && skill.riskPrerequisiteIds.length) {
        metaLines +=
          '<p class="skill-node__prereq skill-node__prereq--risk">风险前置：' +
          skill.riskPrerequisiteIds
            .map(function (id) {
              return api.escapeHtml(model ? model.findSkillTitle(flatSkills, id) : id);
            })
            .join("、") +
          "</p>";
      }
    }

    var deleteBlock =
      formMode === "edit" && pendingDeleteId === skill.id
        ? '<div class="module-inline-confirm">' +
          '<p>确定删除「' +
          api.escapeHtml(skill.title) +
          "」吗？子技能将变为顶级节点。</p>" +
          '<div class="module-inline-confirm__actions">' +
          '<button type="button" class="btn btn--primary btn--compact" data-action="skills-confirm-delete" data-id="' +
          api.escapeAttr(skill.id) +
          '">确认删除</button>' +
          '<button type="button" class="btn btn--ghost btn--compact" data-action="skills-cancel-delete">取消</button></div></div>'
        : formMode === "edit"
          ? '<button type="button" class="btn btn--ghost btn--compact module-danger-btn" data-action="skills-start-delete" data-id="' +
            api.escapeAttr(skill.id) +
            '">删除技能</button>'
          : "";

    return (
      '<section class="skills-form module-mini-page">' +
      '<h2 class="module-mini-page__title">' +
      title +
      "</h2>" +
      renderBanner() +
      metaLines +
      '<div class="form-row"><label class="form-label" for="skillFormTitle">名称</label>' +
      '<input id="skillFormTitle" class="form-input" type="text" maxlength="120" value="' +
      api.escapeAttr(skill ? skill.title : "") +
      '"' +
      fieldDisabled +
      " required /></div>" +
      '<div class="form-row"><label class="form-label" for="skillFormDesc">说明（可选）</label>' +
      '<textarea id="skillFormDesc" class="form-textarea" rows="2"' +
      fieldDisabled +
      ">" +
      api.escapeHtml(skill && skill.description ? skill.description : "") +
      "</textarea></div>" +
      '<div class="form-row form-row--inline">' +
      '<div><label class="form-label" for="skillFormParent">父级技能</label>' +
      '<select id="skillFormParent" class="form-input"' +
      fieldDisabled +
      ">" +
      parentOptions(skill ? skill.parentId : "", skill ? skill.id : "") +
      "</select></div>" +
      '<div><label class="form-label" for="skillFormLearningState">学习状态</label>' +
      '<select id="skillFormLearningState" class="form-input"' +
      (formMode === "edit" && skill && skill.isUnlocked === false ? " disabled" : "") +
      ">" +
      learningStateOptions(skill ? skill.learningState || "not_started" : "not_started") +
      "</select></div>" +
      '<div><label class="form-label" for="skillFormMastery">掌握度 %</label>' +
      '<input id="skillFormMastery" class="form-input" type="number" min="0" max="100" value="' +
      api.escapeAttr(String(skill ? skill.mastery || 0 : 0)) +
      '"' +
      fieldDisabled +
      ' /></div></div>' +
      (isEdit
        ? '<p class="module-empty module-empty--inline">编辑模式下只能修改学习状态；结构字段请通过新建/删除管理。</p>'
        : "") +
      '<div class="form-row"><span class="form-label">前置技能</span>' +
      '<div class="skills-prereq-list" id="skillFormPrereqs"' +
      (isEdit ? ' aria-disabled="true"' : "") +
      ">" +
      (flatSkills.length
        ? prerequisiteOptions(skill ? skill.prerequisites : [], skill ? skill.id : "")
        : '<p class="module-empty module-empty--inline">暂无其他技能可选。</p>') +
      "</div></div>" +
      '<div class="module-mini-page__actions">' +
      '<button type="button" class="btn btn--ghost" data-action="skills-cancel-form">取消</button>' +
      deleteBlock +
      '<button type="button" class="btn btn--primary" data-action="skills-submit-form">' +
      (formMode === "edit" ? "保存状态" : "创建技能") +
      "</button></div></section>"
    );
  }

  function renderToolbar(activeMode) {
    return (
      '<div class="skills-toolbar">' +
      '<div class="skills-toolbar__copy">' +
      '<h2 class="skills-toolbar__title">技能与考点</h2>' +
      '<p class="skills-toolbar__desc">' +
      (activeMode === "graph"
        ? "DAG 先修关系图谱：灰色虚线表示未解锁，橙色描边表示前置风险。"
        : "管理技能树、掌握度与先修关系。前置全部掌握后，后续节点会自动解锁。") +
      "</p></div>" +
      '<div class="skills-toolbar__actions">' +
      '<label class="skills-toolbar__filter">' +
      '<input type="checkbox" data-action="skills-toggle-archived"' +
      (includeArchived ? " checked" : "") +
      " /> 显示归档节点</label>" +
      '<button type="button" class="btn btn--primary btn--compact" data-action="skills-new">+ 新建技能</button>' +
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
      '">图谱视图</button></div></div></div>'
    );
  }

  function renderListView() {
    if (window.EduTowerKnowledgeGraph && typeof window.EduTowerKnowledgeGraph.destroy === "function") {
      window.EduTowerKnowledgeGraph.destroy();
    }

    var formHtml = formMode ? renderSkillForm() : "";

    if (!treeData.length && !formMode) {
      rootEl.innerHTML =
        renderToolbar("list") +
        renderBanner() +
        '<p class="module-empty">暂无技能节点，点击「新建技能」添加第一个考点。</p>';
      bindToolbarEvents();
      return;
    }

    rootEl.innerHTML =
      renderToolbar("list") +
      renderBanner() +
      formHtml +
      (treeData.length
        ? '<ul class="skill-tree">' + treeData.map(renderNode).join("") + "</ul>"
        : "");

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

    var graph =
      treeData.length && typeof window.EduTowerGraphData.buildGraphFromSkillTree === "function"
        ? window.EduTowerGraphData.buildGraphFromSkillTree(treeData, {
            title: "技能知识图谱",
            subtitle: "来自后端 dependencyEdges 的真实先修关系",
            dependencyEdges: dependencyEdges,
          })
        : window.EduTowerGraphData.buildDemoGraph();

    rootEl.innerHTML =
      renderToolbar("graph") +
      renderBanner() +
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
      (dependencyEdges.length || graph.links.length) +
      " 条先修边</p></div>" +
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
        if (
          window.EduTowerKnowledgeGraph &&
          typeof window.EduTowerKnowledgeGraph.relayout === "function"
        ) {
          window.EduTowerKnowledgeGraph.relayout();
        }
      });
    }
  }

  function renderQuickStateActions(node) {
    if (!node.isUnlocked || node.archivedAt) return "";
    var states = [
      { key: "not_started", label: "未开始" },
      { key: "learning", label: "学习中" },
      { key: "mastered", label: "已掌握" },
    ];
    return (
      '<div class="skill-node__quick-states">' +
      states
        .map(function (state) {
          var active = node.learningState === state.key;
          return (
            '<button type="button" class="btn btn--ghost btn--compact skill-node__state-btn' +
            (active ? " is-active" : "") +
            '" data-action="skills-set-state" data-id="' +
            api.escapeAttr(node.id) +
            '" data-state="' +
            api.escapeAttr(state.key) +
            '"' +
            (active ? " disabled" : "") +
            ">" +
            api.escapeHtml(state.label) +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderNode(node) {
    var mastery = Math.min(100, Math.max(0, Number(node.mastery) || 0));
    var children =
      node.children && node.children.length
        ? '<ul class="skill-tree skill-tree--nested">' + node.children.map(renderNode).join("") + "</ul>"
        : "";

    var prereqHint =
      node.prerequisites && node.prerequisites.length
        ? '<p class="skill-node__prereq">直接前置：' +
          node.prerequisites
            .map(function (id) {
              return api.escapeHtml(model ? model.findSkillTitle(flatSkills, id) : id);
            })
            .join("、") +
          "</p>"
        : "";

    var riskHint = "";
    if (node.prerequisiteRisk && node.isUnlocked && node.riskPrerequisiteIds && node.riskPrerequisiteIds.length) {
      riskHint =
        '<p class="skill-node__prereq skill-node__prereq--risk">前置风险：' +
        node.riskPrerequisiteIds
          .map(function (id) {
            return api.escapeHtml(model ? model.findSkillTitle(flatSkills, id) : id);
          })
          .join("、") +
        " 尚未全部掌握</p>";
    }

    var unlockHint =
      node.isUnlocked && node.unlockedAt
        ? '<p class="skill-node__meta">解锁于 ' + api.escapeHtml(api.formatDate(node.unlockedAt)) + "</p>"
        : "";

    var cssKey = getNodeCssKey(node);

    return (
      '<li class="skill-node skill-node--' +
      api.escapeAttr(cssKey) +
      '">' +
      '<div class="skill-node__card">' +
      '<div class="skill-node__header">' +
      '<h3 class="skill-node__title">' +
      api.escapeHtml(node.title) +
      "</h3>" +
      '<span class="module-badge module-badge--skill-' +
      api.escapeAttr(cssKey) +
      '">' +
      api.escapeHtml(getNodeBadgeLabel(node)) +
      "</span></div>" +
      (node.description
        ? '<p class="skill-node__desc">' + api.escapeHtml(node.description) + "</p>"
        : "") +
      prereqHint +
      riskHint +
      unlockHint +
      '<div class="skill-node__progress">' +
      '<div class="progress-bar" role="progressbar" aria-valuenow="' +
      mastery +
      '"><div class="progress-bar__fill" style="width:' +
      mastery +
      '%"></div></div>' +
      '<span class="skill-node__mastery">' +
      mastery +
      "%</span></div>" +
      renderQuickStateActions(node) +
      '<div class="skill-node__actions">' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="skills-edit" data-id="' +
      api.escapeAttr(node.id) +
      '">详细编辑</button></div></div>' +
      children +
      "</li>"
    );
  }

  function readFormPayload() {
    var titleInput = document.getElementById("skillFormTitle");
    var descInput = document.getElementById("skillFormDesc");
    var parentSelect = document.getElementById("skillFormParent");
    var learningStateSelect = document.getElementById("skillFormLearningState");
    var masteryInput = document.getElementById("skillFormMastery");
    var prereqRoot = document.getElementById("skillFormPrereqs");

    var title = titleInput ? titleInput.value.trim() : "";
    var description = descInput ? descInput.value.trim() : "";
    var parentId = parentSelect ? parentSelect.value : "";
    var learningState = learningStateSelect ? learningStateSelect.value : "not_started";
    var mastery = masteryInput ? parseInt(masteryInput.value, 10) : 0;
    var prerequisites = [];

    if (prereqRoot) {
      prereqRoot.querySelectorAll("input[name='skill-prereq']:checked").forEach(function (input) {
        prerequisites.push(input.value);
      });
    }

    return {
      title: title,
      description: description || undefined,
      parentId: parentId || undefined,
      learningState: learningState,
      mastery: Number.isFinite(mastery) ? Math.min(100, Math.max(0, mastery)) : 0,
      prerequisites: prerequisites,
    };
  }

  async function updateLearningState(id, learningState) {
    if (isBusy || !id || !learningState) return;

    isBusy = true;
    clearBanner();

    try {
      await api.patch("/api/skills/" + encodeURIComponent(id), { learningState: learningState });
      setBanner("success", "已更新学习状态。");
      await refresh();
    } catch (err) {
      setBanner("error", "更新失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function submitForm() {
    if (isBusy) return;

    var payload = readFormPayload();
    if (!payload.title) {
      setBanner("error", "技能名称不能为空。");
      render();
      return;
    }

    isBusy = true;
    clearBanner();

    try {
      if (formMode === "create") {
        await api.post("/api/skills", payload);
        setBanner("success", "已创建技能：" + payload.title);
      } else if (formMode === "edit" && editingId) {
        await api.patch("/api/skills/" + encodeURIComponent(editingId), {
          learningState: payload.learningState,
        });
        setBanner("success", "已更新学习状态：" + payload.title);
      }
      formMode = null;
      editingId = null;
      await refresh();
    } catch (err) {
      setBanner("error", "保存失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function deleteSkill(id) {
    if (isBusy || !id) return;

    isBusy = true;
    try {
      await api.delete("/api/skills/" + encodeURIComponent(id));
      pendingDeleteId = null;
      formMode = null;
      editingId = null;
      await refresh();
      setBanner("success", "技能已删除。");
      render();
    } catch (err) {
      setBanner("error", "删除失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  window.EduTowerSkills = {
    refresh: refresh,
    setViewMode: function (mode) {
      if (mode === "list" || mode === "graph") {
        viewMode = mode;
        render();
      }
    },
    getFlatSkills: function () {
      return flatSkills.slice();
    },
  };
})();
