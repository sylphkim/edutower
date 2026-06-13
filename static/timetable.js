/**
 * EduTower — 平日课表（纯前端，localStorage）
 */
(function () {
  "use strict";

  var STORAGE_KEY = "edutower_weekly_timetable";

  var WEEKDAYS = [
    { id: 1, label: "周一" },
    { id: 2, label: "周二" },
    { id: 3, label: "周三" },
    { id: 4, label: "周四" },
    { id: 5, label: "周五" },
    { id: 6, label: "周六" },
    { id: 7, label: "周日" },
  ];

  var HS_EIGHT_PERIODS = [
    { subject: "", startTime: "08:00", endTime: "08:45", note: "第1节" },
    { subject: "", startTime: "08:55", endTime: "09:40", note: "第2节" },
    { subject: "", startTime: "10:00", endTime: "10:45", note: "第3节" },
    { subject: "", startTime: "10:55", endTime: "11:40", note: "第4节" },
    { subject: "", startTime: "14:00", endTime: "14:45", note: "第5节" },
    { subject: "", startTime: "14:55", endTime: "15:40", note: "第6节" },
    { subject: "", startTime: "16:00", endTime: "16:45", note: "第7节" },
    { subject: "", startTime: "16:55", endTime: "17:40", note: "第8节" },
  ];

  var JUNIOR_SEVEN_PERIODS = [
    { subject: "", startTime: "08:00", endTime: "08:40", note: "第1节" },
    { subject: "", startTime: "08:50", endTime: "09:30", note: "第2节" },
    { subject: "", startTime: "09:50", endTime: "10:30", note: "第3节" },
    { subject: "", startTime: "10:40", endTime: "11:20", note: "第4节" },
    { subject: "", startTime: "14:00", endTime: "14:40", note: "第5节" },
    { subject: "", startTime: "14:50", endTime: "15:30", note: "第6节" },
    { subject: "", startTime: "15:40", endTime: "16:20", note: "第7节" },
  ];

  var UNIVERSITY_PERIODS = [
    { subject: "", startTime: "08:30", endTime: "10:00", note: "上午 1" },
    { subject: "", startTime: "10:20", endTime: "11:50", note: "上午 2" },
    { subject: "", startTime: "14:00", endTime: "15:30", note: "下午 1" },
    { subject: "", startTime: "15:50", endTime: "17:20", note: "下午 2" },
  ];

  var TEMPLATES = [
    {
      id: "hs-8periods",
      label: "高中 · 八节课时段",
      desc: "周一至周五，预填 8 节课时间与节次，科目改成你的即可。",
      weekdays: [1, 2, 3, 4, 5],
      periods: HS_EIGHT_PERIODS,
    },
    {
      id: "junior-7periods",
      label: "初中 · 七节课时段",
      desc: "周一至周五，预填 7 节课时段，适合初中课表。",
      weekdays: [1, 2, 3, 4, 5],
      periods: JUNIOR_SEVEN_PERIODS,
    },
    {
      id: "university-4blocks",
      label: "大学 · 每日四段",
      desc: "周一至周五，每天 4 个大课时段，周末留空。",
      weekdays: [1, 2, 3, 4, 5],
      periods: UNIVERSITY_PERIODS,
    },
    {
      id: "demo-science",
      label: "示例 · 高中理科班",
      desc: "一份可改的理科班示例课表，含语数外理化生等。",
      build: buildScienceDemoSlots,
    },
    {
      id: "demo-arts",
      label: "示例 · 高中文科班",
      desc: "一份可改的文科班示例课表，含语数外政史地等。",
      build: buildArtsDemoSlots,
    },
  ];

  var mountedRoot = null;
  var saveTimer = null;
  var expandedSlotIds = {};
  var collapsedSlotIds = {};

  function createId() {
    return "slot_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { slots: [] };
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.slots)) return { slots: [] };
      return parsed;
    } catch (_err) {
      return { slots: [] };
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function getTodayWeekday() {
    var day = new Date().getDay();
    return day === 0 ? 7 : day;
  }

  function normalizeSlot(slot) {
    return {
      id: slot.id || createId(),
      weekday: Number(slot.weekday) >= 1 && Number(slot.weekday) <= 7 ? Number(slot.weekday) : 1,
      subject: String(slot.subject || "").trim(),
      startTime: String(slot.startTime || "").trim(),
      endTime: String(slot.endTime || "").trim(),
      location: String(slot.location || "").trim(),
      note: String(slot.note || "").trim(),
    };
  }

  function compareSlots(left, right) {
    if (left.startTime && right.startTime && left.startTime !== right.startTime) {
      return left.startTime < right.startTime ? -1 : 1;
    }
    if (left.endTime && right.endTime && left.endTime !== right.endTime) {
      return left.endTime < right.endTime ? -1 : 1;
    }
    return left.subject.localeCompare(right.subject, "zh-CN");
  }

  function groupSlotsByWeekday(slots) {
    var groups = {};
    WEEKDAYS.forEach(function (day) {
      groups[day.id] = [];
    });

    slots.forEach(function (slot) {
      var normalized = normalizeSlot(slot);
      if (!groups[normalized.weekday]) {
        groups[normalized.weekday] = [];
      }
      groups[normalized.weekday].push(normalized);
    });

    WEEKDAYS.forEach(function (day) {
      groups[day.id].sort(compareSlots);
    });

    return groups;
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

  function buildSlotsFromPeriods(weekdays, periods) {
    var slots = [];
    weekdays.forEach(function (weekday) {
      periods.forEach(function (period) {
        slots.push(
          normalizeSlot({
            id: createId(),
            weekday: weekday,
            subject: period.subject || "",
            startTime: period.startTime || "",
            endTime: period.endTime || "",
            location: period.location || "",
            note: period.note || "",
          })
        );
      });
    });
    return slots;
  }

  function buildScienceDemoSlots() {
    var weekdayPlans = {
      1: ["语文", "数学", "英语", "物理", "化学", "体育", "数学", "自习"],
      2: ["英语", "数学", "语文", "物理", "生物", "体育", "化学", "自习"],
      3: ["数学", "语文", "英语", "化学", "物理", "体育", "英语", "班会"],
      4: ["语文", "数学", "英语", "生物", "物理", "体育", "化学", "自习"],
      5: ["数学", "英语", "语文", "物理", "化学", "体育", "错题", "自习"],
    };

    var slots = [];
    [1, 2, 3, 4, 5].forEach(function (weekday) {
      HS_EIGHT_PERIODS.forEach(function (period, index) {
        slots.push(
          normalizeSlot({
            id: createId(),
            weekday: weekday,
            subject: weekdayPlans[weekday][index] || "待填",
            startTime: period.startTime,
            endTime: period.endTime,
            location: "",
            note: period.note,
          })
        );
      });
    });
    return slots;
  }

  function buildArtsDemoSlots() {
    var weekdayPlans = {
      1: ["语文", "数学", "英语", "政治", "历史", "体育", "地理", "自习"],
      2: ["英语", "数学", "语文", "历史", "地理", "体育", "政治", "自习"],
      3: ["数学", "语文", "英语", "地理", "政治", "体育", "历史", "班会"],
      4: ["语文", "数学", "英语", "政治", "历史", "体育", "地理", "自习"],
      5: ["数学", "英语", "语文", "历史", "地理", "体育", "作文", "自习"],
    };

    var slots = [];
    [1, 2, 3, 4, 5].forEach(function (weekday) {
      HS_EIGHT_PERIODS.forEach(function (period, index) {
        slots.push(
          normalizeSlot({
            id: createId(),
            weekday: weekday,
            subject: weekdayPlans[weekday][index] || "待填",
            startTime: period.startTime,
            endTime: period.endTime,
            location: "",
            note: period.note,
          })
        );
      });
    });
    return slots;
  }

  function getTemplateById(templateId) {
    return TEMPLATES.find(function (template) {
      return template.id === templateId;
    });
  }

  function buildTemplateSlots(template) {
    if (!template) return [];
    if (typeof template.build === "function") {
      return template.build();
    }
    return buildSlotsFromPeriods(template.weekdays || [1, 2, 3, 4, 5], template.periods || []);
  }

  function renderTemplateCards() {
    return TEMPLATES.map(function (template) {
      var slotCount = buildTemplateSlots(template).length;
      return (
        '<button type="button" class="timetable-template-card" data-action="timetable-apply-template" data-template-id="' +
        escapeAttr(template.id) +
        '">' +
        '<span class="timetable-template-card__title">' +
        escapeHtml(template.label) +
        "</span>" +
        '<span class="timetable-template-card__desc">' +
        escapeHtml(template.desc) +
        "</span>" +
        '<span class="timetable-template-card__meta">' +
        slotCount +
        " 节课</span></button>"
      );
    }).join("");
  }

  function isSlotDisplayReady(slot) {
    return !!(
      String(slot.subject || "").trim() &&
      slot.startTime &&
      slot.endTime
    );
  }

  function shouldExpandSlot(slot) {
    if (collapsedSlotIds[slot.id]) return false;
    if (expandedSlotIds[slot.id]) return true;
    return !isSlotDisplayReady(slot);
  }

  function formatTimeRange(startTime, endTime) {
    if (startTime && endTime) {
      return startTime + " – " + endTime;
    }
    return startTime || endTime || "未设时间";
  }

  function formatCompactMeta(slot) {
    var parts = [];
    if (slot.note) parts.push(slot.note);
    if (slot.location) parts.push(slot.location);
    return parts.join(" · ");
  }

  function renderSlotCardCompact(slot) {
    var meta = formatCompactMeta(slot);
    return (
      '<article class="timetable-slot timetable-slot--compact" data-slot-id="' +
      escapeAttr(slot.id) +
      '">' +
      '<button type="button" class="timetable-slot__compact-main" data-action="timetable-expand-slot" data-slot-id="' +
      escapeAttr(slot.id) +
      '" aria-label="编辑 ' +
      escapeAttr(slot.subject || "课程") +
      '">' +
      '<span class="timetable-slot__compact-subject">' +
      escapeHtml(String(slot.subject || "").trim() || "待填写科目") +
      "</span>" +
      '<span class="timetable-slot__compact-time">' +
      escapeHtml(formatTimeRange(slot.startTime, slot.endTime)) +
      "</span>" +
      (meta
        ? '<span class="timetable-slot__compact-meta">' + escapeHtml(meta) + "</span>"
        : "") +
      "</button>" +
      '<button type="button" class="timetable-slot__delete" data-action="timetable-remove-slot" data-slot-id="' +
      escapeAttr(slot.id) +
      '" aria-label="删除这节课">×</button></article>'
    );
  }

  function renderSlotCardEdit(slot) {
    return (
      '<article class="timetable-slot timetable-slot--editing" data-slot-id="' +
      escapeAttr(slot.id) +
      '">' +
      '<div class="timetable-slot__toolbar">' +
      '<span class="timetable-slot__drag-hint">编辑课程</span>' +
      '<button type="button" class="timetable-slot__delete" data-action="timetable-remove-slot" data-slot-id="' +
      escapeAttr(slot.id) +
      '" aria-label="删除这节课">×</button></div>' +
      '<label class="timetable-slot__label">科目</label>' +
      '<input class="form-input form-input--compact timetable-slot__subject" type="text" data-field="subject" value="' +
      escapeAttr(slot.subject) +
      '" placeholder="' +
      (slot.note ? escapeAttr("填写科目（" + slot.note + "）") : "例如：数学") +
      '" autocomplete="off" />' +
      '<div class="timetable-slot__times">' +
      '<label class="timetable-slot__label">开始</label>' +
      '<input class="form-input form-input--compact form-input--time timetable-slot__time" type="time" data-field="startTime" value="' +
      escapeAttr(slot.startTime) +
      '" step="300" />' +
      '<label class="timetable-slot__label">结束</label>' +
      '<input class="form-input form-input--compact form-input--time timetable-slot__time" type="time" data-field="endTime" value="' +
      escapeAttr(slot.endTime) +
      '" step="300" /></div>' +
      '<label class="timetable-slot__label">教室 / 地点</label>' +
      '<input class="form-input form-input--compact" type="text" data-field="location" value="' +
      escapeAttr(slot.location) +
      '" placeholder="可选" />' +
      '<label class="timetable-slot__label">备注</label>' +
      '<input class="form-input form-input--compact" type="text" data-field="note" value="' +
      escapeAttr(slot.note) +
      '" placeholder="例如：走班、代课" />' +
      '<button type="button" class="btn btn--ghost btn--compact timetable-slot__done" data-action="timetable-collapse-slot" data-slot-id="' +
      escapeAttr(slot.id) +
      '">完成</button></article>'
    );
  }

  function renderSlotCard(slot) {
    if (shouldExpandSlot(slot)) {
      return renderSlotCardEdit(slot);
    }
    return renderSlotCardCompact(slot);
  }

  function renderDayColumn(day, slots, isToday) {
    var items = slots.length
      ? slots.map(renderSlotCard).join("")
      : '<p class="timetable-day__empty">暂无课程</p>';

    return (
      '<section class="timetable-day' +
      (isToday ? " timetable-day--today" : "") +
      '" data-weekday="' +
      day.id +
      '">' +
      '<header class="timetable-day__header">' +
      '<h3 class="timetable-day__title">' +
      escapeHtml(day.label) +
      (isToday ? '<span class="timetable-day__badge">今天</span>' : "") +
      "</h3>" +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="timetable-add-slot" data-weekday="' +
      day.id +
      '">+ 添加</button></header>' +
      '<div class="timetable-day__slots">' +
      items +
      "</div></section>"
    );
  }

  function renderMarkup() {
    var store = loadStore();
    var groups = groupSlotsByWeekday(store.slots);
    var today = getTodayWeekday();
    var totalSlots = store.slots.length;

    var columns = WEEKDAYS.map(function (day) {
      return renderDayColumn(day, groups[day.id] || [], day.id === today);
    }).join("");

    return (
      '<section class="timetable-panel">' +
      '<header class="timetable-panel__header">' +
      "<div>" +
      '<h2 class="module-subtitle">平日课表</h2>' +
      '<p class="module-intro">填写每周在校课程，可先套用模板再改科目；数据保存在本机浏览器。</p></div>' +
      '<div class="timetable-panel__actions">' +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="timetable-add-weekday" data-weekday="' +
      today +
      '">在今天加一节</button>' +
      '<button type="button" class="btn btn--ghost btn--compact module-danger-btn" data-action="timetable-clear-all">清空课表</button></div></header>' +
      '<section class="timetable-templates" aria-label="课表模板">' +
      '<div class="timetable-templates__head">' +
      '<h3 class="timetable-templates__title">套用模板</h3>' +
      '<p class="timetable-templates__hint">会覆盖当前课表；套用后在科目栏填写课程名称即可。</p></div>' +
      '<div class="timetable-templates__grid">' +
      renderTemplateCards() +
      "</div></section>" +
      '<p class="timetable-panel__meta">共 ' +
      totalSlots +
      " 节课 · 填写后点「完成」或点击卡片编辑 · 自动保存</p>" +
      '<div class="timetable-grid">' +
      columns +
      "</div></section>"
    );
  }

  function readSlotFromCard(card) {
    var slotId = card.getAttribute("data-slot-id") || createId();
    var dayCol = card.closest(".timetable-day");
    var weekday = dayCol ? parseInt(dayCol.getAttribute("data-weekday") || "1", 10) : 1;

    function readField(name) {
      var input = card.querySelector('[data-field="' + name + '"]');
      return input ? input.value : "";
    }

    return normalizeSlot({
      id: slotId,
      weekday: weekday,
      subject: readField("subject"),
      startTime: readField("startTime"),
      endTime: readField("endTime"),
      location: readField("location"),
      note: readField("note"),
    });
  }

  function collectSlotsFromDom() {
    if (!mountedRoot) return [];

    var store = loadStore();
    var editedMap = {};

    mountedRoot.querySelectorAll(".timetable-slot--editing").forEach(function (card) {
      var slot = readSlotFromCard(card);
      editedMap[slot.id] = slot;
    });

    return store.slots.map(function (slot) {
      return editedMap[slot.id] || slot;
    });
  }

  function isSlotMeaningful(slot) {
    return !!(
      slot.subject ||
      slot.startTime ||
      slot.endTime ||
      slot.location ||
      slot.note
    );
  }

  function persistFromDom() {
    saveStore({ slots: collectSlotsFromDom() });
  }

  function persistFromDomPruneEmpty() {
    var slots = collectSlotsFromDom().filter(isSlotMeaningful);
    saveStore({ slots: slots });
  }

  function schedulePersist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      persistFromDom();
      updateMetaLine();
    }, 320);
  }

  function persistImmediately() {
    clearTimeout(saveTimer);
    persistFromDom();
    updateMetaLine();
  }

  function updateMetaLine() {
    if (!mountedRoot) return;
    var meta = mountedRoot.querySelector(".timetable-panel__meta");
    if (!meta) return;
    var store = loadStore();
    meta.textContent = "共 " + store.slots.length + " 节课 · 修改后自动保存";
  }

  function addSlot(weekday) {
    persistImmediately();
    var store = loadStore();
    var newId = createId();
    expandedSlotIds[newId] = true;
    delete collapsedSlotIds[newId];
    store.slots.push(
      normalizeSlot({
        id: newId,
        weekday: weekday,
        subject: "",
        startTime: "",
        endTime: "",
        location: "",
        note: "",
      })
    );
    saveStore(store);
    paint();
  }

  function removeSlot(slotId) {
    if (!slotId) return;
    persistImmediately();
    delete expandedSlotIds[slotId];
    delete collapsedSlotIds[slotId];
    var store = loadStore();
    store.slots = store.slots.filter(function (slot) {
      return slot.id !== slotId;
    });
    saveStore(store);
    paint();
  }

  function clearAll() {
    if (!window.confirm("确定清空整周课表吗？此操作不可撤销。")) return;
    expandedSlotIds = {};
    collapsedSlotIds = {};
    saveStore({ slots: [] });
    paint();
  }

  function collapseSlot(slotId) {
    if (!slotId) return;
    delete expandedSlotIds[slotId];
    collapsedSlotIds[slotId] = true;
    paint();
  }

  function expandSlot(slotId) {
    if (!slotId) return;
    delete collapsedSlotIds[slotId];
    expandedSlotIds[slotId] = true;
    paint();
    if (!mountedRoot) return;
    var card = mountedRoot.querySelector(
      '.timetable-slot--editing[data-slot-id="' + slotId + '"]'
    );
    if (!card) return;
    var subjectInput = card.querySelector('[data-field="subject"]');
    if (subjectInput instanceof HTMLInputElement) {
      subjectInput.focus();
    }
  }

  function tryCollapseEditingCard(card) {
    if (!card) return;
    var slot = readSlotFromCard(card);
    if (!isSlotDisplayReady(slot)) return;
    persistImmediately();
    collapseSlot(slot.id);
  }

  function applyTemplate(templateId) {
    var template = getTemplateById(templateId);
    if (!template) return;

    var store = loadStore();
    if (store.slots.length) {
      var ok = window.confirm(
        "套用「" + template.label + "」会覆盖当前课表，是否继续？"
      );
      if (!ok) return;
    }

    expandedSlotIds = {};
    collapsedSlotIds = {};
    saveStore({ slots: buildTemplateSlots(template) });
    paint();
  }

  function onRootClick(event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (
      target.closest("input, textarea, select, label") &&
      !target.closest("[data-action]")
    ) {
      return;
    }

    var actionTarget = target.closest("[data-action]");
    var action = actionTarget ? actionTarget.getAttribute("data-action") : "";
    if (!action) return;

    if (action === "timetable-add-slot") {
      addSlot(parseInt(actionTarget.getAttribute("data-weekday") || "1", 10));
      return;
    }

    if (action === "timetable-add-weekday") {
      addSlot(parseInt(actionTarget.getAttribute("data-weekday") || String(getTodayWeekday()), 10));
      return;
    }

    if (action === "timetable-remove-slot") {
      removeSlot(actionTarget.getAttribute("data-slot-id") || "");
      return;
    }

    if (action === "timetable-clear-all") {
      clearAll();
      return;
    }

    if (action === "timetable-apply-template") {
      applyTemplate(actionTarget.getAttribute("data-template-id") || "");
      return;
    }

    if (action === "timetable-expand-slot") {
      expandSlot(actionTarget.getAttribute("data-slot-id") || "");
      return;
    }

    if (action === "timetable-collapse-slot") {
      var collapseId = actionTarget.getAttribute("data-slot-id") || "";
      persistImmediately();
      collapseSlot(collapseId);
      return;
    }
  }

  function onRootInput(event) {
    var target = event.target;
    if (target instanceof HTMLInputElement && target.type === "time") {
      return;
    }
    schedulePersist();
  }

  function onRootChange(event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target instanceof HTMLInputElement && target.type === "time") {
      persistImmediately();
      return;
    }
    schedulePersist();
  }

  function onRootBlur(event) {
    var target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    var card = target.closest(".timetable-slot--editing");
    if (!card) return;

    persistImmediately();

    setTimeout(function () {
      if (!card.isConnected) return;
      var active = document.activeElement;
      if (active && card.contains(active)) return;
      tryCollapseEditingCard(card);
    }, 0);
  }

  function paint() {
    if (!mountedRoot) return;
    mountedRoot.innerHTML = renderMarkup();
  }

  function mount(rootEl) {
    if (!rootEl) return;
    unmount();
    mountedRoot = rootEl;
    paint();
    mountedRoot.addEventListener("click", onRootClick);
    mountedRoot.addEventListener("input", onRootInput);
    mountedRoot.addEventListener("change", onRootChange);
    mountedRoot.addEventListener("blur", onRootBlur, true);
  }

  function unmount() {
    if (!mountedRoot) return;
    if (mountedRoot.isConnected) {
      persistFromDomPruneEmpty();
    }
    mountedRoot.removeEventListener("click", onRootClick);
    mountedRoot.removeEventListener("input", onRootInput);
    mountedRoot.removeEventListener("change", onRootChange);
    mountedRoot.removeEventListener("blur", onRootBlur, true);
    mountedRoot = null;
  }

  window.EduTowerTimetable = {
    mount: mount,
    unmount: unmount,
    getSlots: function () {
      return loadStore().slots.slice();
    },
  };
})();
