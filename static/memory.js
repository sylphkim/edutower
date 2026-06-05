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

      if (target.matches("[data-filter]")) {
        filterType = target.getAttribute("data-filter") || "all";
        render();
      } else if (target.getAttribute("data-action") === "delete-memory") {
        removeItem(target.getAttribute("data-id"), target.getAttribute("data-title") || "该记忆");
      }
    });
  }

  async function refresh() {
    rootEl.innerHTML = '<p class="module-empty module-empty--loading">正在加载学习记忆…</p>';

    try {
      var data = await api.get("/api/memory");
      items = data && Array.isArray(data.items) ? data.items : [];
      render();
    } catch (err) {
      rootEl.innerHTML =
        '<p class="module-empty module-empty--error">加载失败：' +
        api.escapeHtml(api.networkError(err)) +
        "</p>";
    }
  }

  function render() {
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
      rootEl.innerHTML =
        '<div class="memory-filters">' +
        filterHtml +
        "</div>" +
        '<p class="module-empty">该分类下暂无记忆条目。</p>';
      return;
    }

    var cards = filtered
      .map(function (item) {
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
          '<button type="button" class="btn btn--ghost btn--compact" data-action="delete-memory" data-id="' +
          api.escapeAttr(item.id) +
          '" data-title="' +
          api.escapeAttr(item.title) +
          '">删除</button></div></li>'
        );
      })
      .join("");

    rootEl.innerHTML =
      '<div class="memory-filters">' +
      filterHtml +
      "</div>" +
      '<ul class="memory-list">' +
      cards +
      "</ul>";
  }

  async function removeItem(id, title) {
    if (!id) return;
    if (!window.confirm("确定删除「" + title + "」吗？")) return;

    try {
      await api.delete("/api/memory/" + encodeURIComponent(id));
      await refresh();
    } catch (err) {
      window.alert("删除失败：" + api.networkError(err));
    }
  }

  window.EduTowerMemory = { refresh: refresh };
})();
