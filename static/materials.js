/**
 * EduTower — 资料录入与列表
 * 文本/链接：POST /api/materials
 * PDF/Word/图片：POST /api/materials/upload（multipart）
 */
(function () {
  "use strict";

  var API_BASE = window.EDUTOWER_API || "";
  var MATERIALS_API = API_BASE + "/api/materials";
  var FOLDERS_API = API_BASE + "/api/material-folders";

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
  var imageInput = document.getElementById("materialImage");
  var folderSelectEl = document.getElementById("materialFolderSelect");
  var resetBtn = document.getElementById("materialResetBtn");
  var submitBtn = document.getElementById("materialSubmitBtn");
  var statusEl = document.getElementById("materialsStatus");
  var listEl = document.getElementById("materialsList");
  var listEmptyEl = document.getElementById("materialsListEmpty");
  var listHintEl = document.getElementById("materialsListHint");
  var chunksEl = document.getElementById("materialChunksList");
  var chunksEmptyEl = document.getElementById("materialChunksEmpty");
  var folderFiltersEl = document.getElementById("materialFolderFilters");
  var subnavItems = document.querySelectorAll(".materials-subnav__item[data-materials-view]");
  var materialsViewEntry = document.getElementById("materialsViewEntry");
  var materialsViewFolders = document.getElementById("materialsViewFolders");
  var materialsViewMove = document.getElementById("materialsViewMove");
  var materialsViewEdit = document.getElementById("materialsViewEdit");
  var materialsMoveNav = document.getElementById("materialsMoveNav");
  var materialsEditNav = document.getElementById("materialsEditNav");
  var folderCreateForm = document.getElementById("materialFolderCreateForm");
  var folderCreateInput = document.getElementById("materialFolderCreateInput");
  var folderCreateErrorEl = document.getElementById("materialFolderCreateError");
  var folderManageListEl = document.getElementById("materialFolderManageList");
  var folderManageEmptyEl = document.getElementById("materialFolderManageEmpty");
  var materialMoveForm = document.getElementById("materialMoveForm");
  var materialMoveOptionsEl = document.getElementById("materialMoveOptions");
  var materialMoveTargetTitleEl = document.getElementById("materialMoveTargetTitle");
  var materialMoveErrorEl = document.getElementById("materialMoveError");
  var materialMoveCancelBtn = document.getElementById("materialMoveCancelBtn");
  var materialEditForm = document.getElementById("materialEditForm");
  var materialEditTitleInput = document.getElementById("materialEditTitle");
  var materialEditFolderSelect = document.getElementById("materialEditFolderSelect");
  var materialEditSummaryInput = document.getElementById("materialEditSummary");
  var materialEditMetaEl = document.getElementById("materialEditMeta");
  var materialEditErrorEl = document.getElementById("materialEditError");
  var materialEditCancelBtn = document.getElementById("materialEditCancelBtn");
  var typeTabs = form.querySelectorAll(".source-type-tab");
  var sourcePanels = form.querySelectorAll("[data-source-panel]");

  var currentSourceType = "text";
  var currentMaterialsView = "entry";
  var selectedFolderFilter = "all";
  var folders = [];
  var isSubmitting = false;
  var isDeleting = false;
  var isEditing = false;
  var isFolderBusy = false;
  var editingFolderId = null;
  var pendingDeleteFolderId = null;
  var pendingDeleteMaterialId = null;
  var movingMaterialId = null;
  var movingMaterialFolderId = null;
  var editingMaterialId = null;

  bindEvents();
  refresh();

  function bindEvents() {
    typeTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        setSourceType(tab.getAttribute("data-source-type") || "text");
      });
    });

    subnavItems.forEach(function (item) {
      item.addEventListener("click", function () {
        var view = item.getAttribute("data-materials-view") || "entry";
        if (view === "move" && !movingMaterialId) {
          return;
        }
        if (view === "edit" && !editingMaterialId) {
          return;
        }
        setMaterialsView(view);
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitMaterial();
    });

    resetBtn.addEventListener("click", resetForm);

    if (folderCreateForm) {
      folderCreateForm.addEventListener("submit", function (event) {
        event.preventDefault();
        submitCreateFolder();
      });
    }

    if (folderManageListEl) {
      folderManageListEl.addEventListener("click", function (event) {
        handleFolderManageClick(event);
      });

      folderManageListEl.addEventListener("submit", function (event) {
        event.preventDefault();
        var target = event.target;
        if (!(target instanceof HTMLFormElement)) return;
        if (target.matches("[data-action='rename-folder-form']")) {
          var folderId = target.getAttribute("data-folder-id");
          if (folderId) {
            saveRenameFolder(folderId, target);
          }
        }
      });
    }

    if (materialMoveForm) {
      materialMoveForm.addEventListener("submit", function (event) {
        event.preventDefault();
        submitMoveMaterial();
      });
    }

    if (materialMoveCancelBtn) {
      materialMoveCancelBtn.addEventListener("click", function () {
        closeMoveView();
      });
    }

    if (materialEditForm) {
      materialEditForm.addEventListener("submit", function (event) {
        event.preventDefault();
        submitEditMaterial();
      });
    }

    if (materialEditCancelBtn) {
      materialEditCancelBtn.addEventListener("click", function () {
        closeEditView();
      });
    }

    if (folderFiltersEl) {
      folderFiltersEl.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) return;

        var filter = target.getAttribute("data-folder-filter");
        if (!filter) return;

        selectedFolderFilter = filter;
        renderFolderFilters();
        syncFolderSelectWithFilter(filter);
        refreshMaterialsOnly();
      });
    }

    listEl.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      var materialAction = target.getAttribute("data-action");
      if (
        materialAction === "delete-material" ||
        materialAction === "confirm-delete-material" ||
        materialAction === "cancel-delete-material"
      ) {
        event.preventDefault();
        event.stopPropagation();

        var materialId = target.getAttribute("data-material-id");
        var materialTitle = target.getAttribute("data-material-title") || "该资料";
        if (materialId) {
          if (materialAction === "confirm-delete-material") {
            confirmDeleteMaterial(materialId, materialTitle);
          } else if (materialAction === "cancel-delete-material") {
            pendingDeleteMaterialId = null;
            refreshMaterialsOnly();
          } else {
            pendingDeleteMaterialId = materialId;
            refreshMaterialsOnly();
          }
        }
        return;
      }

      if (target.matches("[data-action='edit-material']")) {
        event.preventDefault();
        event.stopPropagation();

        var editId = target.getAttribute("data-material-id");
        if (editId) {
          openEditView(editId);
        }
        return;
      }

      if (target.matches("[data-action='move-material']")) {
        event.preventDefault();
        event.stopPropagation();

        var moveId = target.getAttribute("data-material-id");
        var moveTitle = target.getAttribute("data-material-title") || "该资料";
        if (moveId) {
          openMoveView(moveId, moveTitle);
        }
      }
    });
  }

  function setMaterialsView(view) {
    currentMaterialsView = view;

    subnavItems.forEach(function (item) {
      var itemView = item.getAttribute("data-materials-view") || "entry";
      var active = itemView === view;
      item.classList.toggle("materials-subnav__item--active", active);
      item.setAttribute("aria-current", active ? "page" : "false");
    });

    if (materialsViewEntry) {
      var showEntry = view === "entry";
      materialsViewEntry.classList.toggle("is-hidden", !showEntry);
      materialsViewEntry.setAttribute("aria-hidden", showEntry ? "false" : "true");
    }

    if (materialsViewFolders) {
      var showFolders = view === "folders";
      materialsViewFolders.classList.toggle("is-hidden", !showFolders);
      materialsViewFolders.setAttribute("aria-hidden", showFolders ? "false" : "true");
    }

    if (materialsViewMove) {
      var showMove = view === "move";
      materialsViewMove.classList.toggle("is-hidden", !showMove);
      materialsViewMove.setAttribute("aria-hidden", showMove ? "false" : "true");
    }

    if (materialsViewEdit) {
      var showEdit = view === "edit";
      materialsViewEdit.classList.toggle("is-hidden", !showEdit);
      materialsViewEdit.setAttribute("aria-hidden", showEdit ? "false" : "true");
    }

    if (materialsMoveNav) {
      materialsMoveNav.classList.toggle("is-hidden", !movingMaterialId);
    }

    if (materialsEditNav) {
      materialsEditNav.classList.toggle("is-hidden", !editingMaterialId);
    }
  }

  function showFolderCreateError(message) {
    if (!folderCreateErrorEl) return;

    if (!message) {
      folderCreateErrorEl.hidden = true;
      folderCreateErrorEl.textContent = "";
      return;
    }

    folderCreateErrorEl.hidden = false;
    folderCreateErrorEl.textContent = message;
  }

  function showMoveError(message) {
    if (!materialMoveErrorEl) return;

    if (!message) {
      materialMoveErrorEl.hidden = true;
      materialMoveErrorEl.textContent = "";
      return;
    }

    materialMoveErrorEl.hidden = false;
    materialMoveErrorEl.textContent = message;
  }

  function showEditError(message) {
    if (!materialEditErrorEl) return;

    if (!message) {
      materialEditErrorEl.hidden = true;
      materialEditErrorEl.textContent = "";
      return;
    }

    materialEditErrorEl.hidden = false;
    materialEditErrorEl.textContent = message;
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

  function syncFolderSelectWithFilter(filter) {
    if (!folderSelectEl) return;

    if (filter === "unclassified") {
      folderSelectEl.value = "";
      return;
    }

    if (filter !== "all" && folders.some(function (folder) { return folder.id === filter; })) {
      folderSelectEl.value = filter;
    }
  }

  function readSelectedFolderId() {
    if (!folderSelectEl) return null;

    var value = folderSelectEl.value;
    return value ? value : null;
  }

  function findFolderName(folderId) {
    if (!folderId) return "未分类";

    var folder = folders.find(function (entry) {
      return entry.id === folderId;
    });

    return folder ? folder.name : "未分类";
  }

  function getFileInputForSourceType(sourceType) {
    if (sourceType === "pdf") return pdfInput;
    if (sourceType === "doc") return docInput;
    if (sourceType === "image") return imageInput;
    return null;
  }

  function isFileUploadSourceType(sourceType) {
    return sourceType === "pdf" || sourceType === "doc" || sourceType === "image";
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

    if (isFileUploadSourceType(payload.sourceType) && !payload.file) {
      var fileLabel =
        payload.sourceType === "pdf"
          ? "PDF"
          : payload.sourceType === "doc"
            ? "Word"
            : "图片";
      showStatus("请选择 " + fileLabel + " 文件。", "error");
      return false;
    }

    return true;
  }

  function collectPayload() {
    var fileInput = getFileInputForSourceType(currentSourceType);
    var file =
      fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

    return {
      title: titleInput.value.trim(),
      subject: subjectInput.value.trim(),
      folderId: readSelectedFolderId(),
      sourceType: currentSourceType,
      content: contentInput.value.trim(),
      url: linkInput.value.trim(),
      file: file,
      fileName: file ? file.name : "",
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
      image: "photo",
    };

    return {
      title: payload.title,
      type: typeMap[payload.sourceType] || "other",
      source: payload.sourceType === "text" || payload.sourceType === "link" ? "manual" : "uploaded",
      folderId: payload.folderId,
      summary: buildSummary(payload),
    };
  }

  function extractErrorMessage(result, response) {
    if (result && result.error && typeof result.error.message === "string") {
      return result.error.message.trim();
    }
    return "请求失败（HTTP " + response.status + "）";
  }

  async function patchMaterialMetadata(id, body) {
    var response = await fetch(MATERIALS_API + "/" + encodeURIComponent(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    var result = await response.json();

    if (!result || result.ok !== true) {
      throw new Error(extractErrorMessage(result, response));
    }

    return result.data;
  }

  async function submitFileMaterial(payload) {
    var formData = new FormData();
    formData.append("file", payload.file);
    if (payload.folderId) {
      formData.append("folderId", payload.folderId);
    }

    var response = await fetch(MATERIALS_API + "/upload", {
      method: "POST",
      body: formData,
    });
    var result = await response.json();

    if (!result || result.ok !== true || !result.data) {
      showStatus(extractErrorMessage(result, response), "error");
      return;
    }

    var uploaded = result.data;
    var summary = buildSummary(payload);

    try {
      uploaded = await patchMaterialMetadata(uploaded.id, {
        title: payload.title,
        summary: summary,
      });
    } catch (patchErr) {
      showStatus(
        "文件已上传，但更新标题/摘要失败：" + (patchErr.message || "未知错误"),
        "error"
      );
      refresh();
      return;
    }

    showStatus("上传成功：" + uploaded.title, "success");
    resetForm();
    refresh();
  }

  async function submitJsonMaterial(payload) {
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
  }

  async function submitMaterial() {
    if (isSubmitting) return;

    var payload = collectPayload();
    if (!validatePayload(payload)) return;

    setSubmitting(true);
    hideStatus();

    try {
      if (isFileUploadSourceType(payload.sourceType)) {
        await submitFileMaterial(payload);
        return;
      }

      await submitJsonMaterial(payload);
    } catch (err) {
      var friendly =
        err instanceof TypeError && /fetch|network/i.test(String(err.message))
          ? "网络连接失败，请确认 Express 后端已启动。"
          : err.message || "未知错误";
      showStatus(
        (isFileUploadSourceType(payload.sourceType) ? "上传失败：" : "提交失败：") + friendly,
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function fetchFolders() {
    try {
      var response = await fetch(FOLDERS_API);
      var result = await response.json();

      if (result && result.ok === true && result.data && Array.isArray(result.data.items)) {
        return result.data.items;
      }
    } catch (_err) {
      /* ignore */
    }

    return [];
  }

  function buildMaterialsListUrl() {
    if (selectedFolderFilter === "unclassified") {
      return MATERIALS_API + "?folderId=unclassified";
    }

    if (selectedFolderFilter !== "all") {
      return MATERIALS_API + "?folderId=" + encodeURIComponent(selectedFolderFilter);
    }

    return MATERIALS_API;
  }

  async function fetchMaterials() {
    try {
      var response = await fetch(buildMaterialsListUrl());
      var result = await response.json();

      if (result && result.ok === true && result.data && Array.isArray(result.data.items)) {
        return result.data.items;
      }
    } catch (_err) {
      /* ignore */
    }

    return [];
  }

  function renderFolderSelect() {
    if (!folderSelectEl) return;

    var previous = folderSelectEl.value;
    folderSelectEl.innerHTML = '<option value="">未分类</option>';

    folders.forEach(function (folder) {
      var option = document.createElement("option");
      option.value = folder.id;
      option.textContent = folder.name;
      folderSelectEl.appendChild(option);
    });

    if (previous && folders.some(function (folder) { return folder.id === previous; })) {
      folderSelectEl.value = previous;
    }
  }

  function renderFolderFilters() {
    if (!folderFiltersEl) return;

    var filters = [
      { id: "all", label: "全部" },
      { id: "unclassified", label: "未分类" },
    ];

    folderFiltersEl.innerHTML = "";

    filters.forEach(function (filter) {
      var button = document.createElement("button");
      button.type = "button";
      button.className =
        "materials-folder-filter" +
        (selectedFolderFilter === filter.id ? " materials-folder-filter--active" : "");
      button.setAttribute("data-folder-filter", filter.id);
      button.setAttribute("role", "tab");
      button.setAttribute(
        "aria-selected",
        selectedFolderFilter === filter.id ? "true" : "false"
      );
      button.textContent = filter.label;
      folderFiltersEl.appendChild(button);
    });

    folders.forEach(function (folder) {
      var button = document.createElement("button");
      button.type = "button";
      button.className =
        "materials-folder-filter" +
        (selectedFolderFilter === folder.id ? " materials-folder-filter--active" : "");
      button.setAttribute("data-folder-filter", folder.id);
      button.setAttribute("role", "tab");
      button.setAttribute(
        "aria-selected",
        selectedFolderFilter === folder.id ? "true" : "false"
      );
      button.textContent = folder.name;
      folderFiltersEl.appendChild(button);
    });
  }

  function renderFolderManageList() {
    if (!folderManageListEl) return;

    folderManageListEl.innerHTML = "";
    var hasFolders = folders.length > 0;

    if (folderManageEmptyEl) {
      folderManageEmptyEl.hidden = hasFolders;
    }

    folders.forEach(function (folder) {
      var li = document.createElement("li");
      li.className = "materials-folder-manage-list__item";

      if (pendingDeleteFolderId === folder.id) {
        li.className += " materials-folder-manage-list__item--confirm";

        var confirmText = document.createElement("p");
        confirmText.className = "materials-folder-manage-list__confirm-text";
        confirmText.textContent =
          "确定删除「" + folder.name + "」吗？仅空文件夹可删除。";

        var confirmActions = document.createElement("div");
        confirmActions.className = "materials-folder-manage-list__actions";

        var confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.className = "btn btn--primary btn--compact";
        confirmBtn.setAttribute("data-action", "confirm-delete-folder");
        confirmBtn.setAttribute("data-folder-id", folder.id);
        confirmBtn.textContent = "确认删除";

        var cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "btn btn--ghost btn--compact";
        cancelBtn.setAttribute("data-action", "cancel-delete-folder");
        cancelBtn.textContent = "取消";

        confirmActions.appendChild(confirmBtn);
        confirmActions.appendChild(cancelBtn);
        li.appendChild(confirmText);
        li.appendChild(confirmActions);
        folderManageListEl.appendChild(li);
        return;
      }

      if (editingFolderId === folder.id) {
        var renameForm = document.createElement("form");
        renameForm.className = "materials-folder-manage-list__rename-form";
        renameForm.setAttribute("data-action", "rename-folder-form");
        renameForm.setAttribute("data-folder-id", folder.id);

        var renameInput = document.createElement("input");
        renameInput.className = "form-input";
        renameInput.type = "text";
        renameInput.name = "name";
        renameInput.maxLength = 60;
        renameInput.value = folder.name;
        renameInput.required = true;

        var renameActions = document.createElement("div");
        renameActions.className = "materials-folder-manage-list__actions";

        var saveBtn = document.createElement("button");
        saveBtn.type = "submit";
        saveBtn.className = "btn btn--primary btn--compact";
        saveBtn.textContent = "保存";

        var cancelRenameBtn = document.createElement("button");
        cancelRenameBtn.type = "button";
        cancelRenameBtn.className = "btn btn--ghost btn--compact";
        cancelRenameBtn.setAttribute("data-action", "cancel-rename-folder");
        cancelRenameBtn.textContent = "取消";

        renameActions.appendChild(saveBtn);
        renameActions.appendChild(cancelRenameBtn);
        renameForm.appendChild(renameInput);
        renameForm.appendChild(renameActions);
        li.appendChild(renameForm);
        folderManageListEl.appendChild(li);

        renameInput.focus();
        renameInput.select();
        return;
      }

      var name = document.createElement("span");
      name.className = "materials-folder-manage-list__name";
      name.textContent = folder.name;

      var actions = document.createElement("div");
      actions.className = "materials-folder-manage-list__actions";

      var renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "materials-folder-manage-list__action";
      renameBtn.setAttribute("data-action", "start-rename-folder");
      renameBtn.setAttribute("data-folder-id", folder.id);
      renameBtn.textContent = "重命名";

      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "materials-folder-manage-list__action materials-folder-manage-list__action--danger";
      deleteBtn.setAttribute("data-action", "start-delete-folder");
      deleteBtn.setAttribute("data-folder-id", folder.id);
      deleteBtn.textContent = "删除";

      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);
      li.appendChild(name);
      li.appendChild(actions);
      folderManageListEl.appendChild(li);
    });
  }

  function handleFolderManageClick(event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) return;

    var action = target.getAttribute("data-action");
    if (!action) return;

    var folderId = target.getAttribute("data-folder-id");

    if (action === "start-rename-folder" && folderId) {
      event.preventDefault();
      editingFolderId = folderId;
      pendingDeleteFolderId = null;
      renderFolderManageList();
      return;
    }

    if (action === "cancel-rename-folder") {
      event.preventDefault();
      editingFolderId = null;
      renderFolderManageList();
      return;
    }

    if (action === "start-delete-folder" && folderId) {
      event.preventDefault();
      pendingDeleteFolderId = folderId;
      editingFolderId = null;
      renderFolderManageList();
      return;
    }

    if (action === "cancel-delete-folder") {
      event.preventDefault();
      pendingDeleteFolderId = null;
      renderFolderManageList();
      return;
    }

    if (action === "confirm-delete-folder" && folderId) {
      event.preventDefault();
      confirmDeleteFolder(folderId);
    }
  }

  function updateListHint() {
    if (!listHintEl) return;

    if (selectedFolderFilter === "all") {
      listHintEl.textContent = "显示全部资料，支持下载已上传文件";
      return;
    }

    if (selectedFolderFilter === "unclassified") {
      listHintEl.textContent = "当前筛选：未分类资料";
      return;
    }

    listHintEl.textContent = "当前筛选：" + findFolderName(selectedFolderFilter);
  }

  async function submitCreateFolder() {
    if (isFolderBusy || !folderCreateInput) return;

    var trimmedName = folderCreateInput.value.trim();
    showFolderCreateError("");

    if (!trimmedName) {
      showFolderCreateError("文件夹名称不能为空。");
      folderCreateInput.focus();
      return;
    }

    isFolderBusy = true;

    try {
      var response = await fetch(FOLDERS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      var result = await response.json();

      if (!result || result.ok !== true) {
        showFolderCreateError(extractErrorMessage(result, response));
        return;
      }

      folderCreateInput.value = "";
      showStatus("已创建文件夹：" + trimmedName, "success");
      await refresh();
      setMaterialsView("folders");
    } catch (err) {
      showFolderCreateError(err.message || "创建失败");
    } finally {
      isFolderBusy = false;
    }
  }

  async function saveRenameFolder(folderId, renameForm) {
    if (isFolderBusy) return;

    var input = renameForm.querySelector('input[name="name"]');
    if (!(input instanceof HTMLInputElement)) return;

    var trimmedName = input.value.trim();
    if (!trimmedName) {
      showStatus("文件夹名称不能为空。", "error");
      input.focus();
      return;
    }

    isFolderBusy = true;
    hideStatus();

    try {
      var response = await fetch(FOLDERS_API + "/" + encodeURIComponent(folderId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      var result = await response.json();

      if (!result || result.ok !== true) {
        showStatus(extractErrorMessage(result, response), "error");
        return;
      }

      editingFolderId = null;
      showStatus("文件夹已重命名：" + trimmedName, "success");
      await refresh();
      setMaterialsView("folders");
    } catch (err) {
      showStatus("重命名失败：" + (err.message || "未知错误"), "error");
    } finally {
      isFolderBusy = false;
    }
  }

  async function confirmDeleteFolder(folderId) {
    if (isFolderBusy) return;

    var folder = folders.find(function (entry) {
      return entry.id === folderId;
    });
    if (!folder) return;

    isFolderBusy = true;
    hideStatus();

    try {
      var response = await fetch(FOLDERS_API + "/" + encodeURIComponent(folderId), {
        method: "DELETE",
      });
      var result = await response.json();

      if (!result || result.ok !== true) {
        showStatus(extractErrorMessage(result, response), "error");
        return;
      }

      if (selectedFolderFilter === folderId) {
        selectedFolderFilter = "all";
      }

      pendingDeleteFolderId = null;
      showStatus("已删除文件夹：" + folder.name, "success");
      await refresh();
      setMaterialsView("folders");
    } catch (err) {
      showStatus("删除文件夹失败：" + (err.message || "未知错误"), "error");
    } finally {
      isFolderBusy = false;
    }
  }

  function renderMoveOptions() {
    if (!materialMoveOptionsEl) return;

    materialMoveOptionsEl.innerHTML = "";

    var unclassifiedId = "move-folder-unclassified";
    var unclassifiedWrap = document.createElement("label");
    unclassifiedWrap.className = "materials-move-option";

    var unclassifiedInput = document.createElement("input");
    unclassifiedInput.type = "radio";
    unclassifiedInput.name = "targetFolderId";
    unclassifiedInput.value = "";
    unclassifiedInput.id = unclassifiedId;
    unclassifiedInput.checked = movingMaterialFolderId === null;

    var unclassifiedText = document.createElement("span");
    unclassifiedText.textContent = "未分类";

    unclassifiedWrap.appendChild(unclassifiedInput);
    unclassifiedWrap.appendChild(unclassifiedText);
    materialMoveOptionsEl.appendChild(unclassifiedWrap);

    folders.forEach(function (folder) {
      var optionId = "move-folder-" + folder.id;
      var label = document.createElement("label");
      label.className = "materials-move-option";

      var input = document.createElement("input");
      input.type = "radio";
      input.name = "targetFolderId";
      input.value = folder.id;
      input.id = optionId;
      input.checked = movingMaterialFolderId === folder.id;

      var text = document.createElement("span");
      text.textContent = folder.name;

      label.appendChild(input);
      label.appendChild(text);
      materialMoveOptionsEl.appendChild(label);
    });
  }

  async function openMoveView(materialId, materialTitle) {
    movingMaterialId = materialId;
    movingMaterialFolderId = null;
    showMoveError("");

    if (materialMoveTargetTitleEl) {
      materialMoveTargetTitleEl.textContent = materialTitle;
    }

    try {
      var response = await fetch(MATERIALS_API + "/" + encodeURIComponent(materialId));
      var result = await response.json();
      if (result && result.ok === true && result.data) {
        movingMaterialFolderId = result.data.folderId || null;
      }
    } catch (_err) {
      /* use default null */
    }

    renderMoveOptions();
    setMaterialsView("move");
  }

  function closeMoveView() {
    movingMaterialId = null;
    movingMaterialFolderId = null;
    showMoveError("");
    setMaterialsView("entry");
  }

  async function submitMoveMaterial() {
    if (!movingMaterialId || isEditing || !materialMoveForm) return;

    var selected = materialMoveForm.querySelector('input[name="targetFolderId"]:checked');
    if (!(selected instanceof HTMLInputElement)) {
      showMoveError("请选择目标文件夹。");
      return;
    }

    var folderId = selected.value ? selected.value : null;

    isEditing = true;
    showMoveError("");

    try {
      await patchMaterialMetadata(movingMaterialId, { folderId: folderId });
      showStatus("已移动到：" + findFolderName(folderId), "success");
      closeMoveView();
      refreshMaterialsOnly();
    } catch (err) {
      showMoveError(err.message || "移动失败");
    } finally {
      isEditing = false;
    }
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

  function renderEditFolderSelect(selectedFolderId) {
    if (!materialEditFolderSelect) return;

    materialEditFolderSelect.innerHTML = '<option value="">未分类</option>';

    folders.forEach(function (folder) {
      var option = document.createElement("option");
      option.value = folder.id;
      option.textContent = folder.name;
      materialEditFolderSelect.appendChild(option);
    });

    materialEditFolderSelect.value = selectedFolderId || "";
  }

  function buildEditMetaText(item) {
    var parts = [
      formatMaterialType(item.type, item.sourceType),
      formatMaterialSource(item.source),
      formatStatus(item.status),
    ];

    if (item.originalFileName) {
      parts.push(item.originalFileName);
    }

    if (item.fileSize) {
      parts.push(formatFileSize(item.fileSize));
    }

    return parts.join(" · ");
  }

  async function openEditView(id) {
    if (isEditing) return;

    showEditError("");
    hideStatus();

    try {
      var api = window.EduTowerApi;
      var item = api ? await api.get("/api/materials/" + encodeURIComponent(id)) : null;

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

      editingMaterialId = item.id;
      renderEditFolderSelect(item.folderId);

      if (materialEditTitleInput) {
        materialEditTitleInput.value = item.title || "";
      }

      if (materialEditSummaryInput) {
        materialEditSummaryInput.value = item.summary || "";
      }

      if (materialEditMetaEl) {
        materialEditMetaEl.textContent = buildEditMetaText(item);
      }

      setMaterialsView("edit");

      if (materialEditTitleInput) {
        materialEditTitleInput.focus();
        materialEditTitleInput.select();
      }
    } catch (err) {
      showStatus("加载资料失败：" + (err.message || "未知错误"), "error");
    }
  }

  function closeEditView() {
    editingMaterialId = null;
    showEditError("");

    if (materialEditForm) {
      materialEditForm.reset();
    }

    setMaterialsView("entry");
  }

  async function submitEditMaterial() {
    if (!editingMaterialId || isEditing) return;

    var title = materialEditTitleInput ? materialEditTitleInput.value.trim() : "";
    var summary = materialEditSummaryInput ? materialEditSummaryInput.value.trim() : "";
    var folderId = materialEditFolderSelect ? materialEditFolderSelect.value || null : null;

    showEditError("");

    if (!title) {
      showEditError("资料标题不能为空。");
      if (materialEditTitleInput) materialEditTitleInput.focus();
      return;
    }

    isEditing = true;

    try {
      var updated = await patchMaterialMetadata(editingMaterialId, {
        title: title,
        summary: summary,
        folderId: folderId,
      });

      showStatus("已更新：" + updated.title, "success");
      closeEditView();
      refreshMaterialsOnly();
    } catch (err) {
      showEditError(err.message || "更新失败");
    } finally {
      isEditing = false;
    }
  }

  async function confirmDeleteMaterial(id, title) {
    if (isDeleting) return;

    isDeleting = true;
    hideStatus();

    try {
      var response = await fetch(MATERIALS_API + "/" + encodeURIComponent(id), {
        method: "DELETE",
      });
      var result = await response.json();

      if (result && result.ok === true) {
        pendingDeleteMaterialId = null;
        showStatus("已删除：" + title, "success");
        refreshMaterialsOnly();
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

      if (pendingDeleteMaterialId === item.id) {
        li.classList.add("materials-list__item--confirm");

        var confirmText = document.createElement("p");
        confirmText.className = "materials-list__confirm-text";
        confirmText.textContent = "确定删除「" + item.title + "」吗？删除后不可恢复。";

        var confirmActions = document.createElement("div");
        confirmActions.className = "materials-list__actions";

        var confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.className = "materials-list__delete";
        confirmBtn.setAttribute("data-action", "confirm-delete-material");
        confirmBtn.setAttribute("data-material-id", item.id);
        confirmBtn.setAttribute("data-material-title", item.title);
        confirmBtn.textContent = "确认删除";

        var cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "materials-list__edit";
        cancelBtn.setAttribute("data-action", "cancel-delete-material");
        cancelBtn.textContent = "取消";

        confirmActions.appendChild(confirmBtn);
        confirmActions.appendChild(cancelBtn);
        li.appendChild(confirmText);
        li.appendChild(confirmActions);
        listEl.appendChild(li);
        return;
      }

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

      var moveBtn = document.createElement("button");
      moveBtn.type = "button";
      moveBtn.className = "materials-list__move";
      moveBtn.setAttribute("data-action", "move-material");
      moveBtn.setAttribute("data-material-id", item.id);
      moveBtn.setAttribute("data-material-title", item.title);
      moveBtn.setAttribute("aria-label", "移动资料：" + item.title);
      moveBtn.textContent = "移动";

      var actions = document.createElement("div");
      actions.className = "materials-list__actions";

      if (item.storagePath) {
        var downloadLink = document.createElement("a");
        downloadLink.className = "materials-list__download";
        downloadLink.href = MATERIALS_API + "/" + encodeURIComponent(item.id) + "/download";
        downloadLink.textContent = "下载";
        downloadLink.setAttribute("aria-label", "下载资料：" + item.title);
        actions.appendChild(downloadLink);
      }

      actions.appendChild(moveBtn);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      header.appendChild(title);
      header.appendChild(actions);

      var meta = document.createElement("span");
      meta.className = "materials-list__meta";
      meta.textContent =
        formatMaterialType(item.type, item.sourceType) +
        " · " +
        formatMaterialSource(item.source) +
        " · " +
        findFolderName(item.folderId) +
        " · " +
        formatStatus(item.status) +
        formatUploadedFileMeta(item) +
        (item.updatedAt || item.createdAt
          ? " · " + formatMaterialDate(item.updatedAt || item.createdAt)
          : "");

      var preview = document.createElement("p");
      preview.className = "materials-list__preview";
      preview.textContent = item.summary || formatUploadedFilePreview(item) || "—";

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

  function formatMaterialType(type, sourceType) {
    if (sourceType === "pdf") return "PDF 文档";
    if (sourceType === "doc") return "Word 文档";
    if (sourceType === "image") return "图片";

    var map = {
      note: "文本笔记",
      slides: "PDF/课件",
      outline: "Word/大纲",
      photo: "图片",
      other: "其他",
    };
    return map[type] || type;
  }

  function formatFileSize(bytes) {
    if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
      return "";
    }

    if (bytes < 1024) {
      return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatUploadedFileMeta(item) {
    if (item.source !== "uploaded" || !item.originalFileName) {
      return "";
    }

    var sizeLabel = formatFileSize(item.fileSize);
    return " · " + item.originalFileName + (sizeLabel ? " · " + sizeLabel : "");
  }

  function formatUploadedFilePreview(item) {
    if (item.source !== "uploaded" || !item.originalFileName) {
      return "";
    }

    return "已上传文件：" + item.originalFileName;
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

  async function refreshMaterialsOnly() {
    var items = await fetchMaterials();
    renderMaterialsList(items);
    renderChunksList(buildPreviewChunks(items));
    updateListHint();
  }

  async function refresh() {
    folders = await fetchFolders();
    renderFolderSelect();
    renderFolderFilters();
    renderFolderManageList();
    if (movingMaterialId) {
      renderMoveOptions();
    }
    if (editingMaterialId && materialEditFolderSelect) {
      renderEditFolderSelect(materialEditFolderSelect.value || null);
    }
    await refreshMaterialsOnly();
    setMaterialsView(currentMaterialsView);
  }

  window.EduTowerMaterials = {
    refresh: refresh,
  };
})();
