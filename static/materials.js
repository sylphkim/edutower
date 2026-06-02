/**
 * EduTower — 资料录入与列表
 */
(function () {
  "use strict";

  var LOCAL_STORAGE_KEY = "edutower_materials_local";
  var API_BASE = window.EDUTOWER_API || "";
  var UPLOAD_API = API_BASE + "/api/materials/upload";
  var CHUNKS_API = API_BASE + "/api/materials/chunks";

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

  async function submitMaterial() {
    if (isSubmitting) return;

    var payload = collectPayload();
    if (!validatePayload(payload)) return;

    setSubmitting(true);
    hideStatus();

    try {
      var response = await fetch(UPLOAD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      var result = await response.json();

      if (result && result.ok === true) {
        var material = extractMaterial(result.data);
        var localEntry = buildLocalEntry(payload, material);
        saveLocalMaterial(localEntry);

        var stubMessage =
          result.data &&
          result.data.meta &&
          typeof result.data.meta.message === "string"
            ? result.data.meta.message
            : "资料已提交。";

        showStatus("提交成功：" + localEntry.title + "（" + stubMessage + "）", "success");
        resetForm();
        refresh();
        return;
      }

      var errorMessage =
        result && result.error && result.error.message
          ? result.error.message
          : "提交失败（HTTP " + response.status + "）";
      showStatus(errorMessage, "error");
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

  function extractMaterial(data) {
    if (!data || typeof data !== "object") return null;
    if (data.result && data.result.material) return data.result.material;
    if (data.material) return data.material;
    return null;
  }

  function buildLocalEntry(payload, serverMaterial) {
    return {
      id: (serverMaterial && serverMaterial.id) || "local-" + Date.now(),
      title: payload.title,
      subject: payload.subject || "未分类",
      sourceType: payload.sourceType,
      status: (serverMaterial && serverMaterial.status) || "pending",
      uploadedAt: new Date().toISOString(),
      preview:
        payload.sourceType === "text"
          ? payload.content.slice(0, 120)
          : payload.sourceType === "link"
            ? payload.url
            : payload.fileName,
    };
  }

  function readLocalMaterials() {
    try {
      var raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function saveLocalMaterial(entry) {
    var list = readLocalMaterials();
    list.unshift(entry);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  }

  async function fetchChunks() {
    try {
      var response = await fetch(CHUNKS_API);
      var result = await response.json();
      if (result && result.ok === true && result.data && result.data.result) {
        return result.data.result.chunks || [];
      }
    } catch (_err) {
      /* ignore */
    }
    return [];
  }

  function renderMaterialsList(items) {
    listEl.innerHTML = "";
    var hasItems = items.length > 0;
    listEmptyEl.hidden = hasItems;

    items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "materials-list__item";

      var title = document.createElement("strong");
      title.className = "materials-list__title";
      title.textContent = item.title;

      var meta = document.createElement("span");
      meta.className = "materials-list__meta";
      meta.textContent =
        formatSourceType(item.sourceType) +
        " · " +
        (item.subject || "未分类") +
        " · " +
        formatStatus(item.status);

      var preview = document.createElement("p");
      preview.className = "materials-list__preview";
      preview.textContent = item.preview || "—";

      li.appendChild(title);
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

      li.appendChild(order);
      li.appendChild(text);
      chunksEl.appendChild(li);
    });
  }

  function formatSourceType(type) {
    var map = {
      text: "文本笔记",
      link: "网页链接",
      pdf: "PDF",
      doc: "Word",
    };
    return map[type] || type;
  }

  function formatStatus(status) {
    var map = {
      indexed: "已索引",
      uploaded: "已上传",
      pending: "待处理",
    };
    return map[status] || status || "待处理";
  }

  async function refresh() {
    var localItems = readLocalMaterials();
    renderMaterialsList(localItems);
    var chunks = await fetchChunks();
    renderChunksList(chunks);
  }

  window.EduTowerMaterials = {
    refresh: refresh,
  };
})();
