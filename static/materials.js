/**
 * EduTower — 资料录入与列表
 * 对接 Express CRUD：GET/POST /api/materials
 */
(function () {
  "use strict";

  var API_BASE = window.EDUTOWER_API || "";
  var MATERIALS_API = API_BASE + "/api/materials";

  var form = document.getElementById("materialForm");
  if (!form) {
    return;
  }

  var titleInput = document.getElementById("materialTitle");
  var subjectInput = document.getElementById("materialSubject");
  var contentInput = document.getElementById("materialContent");
  var linkInput = document.getElementById("materialLink");
  var pdfInput = document.getElementById("materialPdf");
  var docInput = document.getElementById("materialDoc");
  var resetBtn = document.getElementById("materialResetBtn");
  var submitBtn = document.getElementById("materialSubmitBtn");
  var statusEl = document.getElementById("materialsStatus");
  var listEl = document.getElementById("materialsList");
  var listEmptyEl = document.getElementById("materialsListEmpty");
  var chunksEl = document.getElementById("materialChunksList");
  var chunksEmptyEl = document.getElementById("materialChunksEmpty");
  var typeTabs = form.querySelectorAll(".source-type-tab");
  var sourcePanels = form.querySelectorAll("[data-source-panel]");

  var currentSourceType = "text";
  var isSubmitting = false;
  var isDeleting = false;
  var isEditing = false;

  bindEvents();
  refresh();

  function bindEvents() {
    typeTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        setSourceType(tab.getAttribute("data-source-type") || "text");
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitMaterial();
    });

    resetBtn.addEventListener("click", resetForm);

    listEl.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.matches("[data-action='delete-material']")) {
        event.preventDefault();
        event.stopPropagation();

        var materialId = target.getAttribute("data-material-id");
        var materialTitle = target.getAttribute("data-material-title") || "该资料";
        if (materialId) {
          deleteMaterial(materialId, materialTitle);
        }
        return;
      }

      if (target.matches("[data-action='edit-material']")) {
        event.preventDefault();
        event.stopPropagation();

        var editId = target.getAttribute("data-material-id");
        if (editId) {
          openEditDialog(editId);
        }
      }
    });
  }

  function setSourceType(type) {
    currentSourceType = type;

    typeTabs.forEach(function (tab) {
      var active = tab.getAttribute("data-source-type") === type;
      tab.classList.toggle("source-type-tab--active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    sourcePanels.forEach(function (panel) {
      var show = panel.getAttribute("data-source-panel") === type;
      panel.classList.toggle("is-hidden", !show);
    });
  }

  function resetForm() {
    form.reset();
    setSourceType("text");
    hideStatus();
  }

  function setSubmitting(submitting) {
    isSubmitting = submitting;
    submitBtn.disabled = submitting;
    resetBtn.disabled = submitting;
    submitBtn.querySelector(".btn__label").classList.toggle("is-hidden", submitting);
    submitBtn.querySelector(".btn__loading").classList.toggle("is-hidden", !submitting);
  }

  function showStatus(message, type) {
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = "materials-status materials-status--" + (type || "info");
  }

  function hideStatus() {
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.className = "materials-status";
  }

  function validatePayload(payload) {
    if (!payload.title) {
      showStatus("请填写资料标题。", "error");
      titleInput.focus();
      return false;
    }

    if (payload.sourceType === "text" && !payload.content) {
      showStatus("请填写笔记内容。", "error");
      contentInput.focus();
      return false;
    }

    if (payload.sourceType === "link") {
      if (!payload.url) {
        showStatus("请填写网页链接。", "error");
        linkInput.focus();
        return false;
      }
      try {
        new URL(payload.url);
      } catch (_err) {
        showStatus("链接格式不正确，请以 http:// 或 https:// 开头。", "error");
        linkInput.focus();
        return false;
      }
    }

    if (payload.sourceType === "pdf" && !payload.fileName) {
      showStatus("请选择 PDF 文件。", "error");
      return false;
    }

    if (payload.sourceType === "doc" && !payload.fileName) {
      showStatus("请选择 Word 文件。", "error");
      return false;
    }

    return true;
  }

  function collectPayload() {
    var fileInput = currentSourceType === "pdf" ? pdfInput : currentSourceType === "doc" ? docInput : null;
    var fileName =
      fileInput && fileInput.files && fileInput.files[0]
        ? fileInput.files[0].name
        : "";

    return {
      title: titleInput.value.trim(),
      subject: subjectInput.value.trim(),
      sourceType: currentSourceType,
      content: contentInput.value.trim(),
      url: linkInput.value.trim(),
      fileName: fileName,
    };
  }

  function buildSummary(payload) {
    var subjectPrefix = payload.subject ? "【" + payload.subject + "】 " : "";

    if (payload.sourceType === "text") {
      return subjectPrefix + payload.content;
    }

    if (payload.sourceType === "link") {
      return subjectPrefix + payload.url;
    }

    return subjectPrefix + payload.fileName;
  }

  function mapToApiBody(payload) {
    var typeMap = {
      text: "note",
      link: "other",
      pdf: "slides",
      doc: "outline",
    };

    return {
      title: payload.title,
      type: typeMap[payload.sourceType] || "other",
      source: payload.sourceType === "text" || payload.sourceType === "link" ? "manual" : "uploaded",
      summary: buildSummary(payload),
    };
  }

  function extractErrorMessage(result, response) {
    if (result && result.error && typeof result.error.message === "string") {
      return result.error.message.trim();
    }
    return "请求失败（HTTP " + response.status + "）";
  }

  async function submitMaterial() {
    if (isSubmitting) return;

    var payload = collectPayload();
    if (!validatePayload(payload)) return;

    setSubmitting(true);
    hideStatus();

    try {
      var response = await fetch(MATERIALS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapToApiBody(payload)),
      });

      var result = await response.json();

      if (result && result.ok === true && result.data) {
        showStatus("提交成功：" + result.data.title, "success");
        resetForm();
        refresh();
        return;
      }

      showStatus(extractErrorMessage(result, response), "error");
    } catch (err) {
      var friendly =
        err instanceof TypeError && /fetch|network/i.test(String(err.message))
          ? "网络连接失败，请确认 Express 后端已启动。"
          : err.message || "未知错误";
      showStatus("提交失败：" + friendly, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function fetchMaterials() {
    try {
      var response = await fetch(MATERIALS_API);
      var result = await response.json();

      if (result && result.ok === true && result.data && Array.isArray(result.data.items)) {
        return result.data.items;
      }
    } catch (_err) {
      /* ignore */
    }

    return [];
  }

  function buildPreviewChunks(items) {
    var chunks = [];

    items.forEach(function (item) {
      if (!item.summary) return;

      var parts = item.summary
        .split(/\n+|(?<=[。！？.!?])\s*/)
        .map(function (part) {
          return part.trim();
        })
        .filter(Boolean);

      if (parts.length === 0) {
        parts = [item.summary];
      }

      parts.forEach(function (text) {
        chunks.push({
          order: chunks.length + 1,
          text: text,
          title: item.title,
        });
      });
    });

    return chunks;
  }

  async function openEditDialog(id) {
    if (isEditing) return;

    try {
      var api = window.EduTowerApi;
      var item = api
        ? await api.get("/api/materials/" + encodeURIComponent(id))
        : null;

      if (!item) {
        var items = await fetchMaterials();
        item = items.find(function (entry) {
          return entry.id === id;
        });
      }

      if (!item) {
        showStatus("找不到该资料。", "error");
        return;
      }

      var newTitle = window.prompt("修改资料标题", item.title);
      if (newTitle === null) return;

      var trimmedTitle = newTitle.trim();
      if (!trimmedTitle) {
        showStatus("标题不能为空。", "error");
        return;
      }

      var newSummary = window.prompt("修改摘要/内容预览", item.summary || "");
      if (newSummary === null) return;

      isEditing = true;
      hideStatus();

      var patchBody = { title: trimmedTitle, summary: newSummary.trim() };
      var response = await fetch(MATERIALS_API + "/" + encodeURIComponent(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      var result = await response.json();

      if (result && result.ok === true) {
        showStatus("已更新：" + trimmedTitle, "success");
        refresh();
        return;
      }

      showStatus(extractErrorMessage(result, response), "error");
    } catch (err) {
      showStatus("更新失败：" + (err.message || "未知错误"), "error");
    } finally {
      isEditing = false;
    }
  }

  async function deleteMaterial(id, title) {
    if (isDeleting) return;

    if (!window.confirm("确定删除「" + title + "」吗？删除后不可恢复。")) {
      return;
    }

    isDeleting = true;
    hideStatus();

    try {
      var response = await fetch(MATERIALS_API + "/" + encodeURIComponent(id), {
        method: "DELETE",
      });
      var result = await response.json();

      if (result && result.ok === true) {
        showStatus("已删除：" + title, "success");
        refresh();
        return;
      }

      showStatus(extractErrorMessage(result, response), "error");
    } catch (err) {
      var friendly =
        err instanceof TypeError && /fetch|network/i.test(String(err.message))
          ? "网络连接失败，请确认 Express 后端已启动。"
          : err.message || "未知错误";
      showStatus("删除失败：" + friendly, "error");
    } finally {
      isDeleting = false;
    }
  }

  function renderMaterialsList(items) {
    listEl.innerHTML = "";
    var hasItems = items.length > 0;
    listEmptyEl.hidden = hasItems;

    items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "materials-list__item";

      var header = document.createElement("div");
      header.className = "materials-list__header";

      var title = document.createElement("strong");
      title.className = "materials-list__title";
      title.textContent = item.title;

      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "materials-list__delete";
      deleteBtn.setAttribute("data-action", "delete-material");
      deleteBtn.setAttribute("data-material-id", item.id);
      deleteBtn.setAttribute("data-material-title", item.title);
      deleteBtn.setAttribute("aria-label", "删除资料：" + item.title);
      deleteBtn.textContent = "删除";

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "materials-list__edit";
      editBtn.setAttribute("data-action", "edit-material");
      editBtn.setAttribute("data-material-id", item.id);
      editBtn.setAttribute("aria-label", "编辑资料：" + item.title);
      editBtn.textContent = "编辑";

      var actions = document.createElement("div");
      actions.className = "materials-list__actions";
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      header.appendChild(title);
      header.appendChild(actions);

      var meta = document.createElement("span");
      meta.className = "materials-list__meta";
      meta.textContent =
        formatMaterialType(item.type) +
        " · " +
        formatMaterialSource(item.source) +
        " · " +
        formatStatus(item.status) +
        (item.updatedAt || item.createdAt
          ? " · " + formatMaterialDate(item.updatedAt || item.createdAt)
          : "");

      var preview = document.createElement("p");
      preview.className = "materials-list__preview";
      preview.textContent = item.summary || "—";

      li.appendChild(header);
      li.appendChild(meta);
      li.appendChild(preview);
      listEl.appendChild(li);
    });
  }

  function renderChunksList(chunks) {
    chunksEl.innerHTML = "";
    var hasChunks = chunks.length > 0;
    chunksEmptyEl.hidden = hasChunks;

    chunks.forEach(function (chunk) {
      var li = document.createElement("li");
      li.className = "chunk-list__item";

      var order = document.createElement("span");
      order.className = "chunk-list__order";
      order.textContent = "#" + chunk.order;

      var text = document.createElement("p");
      text.className = "chunk-list__text";
      text.textContent = chunk.text;

      if (chunk.title) {
        var source = document.createElement("span");
        source.className = "chunk-list__source";
        source.textContent = chunk.title;
        li.appendChild(source);
      }

      li.appendChild(order);
      li.appendChild(text);
      chunksEl.appendChild(li);
    });
  }

  function formatMaterialType(type) {
    var map = {
      note: "文本笔记",
      slides: "PDF/课件",
      outline: "Word/大纲",
      photo: "图片",
      other: "其他",
    };
    return map[type] || type;
  }

  function formatMaterialSource(source) {
    var map = {
      manual: "手动录入",
      uploaded: "文件上传",
      mock: "系统示例",
    };
    return map[source] || source;
  }

  function formatStatus(status) {
    var map = {
      ready: "已就绪",
      pending: "待处理",
      processing: "处理中",
      failed: "失败",
    };
    return map[status] || status || "待处理";
  }

  function formatMaterialDate(iso) {
    if (window.EduTowerApi && typeof window.EduTowerApi.formatDate === "function") {
      return window.EduTowerApi.formatDate(iso);
    }
    return iso || "";
  }

  async function refresh() {
    var items = await fetchMaterials();
    renderMaterialsList(items);
    renderChunksList(buildPreviewChunks(items));
  }

  window.EduTowerMaterials = {
    refresh: refresh,
  };
})();
