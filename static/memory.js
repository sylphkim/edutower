/**
 * EduTower — 学习记忆
 */
(function () {
  "use strict";

  var rootEl = document.getElementById("memoryRoot");
  if (!rootEl) return;

  var api = window.EduTowerApi;
  var items = [];
  var filterType = "all";
  var viewMode = "list";
  var editingId = null;
  var viewingDetailId = null;
  var viewingDetail = null;
  var pendingDeleteId = null;
  var isBusy = false;
  var banner = { type: "", message: "" };
  var flatSkills = [];
  var materials = [];
  var relationsLoaded = false;

  var TYPE_LABEL = {
    weakness: "薄弱点",
    daily_summary: "日总结",
    progress: "进度",
    preference: "偏好",
    note: "笔记",
  };

  var IMPORTANCE_LABEL = {
    low: "低",
    medium: "中",
    high: "高",
  };

  bindEvents();
  refresh();

  function bindEvents() {
    rootEl.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      var action = target.getAttribute("data-action");

      if (target.matches("[data-filter]")) {
        filterType = target.getAttribute("data-filter") || "all";
        render();
        return;
      }

      if (action === "memory-view-list") {
        setViewMode("list");
        render();
      } else if (action === "memory-view-create") {
        editingId = null;
        setViewMode("create");
        ensureRelationOptions().then(render);
      } else if (action === "memory-edit") {
        editingId = target.getAttribute("data-id");
        pendingDeleteId = null;
        viewingDetailId = null;
        viewingDetail = null;
        setViewMode("edit");
        ensureRelationOptions().then(render);
      } else if (action === "memory-view-detail") {
        openMemoryDetail(target.getAttribute("data-id"));
      } else if (action === "memory-close-detail") {
        viewingDetailId = null;
        viewingDetail = null;
        setViewMode("list");
        render();
      } else if (action === "memory-submit") {
        submitMemoryForm();
      } else if (action === "memory-view-daily-summary") {
        editingId = null;
        setViewMode("daily-summary");
        render();
      } else if (action === "memory-submit-daily-summary") {
        submitDailySummary();
      } else if (action === "memory-summarize-all") {
        summarizeMemories("all");
      } else if (action === "memory-summarize-type") {
        summarizeMemories(target.getAttribute("data-type") || "");
      } else if (action === "memory-start-delete") {
        pendingDeleteId = target.getAttribute("data-id");
        render();
      } else if (action === "memory-cancel-delete") {
        pendingDeleteId = null;
        render();
      } else if (action === "memory-confirm-delete") {
        removeItem(target.getAttribute("data-id"));
      }
    });
  }

  function setViewMode(mode) {
    viewMode = mode;
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
      '">' +
      api.escapeHtml(banner.message) +
      "</div>"
    );
  }

  function renderSubnav() {
    return (
      '<nav class="module-subnav" aria-label="记忆视图">' +
      '<button type="button" class="module-subnav__item' +
      (viewMode === "list" ? " module-subnav__item--active" : "") +
      '" data-action="memory-view-list">记忆列表</button>' +
      '<button type="button" class="module-subnav__item' +
      (viewMode === "create" || viewMode === "edit" ? " module-subnav__item--active" : "") +
      '" data-action="memory-view-create">新建记忆</button>' +
      '<button type="button" class="module-subnav__item' +
      (viewMode === "daily-summary" ? " module-subnav__item--active" : "") +
      '" data-action="memory-view-daily-summary">每日总结</button>' +
      (viewMode === "edit"
        ? '<span class="module-subnav__hint">编辑中</span>'
        : "") +
      "</nav>"
    );
  }

  function renderListToolbar() {
    return (
      '<div class="memory-toolbar">' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="memory-summarize-all"' +
      (isBusy ? " disabled" : "") +
      ">整理相似记忆</button>" +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="memory-summarize-type" data-type="weakness"' +
      (isBusy ? " disabled" : "") +
      ">合并薄弱点</button></div>"
    );
  }

  async function refresh() {
    rootEl.innerHTML = '<p class="module-empty module-empty--loading">正在加载学习记忆…</p>';

    try {
      var data = await api.get("/api/memory");
      items = data && Array.isArray(data.items) ? data.items : [];
      render();
    } catch (err) {
      rootEl.innerHTML =
        renderSubnav() +
        '<p class="module-empty module-empty--error">加载失败：' +
        api.escapeHtml(api.networkError(err)) +
        "</p>";
    }
  }

  function getEditingItem() {
    return items.find(function (item) {
      return item.id === editingId;
    });
  }

  function renderTypeOptions(selected) {
    return Object.keys(TYPE_LABEL)
      .map(function (type) {
        return (
          '<option value="' +
          api.escapeAttr(type) +
          '"' +
          (selected === type ? " selected" : "") +
          ">" +
          api.escapeHtml(TYPE_LABEL[type]) +
          "</option>"
        );
      })
      .join("");
  }

  function renderImportanceOptions(selected) {
    return Object.keys(IMPORTANCE_LABEL)
      .map(function (level) {
        return (
          '<option value="' +
          api.escapeAttr(level) +
          '"' +
          (selected === level ? " selected" : "") +
          ">" +
          api.escapeHtml(IMPORTANCE_LABEL[level]) +
          "</option>"
        );
      })
      .join("");
  }

  async function ensureRelationOptions() {
    if (relationsLoaded) return;

    try {
      var model = window.EduTowerSkillsModel;
      var projectId =
        window.EduTowerPlan && typeof window.EduTowerPlan.getProjectId === "function"
          ? window.EduTowerPlan.getProjectId()
          : "";
      var query = model
        ? model.buildTreeQuery({ projectId: projectId || undefined })
        : projectId
          ? "?projectId=" + encodeURIComponent(projectId)
          : "";
      var skillData = await api.get("/api/skills/tree" + query);
      if (model) {
        flatSkills = model.normalizeTreeResponse(skillData).flatSkills;
      } else {
        flatSkills = skillData && Array.isArray(skillData.items) ? skillData.items : [];
      }
    } catch (_err) {
      flatSkills = [];
    }

    try {
      var materialData = await api.get("/api/materials");
      materials = materialData && Array.isArray(materialData.items) ? materialData.items : [];
    } catch (_err) {
      materials = [];
    }

    relationsLoaded = true;
  }

  function renderRelationCheckboxes(fieldName, selectedIds) {
    var selected = {};
    (selectedIds || []).forEach(function (id) {
      selected[id] = true;
    });

    if (fieldName === "skill") {
      if (!flatSkills.length) {
        return '<p class="module-empty module-empty--inline">暂无可关联技能</p>';
      }
      return (
        '<div class="memory-relations">' +
        flatSkills
          .map(function (skill) {
            var model = window.EduTowerSkillsModel;
            var label = model ? model.formatSkillOptionLabel(skill) : skill.title;
            return (
              '<label class="memory-relations__item">' +
              '<input type="checkbox" name="memory-related-skill" value="' +
              api.escapeAttr(skill.id) +
              '"' +
              (selected[skill.id] ? " checked" : "") +
              (skill.isUnlocked === false ? " disabled" : "") +
              " />" +
              "<span>" +
              api.escapeHtml(label) +
              "</span></label>"
            );
          })
          .join("") +
        "</div>"
      );
    }

    if (!materials.length) {
      return '<p class="module-empty module-empty--inline">暂无可关联资料</p>';
    }

    return (
      '<div class="memory-relations">' +
      materials
        .map(function (material) {
          return (
            '<label class="memory-relations__item">' +
            '<input type="checkbox" name="memory-related-material" value="' +
            api.escapeAttr(material.id) +
            '"' +
            (selected[material.id] ? " checked" : "") +
            " />" +
            "<span>" +
            api.escapeHtml(material.title) +
            "</span></label>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function collectCheckedValues(name) {
    var inputs = rootEl.querySelectorAll('input[name="' + name + '"]:checked');
    var values = [];
    inputs.forEach(function (input) {
      if (input instanceof HTMLInputElement && input.value) {
        values.push(input.value);
      }
    });
    return values;
  }

  function renderForm() {
    var item = viewMode === "edit" ? getEditingItem() : null;
    var title = item ? item.title : "";
    var content = item ? item.content : "";
    var type = item ? item.type : "note";
    var importance = item ? item.importance || "medium" : "medium";
    var relatedSkillIds = item && item.relatedSkillIds ? item.relatedSkillIds : [];
    var relatedMaterialIds = item && item.relatedMaterialIds ? item.relatedMaterialIds : [];

    return (
      '<section class="module-mini-page">' +
      '<h2 class="module-mini-page__title">' +
      (viewMode === "edit" ? "编辑记忆" : "新建记忆") +
      "</h2>" +
      '<p class="module-mini-page__desc">记忆持久化保存在数据库中，AI 聊天时也会自动写入相关条目。</p>' +
      renderBanner() +
      '<div class="form-row"><label class="form-label" for="memoryFormType">类型</label>' +
      '<select id="memoryFormType" class="form-input">' +
      renderTypeOptions(type) +
      "</select></div>" +
      '<div class="form-row"><label class="form-label" for="memoryFormTitle">标题</label>' +
      '<input id="memoryFormTitle" class="form-input" type="text" maxlength="120" value="' +
      api.escapeAttr(title) +
      '" required /></div>' +
      '<div class="form-row"><label class="form-label" for="memoryFormContent">内容</label>' +
      '<textarea id="memoryFormContent" class="form-textarea" rows="8" required>' +
      api.escapeHtml(content) +
      "</textarea></div>" +
      '<div class="form-row"><label class="form-label" for="memoryFormImportance">重要度</label>' +
      '<select id="memoryFormImportance" class="form-input">' +
      renderImportanceOptions(importance) +
      "</select></div>" +
      '<div class="form-row"><span class="form-label">关联技能（可选）</span>' +
      renderRelationCheckboxes("skill", relatedSkillIds) +
      "</div>" +
      '<div class="form-row"><span class="form-label">关联资料（可选）</span>' +
      renderRelationCheckboxes("material", relatedMaterialIds) +
      "</div>" +
      '<div class="module-mini-page__actions">' +
      '<button type="button" class="btn btn--ghost" data-action="memory-view-list">取消</button>' +
      '<button type="button" class="btn btn--primary" data-action="memory-submit">保存</button></div></section>'
    );
  }

  function renderDailySummaryForm() {
    return (
      '<section class="module-mini-page">' +
      '<h2 class="module-mini-page__title">生成每日总结</h2>' +
      '<p class="module-mini-page__desc">提交后会创建一条 type=daily_summary 的长期记忆，供后续 AI 对话注入使用。</p>' +
      renderBanner() +
      '<div class="form-row"><label class="form-label" for="memoryDailySummary">今日学习总结</label>' +
      '<textarea id="memoryDailySummary" class="form-textarea" rows="6" placeholder="例如：完成了二次函数练习，仍有配方法薄弱点…" required></textarea></div>' +
      '<div class="form-row"><label class="form-label" for="memoryDailyWeaknesses">薄弱点（可选，逗号分隔）</label>' +
      '<input id="memoryDailyWeaknesses" class="form-input" type="text" placeholder="配方法, 因式分解" /></div>' +
      '<div class="form-row"><label class="form-label" for="memoryDailySuggestions">明日建议（可选，逗号分隔）</label>' +
      '<input id="memoryDailySuggestions" class="form-input" type="text" placeholder="做5道综合题, 复习错题本" /></div>' +
      '<div class="module-mini-page__actions">' +
      '<button type="button" class="btn btn--ghost" data-action="memory-view-list">取消</button>' +
      '<button type="button" class="btn btn--primary" data-action="memory-submit-daily-summary"' +
      (isBusy ? " disabled" : "") +
      ">" +
      (isBusy ? "生成中…" : "保存总结") +
      "</button></div></section>"
    );
  }

  function parseCommaList(value) {
    return String(value || "")
      .split(/[,，]/)
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
  }

  function renderList() {
    var filtered =
      filterType === "all"
        ? items
        : items.filter(function (item) {
            return item.type === filterType;
          });

    var filters = ["all"].concat(Object.keys(TYPE_LABEL));
    var filterHtml = filters
      .map(function (type) {
        var label = type === "all" ? "全部" : TYPE_LABEL[type];
        var active = filterType === type ? " memory-filter--active" : "";
        return (
          '<button type="button" class="memory-filter' +
          active +
          '" data-filter="' +
          api.escapeAttr(type) +
          '">' +
          api.escapeHtml(label) +
          "</button>"
        );
      })
      .join("");

    if (!filtered.length) {
      return (
        renderSubnav() +
        renderBanner() +
        renderListToolbar() +
        '<div class="memory-filters">' +
        filterHtml +
        "</div>" +
        '<p class="module-empty">该分类下暂无记忆条目。可与 AI 聊天自动生成，或手动新建。</p>'
      );
    }

    var cards = filtered
      .map(function (item) {
        if (pendingDeleteId === item.id) {
          return (
            '<li class="memory-card memory-card--confirm">' +
            '<p class="module-inline-confirm__text">确定删除「' +
            api.escapeHtml(item.title) +
            "」吗？</p>" +
            '<div class="module-inline-confirm__actions">' +
            '<button type="button" class="btn btn--primary btn--compact" data-action="memory-confirm-delete" data-id="' +
            api.escapeAttr(item.id) +
            '">确认删除</button>' +
            '<button type="button" class="btn btn--ghost btn--compact" data-action="memory-cancel-delete">取消</button></div></li>'
          );
        }

        var relations = [];
        if (item.relatedMaterialIds && item.relatedMaterialIds.length) {
          relations.push("资料 " + item.relatedMaterialIds.length);
        }
        if (item.relatedSkillIds && item.relatedSkillIds.length) {
          relations.push("技能 " + item.relatedSkillIds.length);
        }
        if (item.relatedQuizIds && item.relatedQuizIds.length) {
          relations.push("练习 " + item.relatedQuizIds.length);
        }
        if (item.relatedWrongbookIds && item.relatedWrongbookIds.length) {
          relations.push("错题 " + item.relatedWrongbookIds.length);
        }

        return (
          '<li class="memory-card memory-card--' +
          api.escapeAttr(item.importance || "medium") +
          '">' +
          '<div class="memory-card__header">' +
          '<span class="module-badge module-badge--memory-' +
          api.escapeAttr(item.type) +
          '">' +
          api.escapeHtml(TYPE_LABEL[item.type] || item.type) +
          "</span>" +
          '<span class="memory-card__importance">重要度 · ' +
          api.escapeHtml(IMPORTANCE_LABEL[item.importance] || item.importance) +
          "</span></div>" +
          '<h3 class="memory-card__title">' +
          api.escapeHtml(item.title) +
          "</h3>" +
          '<p class="memory-card__content">' +
          api.escapeHtml(item.content) +
          "</p>" +
          '<div class="memory-card__footer">' +
          '<span class="memory-card__date">' +
          api.escapeHtml(api.formatDate(item.updatedAt || item.createdAt)) +
          "</span>" +
          (relations.length
            ? '<span class="memory-card__relations">' + api.escapeHtml(relations.join(" · ")) + "</span>"
            : "") +
          '<div class="memory-card__actions">' +
          '<button type="button" class="btn btn--ghost btn--compact" data-action="memory-view-detail" data-id="' +
          api.escapeAttr(item.id) +
          '">详情</button>' +
          '<button type="button" class="btn btn--ghost btn--compact" data-action="memory-edit" data-id="' +
          api.escapeAttr(item.id) +
          '">编辑</button>' +
          '<button type="button" class="btn btn--ghost btn--compact module-danger-btn" data-action="memory-start-delete" data-id="' +
          api.escapeAttr(item.id) +
          '">删除</button></div></div></li>'
        );
      })
      .join("");

    return (
      renderSubnav() +
      renderBanner() +
      renderListToolbar() +
      '<div class="memory-filters">' +
      filterHtml +
      "</div>" +
      '<ul class="memory-list">' +
      cards +
      "</ul>"
    );
  }

  function renderMemoryDetail() {
    var item = viewingDetail;
    if (!item) return "";

    return (
      renderSubnav() +
      renderBanner() +
      '<section class="module-mini-page memory-detail">' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="memory-close-detail">← 返回列表</button>' +
      '<h2 class="module-mini-page__title">' +
      api.escapeHtml(item.title) +
      "</h2>" +
      '<p class="memory-card__meta">' +
      api.escapeHtml(TYPE_LABEL[item.type] || item.type) +
      " · 重要度 " +
      api.escapeHtml(IMPORTANCE_LABEL[item.importance] || item.importance) +
      "</p>" +
      '<div class="memory-detail__content">' +
      api.escapeHtml(item.content) +
      "</div>" +
      '<p class="memory-card__date">更新于 ' +
      api.escapeHtml(api.formatDate(item.updatedAt || item.createdAt)) +
      "</p>" +
      '<div class="module-mini-page__actions">' +
      '<button type="button" class="btn btn--primary btn--compact" data-action="memory-edit" data-id="' +
      api.escapeAttr(item.id) +
      '">编辑</button></div></section>'
    );
  }

  async function openMemoryDetail(id) {
    if (!id || isBusy) return;
    isBusy = true;
    try {
      viewingDetail = await api.get("/api/memory/" + encodeURIComponent(id));
      viewingDetailId = id;
      setViewMode("detail");
      render();
    } catch (err) {
      setBanner("error", "加载详情失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  function render() {
    if (viewMode === "detail" && viewingDetail) {
      rootEl.innerHTML = renderMemoryDetail();
      return;
    }
    if (viewMode === "create" || viewMode === "edit") {
      rootEl.innerHTML = renderSubnav() + renderForm();
      return;
    }
    if (viewMode === "daily-summary") {
      rootEl.innerHTML = renderSubnav() + renderDailySummaryForm();
      return;
    }
    rootEl.innerHTML = renderList();
  }

  async function submitDailySummary() {
    if (isBusy) return;

    var summaryEl = document.getElementById("memoryDailySummary");
    var weaknessesEl = document.getElementById("memoryDailyWeaknesses");
    var suggestionsEl = document.getElementById("memoryDailySuggestions");
    var summary = summaryEl ? summaryEl.value.trim() : "";

    if (!summary) {
      setBanner("error", "请填写今日学习总结。");
      render();
      return;
    }

    isBusy = true;
    clearBanner();
    render();

    try {
      await api.post("/api/memory/daily-summary", {
        summary: summary,
        weaknesses: parseCommaList(weaknessesEl ? weaknessesEl.value : ""),
        nextSuggestions: parseCommaList(suggestionsEl ? suggestionsEl.value : ""),
      });
      setBanner("success", "每日总结已保存。");
      setViewMode("list");
      await refresh();
    } catch (err) {
      setBanner("error", "保存失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function summarizeMemories(type) {
    if (isBusy) return;

    isBusy = true;
    clearBanner();
    render();

    try {
      var path =
        type && type !== "all"
          ? "/api/memory/summarize?type=" + encodeURIComponent(type) + "&minCount=3"
          : "/api/memory/summarize?minCount=3";
      var result = await api.post(path, {});
      var merged = result && typeof result.merged === "number" ? result.merged : 0;

      if (merged > 0) {
        setBanner("success", "已合并 " + merged + " 条相似记忆。");
      } else {
        setBanner("info", "暂无可合并的相似记忆（需至少 3 条同类型且标题相近）。");
      }
      await refresh();
    } catch (err) {
      setBanner("error", "整理失败：" + api.networkError(err));
      render();
    } finally {
      isBusy = false;
    }
  }

  async function submitMemoryForm() {
    var typeEl = document.getElementById("memoryFormType");
    var titleEl = document.getElementById("memoryFormTitle");
    var contentEl = document.getElementById("memoryFormContent");
    var importanceEl = document.getElementById("memoryFormImportance");

    var payload = {
      type: typeEl ? typeEl.value : "note",
      title: titleEl ? titleEl.value.trim() : "",
      content: contentEl ? contentEl.value.trim() : "",
      importance: importanceEl ? importanceEl.value : "medium",
      relatedSkillIds: collectCheckedValues("memory-related-skill"),
      relatedMaterialIds: collectCheckedValues("memory-related-material"),
    };

    if (!payload.title || !payload.content) {
      setBanner("error", "标题和内容不能为空。");
      render();
      return;
    }

    try {
      if (viewMode === "edit" && editingId) {
        await api.patch("/api/memory/" + encodeURIComponent(editingId), payload);
        setBanner("success", "记忆已更新。");
      } else {
        await api.post("/api/memory", payload);
        setBanner("success", "记忆已创建。");
      }
      editingId = null;
      setViewMode("list");
      await refresh();
    } catch (err) {
      setBanner("error", "保存失败：" + api.networkError(err));
      render();
    }
  }

  async function removeItem(id) {
    if (!id) return;

    try {
      await api.delete("/api/memory/" + encodeURIComponent(id));
      pendingDeleteId = null;
      setBanner("success", "记忆已删除。");
      await refresh();
    } catch (err) {
      setBanner("error", "删除失败：" + api.networkError(err));
      render();
    }
  }

  window.EduTowerMemory = { refresh: refresh };
})();
