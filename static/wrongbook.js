/**
 * EduTower — 错题本
 * 流程：系统/自定义学科 → 错因筛选 → 错题列表
 * 规则：仅自定义分类可删除；删除前有题则二次确认
 */
(function () {
  "use strict";

  var rootEl = document.getElementById("wrongbookRoot");
  if (!rootEl) return;

  var api = window.EduTowerApi;
  var items = [];
  var subjects = [];
  var categories = [];
  var activeSubject = null;
  var filterCategory = "all";
  var showCreateSubject = false;
  var showCreateCategory = false;
  var isBusy = false;
  var pendingDelete = null;
  var statusBanner = { type: "", message: "" };
  var showCreateItem = false;
  var viewingItemId = null;
  var viewingItemDetail = null;

  var CATEGORY_FILTER_ALL = "all";
  var CATEGORY_FILTER_ALL_LABEL = "全部错因";
  var UNCategorized_ID = "uncategorized";

  function renderText(text) {
    if (
      window.EduTowerChatRender &&
      typeof window.EduTowerChatRender.renderRichText === "function"
    ) {
      return window.EduTowerChatRender.renderRichText(text);
    }
    return api.escapeHtml(text);
  }

  bindEvents();
  refresh();

  function isCustomEntry(entry) {
    return entry && entry.builtIn === false;
  }

  function isBuiltInEntry(entry) {
    return !isCustomEntry(entry);
  }

  function partitionByOrigin(list) {
    var builtIn = [];
    var custom = [];
    (list || []).forEach(function (entry) {
      if (isCustomEntry(entry)) custom.push(entry);
      else builtIn.push(entry);
    });
    return { builtIn: builtIn, custom: custom };
  }

  function bindEvents() {
    rootEl.addEventListener("click", onRootClick);
    rootEl.addEventListener("change", onRootChange);
  }

  function onRootClick(event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) return;

    var action = target.getAttribute("data-action");

    if (target.matches("[data-select-subject]")) {
      enterSubject(target.getAttribute("data-select-subject"));
      return;
    }

    if (target.matches("[data-action='back-subjects']")) {
      leaveSubjectView();
      return;
    }

    if (target.matches("[data-action='toggle-create-subject']")) {
      showCreateSubject = !showCreateSubject;
      render();
      return;
    }

    if (target.matches("[data-action='toggle-create-category']")) {
      showCreateCategory = !showCreateCategory;
      render();
      return;
    }

    if (target.matches("[data-action='toggle-create-item']")) {
      showCreateItem = !showCreateItem;
      render();
      return;
    }

    if (target.matches("[data-action='submit-create-item']")) {
      submitCreateItem();
      return;
    }

    if (target.matches("[data-action='submit-create-subject']")) {
      submitCreateSubject();
      return;
    }

    if (target.matches("[data-action='submit-create-category']")) {
      submitCreateCategory();
      return;
    }

    if (target.matches("[data-action='delete-subject']")) {
      event.preventDefault();
      event.stopPropagation();
      pendingDelete = {
        kind: "subject",
        id: target.getAttribute("data-id") || "",
        label: target.getAttribute("data-label") || "该分类",
        count: parseInt(target.getAttribute("data-count") || "0", 10),
      };
      render();
      return;
    }

    if (target.matches("[data-action='delete-category']")) {
      event.preventDefault();
      event.stopPropagation();
      pendingDelete = {
        kind: "category",
        id: target.getAttribute("data-id") || "",
        label: target.getAttribute("data-label") || "该错因",
        count: parseInt(target.getAttribute("data-count") || "0", 10),
      };
      render();
      return;
    }

    if (action === "confirm-pending-delete") {
      confirmPendingDelete();
      return;
    }

    if (action === "cancel-pending-delete") {
      pendingDelete = null;
      render();
      return;
    }

    if (target.matches("[data-filter-category]")) {
      filterCategory = target.getAttribute("data-filter-category") || CATEGORY_FILTER_ALL;
      render();
      return;
    }

    var id = target.getAttribute("data-id");
    if (!action || !id) return;

    if (action === "review") {
      markReviewed(id);
    } else if (action === "view-item") {
      openItemDetail(id);
    } else if (action === "close-item-detail") {
      viewingItemId = null;
      viewingItemDetail = null;
      render();
    } else if (action === "delete") {
      pendingDelete = {
        kind: "item",
        id: id,
        label: target.getAttribute("data-title") || "该错题",
        count: 0,
      };
      render();
    }
  }

  function onRootChange(event) {
    var target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;

    var action = target.getAttribute("data-action");
    var id = target.getAttribute("data-id");
    if (!id || !action) return;

    if (action === "set-category") {
      updateField(id, { category: target.value });
    } else if (action === "set-subject") {
      updateField(id, { subject: target.value });
    }
  }

  function enterSubject(subjectId) {
    if (!subjectId || !findSubject(subjectId)) return;
    activeSubject = subjectId;
    filterCategory = CATEGORY_FILTER_ALL;
    showCreateCategory = false;
    showCreateItem = false;
    render();
  }

  function leaveSubjectView() {
    activeSubject = null;
    filterCategory = CATEGORY_FILTER_ALL;
    showCreateCategory = false;
    showCreateItem = false;
    render();
  }

  function findSubject(id) {
    return subjects.find(function (entry) {
      return entry.id === id;
    });
  }

  function findCategory(id) {
    return categories.find(function (entry) {
      return entry.id === id;
    });
  }

  async function openItemDetail(id) {
    if (!id || isBusy) return;
    isBusy = true;
    try {
      viewingItemDetail = await api.get("/api/wrongbook/" + encodeURIComponent(id));
      viewingItemId = id;
      render();
    } catch (err) {
      statusBanner = { type: "error", message: "加载详情失败：" + api.networkError(err) };
      render();
    } finally {
      isBusy = false;
    }
  }

  function renderItemDetail() {
    var item = viewingItemDetail;
    if (!item) return "";

    var question = item.question || {};
    var prompt = question.prompt || question.stem || "";

    return (
      '<section class="module-mini-page wrongbook-detail">' +
      '<nav class="wrongbook-breadcrumb">' +
      '<button type="button" class="btn-link" data-action="close-item-detail">← 返回列表</button></nav>' +
      '<h2 class="module-mini-page__title">错题详情</h2>' +
      '<p class="wrongbook-card__prompt">' +
      renderText(prompt) +
      "</p>" +
      '<p class="wrongbook-card__answer">你的答案：<strong>' +
      renderText(item.wrongAnswer || "") +
      "</strong></p>" +
      '<p class="wrongbook-card__answer">正确答案：<strong>' +
      renderText(question.answer || "") +
      "</strong></p>" +
      (question.explanation
        ? '<p class="wrongbook-card__answer">解析：' + renderText(question.explanation) + "</p>"
        : "") +
      '<p class="wrongbook-card__meta">学科：' +
      api.escapeHtml(subjectLabel(item.subject)) +
      " · 错因：" +
      api.escapeHtml(categoryLabel(item.category)) +
      "</p></section>"
    );
  }

  async function refresh() {
    rootEl.innerHTML = '<p class="module-empty module-empty--loading">正在加载错题本…</p>';

    try {
      var data = await api.get("/api/wrongbook");
      items = data && Array.isArray(data.items) ? data.items : [];
      subjects = data && Array.isArray(data.subjects) ? data.subjects : [];
      categories = data && Array.isArray(data.categories) ? data.categories : [];
      normalizeViewState();
      render();
    } catch (err) {
      activeSubject = null;
      rootEl.innerHTML =
        '<p class="module-empty module-empty--error">加载失败：' +
        api.escapeHtml(api.networkError(err)) +
        "</p>";
    }
  }

  function normalizeViewState() {
    if (activeSubject && !findSubject(activeSubject)) {
      activeSubject = null;
      filterCategory = CATEGORY_FILTER_ALL;
    }

    if (
      filterCategory !== CATEGORY_FILTER_ALL &&
      filterCategory !== UNCategorized_ID &&
      !findCategory(filterCategory)
    ) {
      filterCategory = CATEGORY_FILTER_ALL;
    }
  }

  function subjectLabel(id) {
    var entry = findSubject(id);
    return entry ? entry.label : "未分类";
  }

  function categoryLabel(id) {
    var entry = findCategory(id);
    return entry ? entry.label : "未分类";
  }

  function normalizeSubject(value) {
    return findSubject(value) ? value : UNCategorized_ID;
  }

  function normalizeCategory(value) {
    return findCategory(value) ? value : UNCategorized_ID;
  }

  function itemsInSubject(subjectId) {
    return items.filter(function (item) {
      return normalizeSubject(item.subject) === subjectId;
    });
  }

  function itemsInCategory(categoryId, subjectId) {
    var scoped = subjectId ? itemsInSubject(subjectId) : items;
    if (categoryId === CATEGORY_FILTER_ALL) return scoped;
    return scoped.filter(function (item) {
      return normalizeCategory(item.category) === categoryId;
    });
  }

  function countByCategoryGlobal(categoryId) {
    return itemsInCategory(categoryId, null).length;
  }

  function renderStatusBanner() {
    if (!statusBanner.message) return "";
    return (
      '<div class="module-banner module-banner--' +
      api.escapeAttr(statusBanner.type || "info") +
      '">' +
      api.escapeHtml(statusBanner.message) +
      "</div>"
    );
  }

  function renderPendingDeleteConfirm() {
    if (!pendingDelete) return "";

    var detail =
      pendingDelete.count > 0
        ? "（含 " + pendingDelete.count + " 道错题，删除后将归入「未分类」）"
        : "";

    return (
      '<div class="module-inline-confirm wrongbook-inline-confirm">' +
      "<p>确定删除「" +
      api.escapeHtml(pendingDelete.label) +
      "」吗？" +
      api.escapeHtml(detail) +
      "</p>" +
      '<div class="module-inline-confirm__actions">' +
      '<button type="button" class="btn btn--primary btn--compact" data-action="confirm-pending-delete">确认删除</button>' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="cancel-pending-delete">取消</button></div></div>'
    );
  }

  async function confirmPendingDelete() {
    if (!pendingDelete || isBusy) return;

    if (pendingDelete.kind === "subject") {
      await deleteSubject(pendingDelete.id, pendingDelete.label, pendingDelete.count);
      return;
    }

    if (pendingDelete.kind === "category") {
      await deleteCategory(pendingDelete.id, pendingDelete.label, pendingDelete.count);
      return;
    }

    if (pendingDelete.kind === "item") {
      await removeItem(pendingDelete.id);
    }
  }

  function renderPolicyNote() {
    return (
      '<p class="wrongbook-policy">' +
      "<strong>分类说明：</strong>带「系统」标签为预置分类，不可删除；带「自定义」标签为你创建的分类，可删除。" +
      " 有错题时删除会二次确认，题目会自动归入「未分类」。" +
      "</p>"
    );
  }

  function render() {
    if (viewingItemId && viewingItemDetail) {
      rootEl.innerHTML = renderStatusBanner() + renderItemDetail();
      return;
    }

    if (!subjects.length) {
      rootEl.innerHTML =
        '<p class="module-empty module-empty--error">分类数据加载异常，请刷新重试。</p>';
      return;
    }

    if (!activeSubject) {
      renderSubjectGrid();
      return;
    }

    renderSubjectDetail();
  }

  function renderSubjectCard(entry) {
    var count = itemsInSubject(entry.id).length;
    var tags = isCustomEntry(entry)
      ? '<em class="wrongbook-tag wrongbook-tag--custom">自定义</em>'
      : '<em class="wrongbook-tag wrongbook-tag--system">系统</em>';

    var inner =
      '<span class="wrongbook-subject-card__title">' +
      api.escapeHtml(entry.label) +
      " " +
      tags +
      "</span>" +
      (entry.hint
        ? '<span class="wrongbook-subject-card__hint">' + api.escapeHtml(entry.hint) + "</span>"
        : "") +
      '<span class="wrongbook-subject-card__count">' +
      count +
      " 道错题</span>";

    if (isCustomEntry(entry)) {
      return (
        '<div class="wrongbook-subject-card-wrap">' +
        '<button type="button" class="wrongbook-subject-card" data-select-subject="' +
        api.escapeAttr(entry.id) +
        '">' +
        inner +
        "</button>" +
        '<button type="button" class="wrongbook-subject-card__delete" data-action="delete-subject" data-id="' +
        api.escapeAttr(entry.id) +
        '" data-label="' +
        api.escapeAttr(entry.label) +
        '" data-count="' +
        count +
        '" title="删除自定义分类">删除</button></div>'
      );
    }

    return (
      '<button type="button" class="wrongbook-subject-card wrongbook-subject-card--builtin" data-select-subject="' +
      api.escapeAttr(entry.id) +
      '" title="系统预置分类，不可删除">' +
      inner +
      "</button>"
    );
  }

  function renderSubjectSection(title, entries, emptyText) {
    if (!entries.length) {
      return (
        '<section class="wrongbook-section">' +
        "<h3 class=\"wrongbook-section__title\">" +
        api.escapeHtml(title) +
        "</h3>" +
        '<p class="wrongbook-section__empty">' +
        api.escapeHtml(emptyText) +
        "</p></section>"
      );
    }

    return (
      '<section class="wrongbook-section">' +
      "<h3 class=\"wrongbook-section__title\">" +
      api.escapeHtml(title) +
      "</h3>" +
      '<div class="wrongbook-subject-grid">' +
      entries.map(renderSubjectCard).join("") +
      "</div></section>"
    );
  }

  function renderCreateSubjectPanel() {
    if (!showCreateSubject) return "";

    return (
      '<section class="wrongbook-create-panel" aria-labelledby="createSubjectTitle">' +
      '<h3 class="wrongbook-create-panel__title" id="createSubjectTitle">新建学科 / 主题</h3>' +
      '<p class="wrongbook-create-panel__hint">例如：语文 · 文言文、生物 · 遗传</p>' +
      '<div class="wrongbook-create-panel__fields">' +
      '<input id="newSubjectLabel" class="form-input" type="text" maxlength="40" placeholder="分类名称" />' +
      '<input id="newSubjectHint" class="form-input" type="text" maxlength="80" placeholder="可选说明" />' +
      '<button type="button" class="btn btn--primary btn--compact" data-action="submit-create-subject">创建</button>' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="toggle-create-subject">取消</button>' +
      "</div></section>"
    );
  }

  function renderCreateItemPanel(subjectId) {
    if (!showCreateItem) return "";

    var categoryOptions = categories
      .map(function (entry) {
        var selected =
          filterCategory !== CATEGORY_FILTER_ALL && filterCategory === entry.id
            ? " selected"
            : "";
        return (
          '<option value="' +
          api.escapeAttr(entry.id) +
          '"' +
          selected +
          ">" +
          api.escapeHtml(entry.label) +
          "</option>"
        );
      })
      .join("");

    return (
      '<section class="wrongbook-create-panel" aria-labelledby="createItemTitle">' +
      '<h3 class="wrongbook-create-panel__title" id="createItemTitle">手动添加错题</h3>' +
      '<p class="wrongbook-create-panel__hint">适用于线下练习或无法自动收录的题目。</p>' +
      '<div class="wrongbook-create-panel__fields wrongbook-create-panel__fields--stack">' +
      '<label class="form-label" for="newItemPrompt">题目</label>' +
      '<textarea id="newItemPrompt" class="form-textarea" rows="3" maxlength="500" placeholder="输入题干…" required></textarea>' +
      '<label class="form-label" for="newItemAnswer">正确答案</label>' +
      '<input id="newItemAnswer" class="form-input" type="text" maxlength="200" placeholder="标准答案" required />' +
      '<label class="form-label" for="newItemWrongAnswer">你的错误答案</label>' +
      '<input id="newItemWrongAnswer" class="form-input" type="text" maxlength="200" placeholder="你当时写的答案" required />' +
      '<label class="form-label" for="newItemCategory">错因</label>' +
      '<select id="newItemCategory" class="form-input">' +
      categoryOptions +
      "</select>" +
      '<label class="form-label" for="newItemExplanation">解析（可选）</label>' +
      '<input id="newItemExplanation" class="form-input" type="text" maxlength="200" placeholder="一句话解析" />' +
      '<div class="wrongbook-create-panel__actions">' +
      '<button type="button" class="btn btn--primary btn--compact" data-action="submit-create-item">保存错题</button>' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="toggle-create-item">取消</button>' +
      "</div></div></section>"
    );
  }

  function renderCreateCategoryPanel() {
    if (!showCreateCategory) return "";

    return (
      '<section class="wrongbook-create-panel" aria-labelledby="createCategoryTitle">' +
      '<h3 class="wrongbook-create-panel__title" id="createCategoryTitle">新建错因分类</h3>' +
      '<div class="wrongbook-create-panel__fields">' +
      '<input id="newCategoryLabel" class="form-input" type="text" maxlength="30" placeholder="例如：公式记错" />' +
      '<button type="button" class="btn btn--primary btn--compact" data-action="submit-create-category">创建</button>' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="toggle-create-category">取消</button>' +
      "</div></section>"
    );
  }

  function renderSubjectGrid() {
    var groups = partitionByOrigin(subjects);

    rootEl.innerHTML =
      renderStatusBanner() +
      renderPendingDeleteConfirm() +
      renderPolicyNote() +
      '<p class="module-intro">先选择学科或主题，进入后再按错因筛选与整理。自定义分类会保存到服务器，重启后仍可用。</p>' +
      renderSubjectSection("系统预置", groups.builtIn, "暂无系统分类") +
      renderSubjectSection(
        "我的分类",
        groups.custom,
        "还没有自定义分类，可点击下方「+ 新建分类」添加。"
      ) +
      '<div class="wrongbook-subject-grid wrongbook-subject-grid--actions">' +
      '<button type="button" class="wrongbook-subject-card wrongbook-subject-card--create" data-action="toggle-create-subject">' +
      '<span class="wrongbook-subject-card__title">+ 新建分类</span>' +
      '<span class="wrongbook-subject-card__hint">添加自定义学科或主题</span></button></div>' +
      renderCreateSubjectPanel() +
      '<div class="module-toolbar"><span class="module-toolbar__meta">共 ' +
      items.length +
      " 道错题</span></div>" +
      (items.length
        ? ""
        : '<p class="module-empty">暂无错题。完成练习后会自动收录。</p>' +
          '<button type="button" class="btn btn--ghost" data-go-view="quiz">去做练习</button>');

    bindGoView(rootEl);

    if (showCreateSubject) {
      var input = document.getElementById("newSubjectLabel");
      if (input) input.focus();
    }
  }

  function renderCategoryFilter(entry) {
    var key = entry.id;
    var active = filterCategory === key ? " wrongbook-filter--active" : "";
    var count = itemsInCategory(key, activeSubject).length;
    var label = key === CATEGORY_FILTER_ALL ? CATEGORY_FILTER_ALL_LABEL : entry.label;
    var tag = isCustomEntry(entry)
      ? ' <em class="wrongbook-tag wrongbook-tag--custom">自定义</em>'
      : key !== CATEGORY_FILTER_ALL
        ? ' <em class="wrongbook-tag wrongbook-tag--system">系统</em>'
        : "";

    var filterBtn =
      '<button type="button" class="wrongbook-filter' +
      active +
      '" data-filter-category="' +
      api.escapeAttr(key) +
      '"' +
      (isBuiltInEntry(entry) && key !== CATEGORY_FILTER_ALL ? ' title="系统预置错因，不可删除"' : "") +
      ">" +
      api.escapeHtml(label) +
      tag +
      ' <span class="wrongbook-filter__count">' +
      count +
      "</span></button>";

    if (key !== CATEGORY_FILTER_ALL && isCustomEntry(entry)) {
      return (
        '<span class="wrongbook-filter-wrap">' +
        filterBtn +
        '<button type="button" class="wrongbook-filter__delete" data-action="delete-category" data-id="' +
        api.escapeAttr(key) +
        '" data-label="' +
        api.escapeAttr(entry.label) +
        '" data-count="' +
        countByCategoryGlobal(key) +
        '" aria-label="删除错因：' +
        api.escapeAttr(entry.label) +
        '" title="删除自定义错因">×</button></span>'
      );
    }

    return filterBtn;
  }

  function renderSubjectDetail() {
    var subjectId = normalizeSubject(activeSubject);
    var subjectEntry = findSubject(subjectId);
    var filtered = itemsInCategory(filterCategory, subjectId);
    var builtInCategories = [{ id: CATEGORY_FILTER_ALL, label: CATEGORY_FILTER_ALL_LABEL, builtIn: true }].concat(
      partitionByOrigin(categories).builtIn
    );
    var customCategories = partitionByOrigin(categories).custom;

    var builtInFilters = builtInCategories.map(renderCategoryFilter).join("");
    var customFilters = customCategories.map(renderCategoryFilter).join("");

    var deleteSubjectBtn =
      subjectEntry && isCustomEntry(subjectEntry)
        ? '<button type="button" class="btn btn--ghost btn--compact wrongbook-breadcrumb__delete" data-action="delete-subject" data-id="' +
          api.escapeAttr(subjectEntry.id) +
          '" data-label="' +
          api.escapeAttr(subjectEntry.label) +
          '" data-count="' +
          itemsInSubject(subjectId).length +
          '">删除此分类</button>'
        : "";

    var systemNote =
      subjectEntry && isBuiltInEntry(subjectEntry)
        ? '<p class="wrongbook-inline-note">当前为<strong>系统预置</strong>学科分类，不可删除。如需单独归档，可将错题移至自定义分类。</p>'
        : "";

    var cards = filtered
      .map(function (item) {
        return renderCard(item);
      })
      .join("");

    rootEl.innerHTML =
      renderStatusBanner() +
      renderPendingDeleteConfirm() +
      '<nav class="wrongbook-breadcrumb">' +
      '<button type="button" class="btn-link" data-action="back-subjects">← 全部分类</button>' +
      '<span class="wrongbook-breadcrumb__sep">/</span>' +
      "<strong>" +
      api.escapeHtml(subjectEntry ? subjectEntry.label : subjectLabel(subjectId)) +
      "</strong>" +
      (subjectEntry && isBuiltInEntry(subjectEntry)
        ? ' <em class="wrongbook-tag wrongbook-tag--system">系统</em>'
        : subjectEntry && isCustomEntry(subjectEntry)
          ? ' <em class="wrongbook-tag wrongbook-tag--custom">自定义</em>'
          : "") +
      deleteSubjectBtn +
      "</nav>" +
      systemNote +
      (subjectEntry && subjectEntry.hint
        ? '<p class="module-intro">' + api.escapeHtml(subjectEntry.hint) + "</p>"
        : "") +
      '<div class="wrongbook-filter-group">' +
      '<p class="wrongbook-filter-group__label">系统错因</p>' +
      '<div class="wrongbook-filters" role="tablist">' +
      builtInFilters +
      "</div></div>" +
      (customCategories.length || showCreateCategory
        ? '<div class="wrongbook-filter-group">' +
          '<p class="wrongbook-filter-group__label">我的错因</p>' +
          '<div class="wrongbook-filters-row">' +
          '<div class="wrongbook-filters" role="tablist">' +
          (customFilters ||
            '<span class="wrongbook-section__empty wrongbook-section__empty--inline">暂无自定义错因</span>') +
          "</div>" +
          '<button type="button" class="btn btn--ghost btn--compact wrongbook-filters__add" data-action="toggle-create-category">+ 新建错因</button></div></div>'
        : '<div class="wrongbook-filters-row">' +
          '<button type="button" class="btn btn--ghost btn--compact wrongbook-filters__add" data-action="toggle-create-category">+ 新建错因</button></div>') +
      renderCreateCategoryPanel() +
      '<div class="module-toolbar module-toolbar--split">' +
      '<span class="module-toolbar__meta">' +
      itemsInSubject(subjectId).length +
      " 道错题" +
      (filterCategory !== CATEGORY_FILTER_ALL ? " · 当前错因 " + filtered.length + " 道" : "") +
      "</span>" +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="toggle-create-item">' +
      (showCreateItem ? "取消添加" : "+ 手动添加") +
      "</button></div>" +
      renderCreateItemPanel(subjectId) +
      (filtered.length
        ? '<ul class="wrongbook-list">' + cards + "</ul>"
        : '<p class="module-empty">该错因下暂无错题，请切换筛选、手动添加，或完成练习后自动收录。</p>');

    if (showCreateCategory) {
      var catInput = document.getElementById("newCategoryLabel");
      if (catInput) catInput.focus();
    }
  }

  function renderSelectField(label, action, item, entries, currentId) {
    var options = entries
      .map(function (entry) {
        var suffix = isCustomEntry(entry) ? "（自定义）" : "（系统）";
        return (
          '<option value="' +
          api.escapeAttr(entry.id) +
          '"' +
          (currentId === entry.id ? " selected" : "") +
          ">" +
          api.escapeHtml(entry.label + suffix) +
          "</option>"
        );
      })
      .join("");

    return (
      '<label class="wrongbook-card__category">' +
      '<span class="wrongbook-card__category-label">' +
      api.escapeHtml(label) +
      "</span>" +
      '<select class="form-input form-input--compact wrongbook-category-select" data-action="' +
      api.escapeAttr(action) +
      '" data-id="' +
      api.escapeAttr(item.id) +
      '" aria-label="' +
      api.escapeAttr(label) +
      '">' +
      options +
      "</select></label>"
    );
  }

  function renderCard(item) {
    var q = item.question || {};
    var prompt = api.getQuestionPrompt(q);
    var options = api.getQuestionOptions(q);
    var optionsHtml = "";
    var categoryId = normalizeCategory(item.category);
    var subjectId = normalizeSubject(item.subject);

    if (options.length) {
      optionsHtml =
        '<ul class="wrongbook-options">' +
        options
          .map(function (opt) {
            var wrong = opt.id === item.wrongAnswer || opt.text === item.wrongAnswer;
            var cls = wrong ? " wrongbook-options__item--wrong" : "";
            if (q.answer === opt.id || q.answer === opt.text) {
              cls += " wrongbook-options__item--correct";
            }
            return (
              '<li class="wrongbook-options__item' +
              cls +
              '"><span class="wrongbook-options__label">' +
              api.escapeHtml(opt.id) +
              ".</span> " +
              renderText(opt.text) +
              "</li>"
            );
          })
          .join("") +
        "</ul>";
    }

    var explanation = q.explanation
      ? '<p class="wrongbook-card__explanation">' + renderText(q.explanation) + "</p>"
      : "";

    return (
      '<li class="wrongbook-card">' +
      '<div class="wrongbook-card__header">' +
      '<span class="wrongbook-card__badge wrongbook-card__badge--' +
      api.escapeAttr(categoryId) +
      '">' +
      api.escapeHtml(categoryLabel(categoryId)) +
      "</span>" +
      '<span class="wrongbook-card__meta">' +
      api.escapeHtml(subjectLabel(subjectId)) +
      " · 复习 " +
      (item.reviewCount || 0) +
      " 次" +
      (item.lastReviewedAt ? " · 上次 " + api.escapeHtml(api.formatDate(item.lastReviewedAt)) : "") +
      "</span></div>" +
      '<div class="wrongbook-card__classify">' +
      renderSelectField("学科/主题", "set-subject", item, subjects, subjectId) +
      renderSelectField("错因", "set-category", item, categories, categoryId) +
      "</div>" +
      '<p class="wrongbook-card__prompt">' +
      renderText(prompt) +
      "</p>" +
      optionsHtml +
      '<p class="wrongbook-card__answer">你的答案：<strong>' +
      renderText(item.wrongAnswer) +
      "</strong></p>" +
      explanation +
      '<div class="wrongbook-card__actions">' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="view-item" data-id="' +
      api.escapeAttr(item.id) +
      '">详情</button>' +
      '<button type="button" class="btn btn--primary btn--compact" data-action="review" data-id="' +
      api.escapeAttr(item.id) +
      '">标记已复习</button>' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="delete" data-id="' +
      api.escapeAttr(item.id) +
      '" data-title="' +
      api.escapeAttr(prompt.slice(0, 30)) +
      '">删除</button></div></li>'
    );
  }

  async function submitCreateSubject() {
    if (isBusy) return;

    var labelInput = document.getElementById("newSubjectLabel");
    var hintInput = document.getElementById("newSubjectHint");
    var label = labelInput ? labelInput.value.trim() : "";
    var hint = hintInput ? hintInput.value.trim() : "";

    if (!label) {
      statusBanner = { type: "error", message: "请填写分类名称。" };
      render();
      return;
    }

    isBusy = true;
    try {
      var created = await api.post("/api/wrongbook/subjects", {
        label: label,
        hint: hint || undefined,
      });
      showCreateSubject = false;
      if (created && created.id) {
        activeSubject = created.id;
        filterCategory = CATEGORY_FILTER_ALL;
      }
      await refresh();
    } catch (err) {
      statusBanner = { type: "error", message: "创建失败：" + api.networkError(err) };
      render();
    } finally {
      isBusy = false;
    }
  }

  async function submitCreateCategory() {
    if (isBusy) return;

    var labelInput = document.getElementById("newCategoryLabel");
    var label = labelInput ? labelInput.value.trim() : "";

    if (!label) {
      statusBanner = { type: "error", message: "请填写错因名称。" };
      render();
      return;
    }

    isBusy = true;
    try {
      var created = await api.post("/api/wrongbook/categories", { label: label });
      showCreateCategory = false;
      if (created && created.id) {
        filterCategory = created.id;
      }
      await refresh();
    } catch (err) {
      statusBanner = { type: "error", message: "创建失败：" + api.networkError(err) };
      render();
    } finally {
      isBusy = false;
    }
  }

  async function submitCreateItem() {
    if (isBusy || !activeSubject) return;

    var promptInput = document.getElementById("newItemPrompt");
    var answerInput = document.getElementById("newItemAnswer");
    var wrongInput = document.getElementById("newItemWrongAnswer");
    var categoryInput = document.getElementById("newItemCategory");
    var explanationInput = document.getElementById("newItemExplanation");

    var prompt = promptInput ? promptInput.value.trim() : "";
    var answer = answerInput ? answerInput.value.trim() : "";
    var wrongAnswer = wrongInput ? wrongInput.value.trim() : "";
    var category = categoryInput ? categoryInput.value.trim() : "uncategorized";
    var explanation = explanationInput ? explanationInput.value.trim() : "";

    if (!prompt || !answer || !wrongAnswer) {
      statusBanner = { type: "error", message: "请填写题目、正确答案和错误答案。" };
      render();
      return;
    }

    isBusy = true;
    try {
      await api.post("/api/wrongbook", {
        subject: activeSubject,
        category: category || "uncategorized",
        wrongAnswer: wrongAnswer,
        question: {
          type: "short_answer",
          prompt: prompt,
          answer: answer,
          explanation: explanation || undefined,
        },
      });
      showCreateItem = false;
      statusBanner = { type: "success", message: "错题已添加。" };
      await refresh();
    } catch (err) {
      statusBanner = { type: "error", message: "添加失败：" + api.networkError(err) };
      render();
    } finally {
      isBusy = false;
    }
  }

  async function deleteSubject(id, label, itemCount) {
    if (isBusy || !id) return;

    isBusy = true;
    try {
      await api.delete("/api/wrongbook/subjects/" + encodeURIComponent(id));
      if (activeSubject === id) {
        activeSubject = null;
        filterCategory = CATEGORY_FILTER_ALL;
      }
      pendingDelete = null;
      statusBanner = { type: "success", message: "已删除分类：" + label };
      await refresh();
    } catch (err) {
      statusBanner = { type: "error", message: "删除失败：" + api.networkError(err) };
      render();
    } finally {
      isBusy = false;
    }
  }

  async function deleteCategory(id, label, itemCount) {
    if (isBusy || !id) return;

    isBusy = true;
    try {
      await api.delete("/api/wrongbook/categories/" + encodeURIComponent(id));
      if (filterCategory === id) {
        filterCategory = CATEGORY_FILTER_ALL;
      }
      pendingDelete = null;
      statusBanner = { type: "success", message: "已删除错因：" + label };
      await refresh();
    } catch (err) {
      statusBanner = { type: "error", message: "删除失败：" + api.networkError(err) };
      render();
    } finally {
      isBusy = false;
    }
  }

  async function updateField(id, patch) {
    if (isBusy) return;

    isBusy = true;
    try {
      await api.patch("/api/wrongbook/" + encodeURIComponent(id), patch);
      await refresh();
    } catch (err) {
      statusBanner = { type: "error", message: "保存失败：" + api.networkError(err) };
      render();
    } finally {
      isBusy = false;
    }
  }

  async function markReviewed(id) {
    if (isBusy) return;
    var item = items.find(function (entry) {
      return entry.id === id;
    });
    if (!item) return;

    isBusy = true;
    try {
      await api.patch("/api/wrongbook/" + encodeURIComponent(id), {
        reviewCount: (item.reviewCount || 0) + 1,
        lastReviewedAt: new Date().toISOString(),
      });
      await refresh();
    } catch (err) {
      statusBanner = { type: "error", message: "更新失败：" + api.networkError(err) };
      render();
    } finally {
      isBusy = false;
    }
  }

  async function removeItem(id) {
    if (isBusy || !id) return;

    isBusy = true;
    try {
      await api.delete("/api/wrongbook/" + encodeURIComponent(id));
      pendingDelete = null;
      statusBanner = { type: "success", message: "错题已删除。" };
      await refresh();
    } catch (err) {
      statusBanner = { type: "error", message: "删除失败：" + api.networkError(err) };
      render();
    } finally {
      isBusy = false;
    }
  }

  function bindGoView(container) {
    container.querySelectorAll("[data-go-view]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (window.EduTowerShell) {
          window.EduTowerShell.switchView(el.getAttribute("data-go-view") || "home");
        }
      });
    });
  }

  window.EduTowerWrongbook = {
    refresh: refresh,
    resetView: leaveSubjectView,
  };
})();
