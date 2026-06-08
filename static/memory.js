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
  var pendingDeleteId = null;
  var banner = { type: "", message: "" };

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
        render();
      } else if (action === "memory-edit") {
        editingId = target.getAttribute("data-id");
        pendingDeleteId = null;
        setViewMode("edit");
        render();
      } else if (action === "memory-submit") {
        submitMemoryForm();
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
      (viewMode === "edit"
        ? '<span class="module-subnav__hint">编辑中</span>'
        : "") +
      "</nav>"
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

  function renderForm() {
    var item = viewMode === "edit" ? getEditingItem() : null;
    var title = item ? item.title : "";
    var content = item ? item.content : "";
    var type = item ? item.type : "note";
    var importance = item ? item.importance || "medium" : "medium";

    return (
      '<section class="module-mini-page">' +
      '<h2 class="module-mini-page__title">' +
      (viewMode === "edit" ? "编辑记忆" : "新建记忆") +
      "</h2>" +
      '<p class="module-mini-page__desc">记忆当前保存在服务端内存中，重启服务后会重置。</p>' +
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
      '<div class="module-mini-page__actions">' +
      '<button type="button" class="btn btn--ghost" data-action="memory-view-list">取消</button>' +
      '<button type="button" class="btn btn--primary" data-action="memory-submit">保存</button></div></section>'
    );
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
        '<div class="memory-filters">' +
        filterHtml +
        "</div>" +
        '<p class="module-empty">该分类下暂无记忆条目。</p>'
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
      '<div class="memory-filters">' +
      filterHtml +
      "</div>" +
      '<ul class="memory-list">' +
      cards +
      "</ul>"
    );
  }

  function render() {
    if (viewMode === "create" || viewMode === "edit") {
      rootEl.innerHTML = renderSubnav() + renderForm();
      return;
    }
    rootEl.innerHTML = renderList();
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
