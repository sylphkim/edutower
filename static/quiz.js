/**
 * EduTower — 练习测验
 */
(function () {
  "use strict";

  var rootEl = document.getElementById("quizRoot");
  if (!rootEl) return;

  var api = window.EduTowerApi;
  var quizzes = [];
  var skills = [];
  var planTasks = [];
  var activeQuiz = null;
  var answers = {};
  var isBusy = false;
  var isCreating = false;
  var pendingDeleteQuizId = null;
  var banner = { type: "", message: "" };
  var lastSubmittedAnswers = {};

  var DIFFICULTY_LABEL = {
    pass: "及格练",
    high_score: "高分练",
  };

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

  function bindEvents() {
    rootEl.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      var action = target.getAttribute("data-action");
      if (!action) return;

      if (action === "start-quiz") {
        startQuiz(target.getAttribute("data-id"));
      } else if (action === "cancel-quiz") {
        activeQuiz = null;
        answers = {};
        renderList();
      } else if (action === "submit-quiz") {
        submitQuiz();
      } else if (action === "create-quiz") {
        createQuiz();
      } else if (action === "quick-create-quiz") {
        quickCreateTodayQuiz();
      } else if (action === "delete-quiz") {
        pendingDeleteQuizId = target.getAttribute("data-id");
        renderList();
      } else if (action === "confirm-delete-quiz") {
        deleteQuiz(target.getAttribute("data-id"));
      } else if (action === "cancel-delete-quiz") {
        pendingDeleteQuizId = null;
        renderList();
      }
    });

    rootEl.addEventListener("change", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (
        target instanceof HTMLInputElement &&
        target.name &&
        target.name.indexOf("quiz-answer") === 0
      ) {
        answers[target.getAttribute("data-question-id") || ""] = target.value;
        return;
      }

      if (target.id === "quizSkillTarget") {
        var taskSelect = document.getElementById("quizTaskTarget");
        if (taskSelect && target.value) {
          taskSelect.value = "";
        }
      }

      if (target.id === "quizTaskTarget" && target.value) {
        var skillSelect = document.getElementById("quizSkillTarget");
        if (skillSelect) {
          skillSelect.value = "";
        }
      }
    });
  }

  async function refresh() {
    rootEl.innerHTML = '<p class="module-empty module-empty--loading">正在加载练习…</p>';

    try {
      var data = await api.get("/api/quiz");
      quizzes = data && Array.isArray(data.items) ? data.items : [];
      await loadTargetOptions();
      renderList();
    } catch (err) {
      rootEl.innerHTML =
        '<p class="module-empty module-empty--error">加载失败：' +
        api.escapeHtml(api.networkError(err)) +
        "</p>";
    }
  }

  function isQuizRelevantTask(task) {
    if (!task) return false;
    if (task.skillId) return true;
    return task.type === "practice_quiz" || task.type === "master_skill";
  }

  async function loadTargetOptions() {
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
        skills = model.normalizeTreeResponse(skillData).flatSkills;
      } else {
        skills = skillData && Array.isArray(skillData.items) ? skillData.items : [];
      }
    } catch (_err) {
      skills = [];
    }

    planTasks = [];

    var projectId =
      window.EduTowerPlan && typeof window.EduTowerPlan.getProjectId === "function"
        ? window.EduTowerPlan.getProjectId()
        : "";

    if (projectId) {
      try {
        var daily = await api.post(
          "/api/daily/" + encodeURIComponent(projectId) + "/today",
          {}
        );
        var dailyTasks =
          daily && daily.sheet && Array.isArray(daily.sheet.tasks) ? daily.sheet.tasks : [];
        dailyTasks.forEach(function (task) {
          if (task.status === "cancelled" || !isQuizRelevantTask(task)) return;
          if (!task.knowledgeNodeId && task.type !== "practice_quiz") return;
          planTasks.push({
            id: task.id,
            title: task.title,
            type: task.type,
            skillId: task.knowledgeNodeId || "",
            planTitle: "今日学习",
            day: 0,
          });
        });
      } catch (_dailyErr) {
        /* fallback to legacy plan tasks */
      }
    }

    if (planTasks.length) {
      return;
    }

    try {
      var planData = await api.get("/api/plan");
      var plans = planData && Array.isArray(planData.items) ? planData.items : [];
      var active =
        plans.find(function (p) {
          return p.status === "active";
        }) || plans[0];

      if (active && active.days) {
        active.days.forEach(function (day) {
          (day.tasks || []).forEach(function (task) {
            if (!isQuizRelevantTask(task)) return;
            planTasks.push({
              id: task.id,
              title: task.title,
              type: task.type,
              skillId: task.skillId,
              planTitle: active.title,
              day: day.day,
            });
          });
        });
      }
    } catch (_err) {
      planTasks = [];
    }

    if (
      !planTasks.length &&
      window.EduTowerPlan &&
      typeof window.EduTowerPlan.getActivePlanTasks === "function"
    ) {
      planTasks = window.EduTowerPlan.getActivePlanTasks().filter(isQuizRelevantTask);
    }
  }

  function taskTypeLabel(type) {
    var map = {
      read_material: "阅读",
      practice_quiz: "练习",
      review_wrongbook: "错题",
      master_skill: "掌握",
    };
    return map[type] || type;
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

  function renderCreateForm() {
    var model = window.EduTowerSkillsModel;
    var skillOptions = skills
      .map(function (skill) {
        var label = model ? model.formatSkillOptionLabel(skill) : skill.title;
        var disabled = skill.isUnlocked === false ? " disabled" : "";
        return (
          '<option value="' +
          api.escapeAttr(skill.id) +
          '"' +
          disabled +
          ">" +
          api.escapeHtml(label) +
          "</option>"
        );
      })
      .join("");

    var quizReadyTasks = planTasks.filter(function (task) {
      return task.skillId;
    });

    var taskOptions = planTasks
      .map(function (task) {
        var label =
          (task.planTitle ? task.planTitle + " · " : "") +
          "第" +
          (task.day || "?") +
          "天 · " +
          taskTypeLabel(task.type) +
          " · " +
          task.title;
        var disabled = !task.skillId;
        var suffix = disabled ? "（需先在计划中关联技能）" : "";

        return (
          '<option value="' +
          api.escapeAttr(task.id) +
          '" data-skill-id="' +
          api.escapeAttr(task.skillId || "") +
          '"' +
          (disabled ? " disabled" : "") +
          ">" +
          api.escapeHtml(label + suffix) +
          "</option>"
        );
      })
      .join("");

    var hasTarget = skills.length > 0 || quizReadyTasks.length > 0;
    var firstTask = getFirstQuizReadyTask();
    var quickBtn =
      '<button type="button" class="btn btn--primary quiz-create__quick" data-action="quick-create-quiz"' +
      (firstTask && !isCreating ? "" : " disabled") +
      ">" +
      (isCreating ? "生成中…" : "一键生成今日练习") +
      "</button>";
    var planHint =
      planTasks.length && !quizReadyTasks.length
        ? '<p class="quiz-create__hint">学习计划里已有任务，但尚未关联技能。请到「学习计划 → 管理任务」，在任务行选择「关联技能」后保存。</p>'
        : planTasks.length
          ? '<p class="quiz-create__hint">在「按计划任务」下拉框中选择练习/掌握类任务；与「按技能」二选一即可。</p>'
          : '<p class="quiz-create__hint">暂无计划任务。可在「学习计划」中添加「练习测验」或「掌握技能」类任务并关联技能。</p>';

    return (
      '<section class="quiz-create">' +
      '<div class="quiz-create__hero">' +
      '<h3 class="module-subtitle">生成新练习</h3>' +
      quickBtn +
      "</div>" +
      (firstTask
        ? '<p class="quiz-create__hint">将基于今日任务「' +
          api.escapeHtml(firstTask.title) +
          "」自动生成 3 道及格练。</p>"
        : '<p class="quiz-create__hint">今日暂无可练习任务，请先在「学习计划」启用今日学习。</p>') +
      '<div class="quiz-create__row">' +
      '<label class="quiz-create__label" for="quizDifficulty">难度</label>' +
      '<select id="quizDifficulty" class="form-input form-input--compact">' +
      '<option value="pass">及格练（3 题）</option>' +
      '<option value="high_score">高分练（5 题）</option>' +
      "</select>" +
      '<label class="quiz-create__label" for="quizSkillTarget">按技能</label>' +
      '<select id="quizSkillTarget" class="form-input form-input--compact"' +
      (skills.length ? "" : " disabled") +
      ">" +
      '<option value="">选择技能…</option>' +
      skillOptions +
      "</select>" +
      '<label class="quiz-create__label" for="quizTaskTarget">按计划任务</label>' +
      '<select id="quizTaskTarget" class="form-input form-input--compact"' +
      (quizReadyTasks.length ? "" : " disabled") +
      ">" +
      '<option value="">选择计划任务…</option>' +
      taskOptions +
      "</select>" +
      '<button type="button" class="btn btn--primary btn--compact" data-action="create-quiz"' +
      (hasTarget && !isCreating ? "" : " disabled") +
      ">" +
      (isCreating ? "生成中…" : "生成练习") +
      "</button></div>" +
      (isCreating
        ? '<p class="module-empty module-empty--loading quiz-create__loading">正在生成练习，AI 出题大约需要几秒，请稍候…</p>'
        : "") +
      planHint +
      (hasTarget
        ? ""
        : '<p class="module-empty">请先在「技能图谱」创建技能，或在学习计划任务中关联技能。</p>') +
      "</section>"
    );
  }

  function getFirstQuizReadyTask() {
    return planTasks.find(function (task) {
      return task.skillId;
    });
  }

  function autoSelectFirstTask() {
    var firstTask = getFirstQuizReadyTask();
    var taskSelect = document.getElementById("quizTaskTarget");
    if (!firstTask || !taskSelect) return;

    taskSelect.value = firstTask.id;
    var skillSelect = document.getElementById("quizSkillTarget");
    if (skillSelect) {
      skillSelect.value = "";
    }
  }

  function renderList() {
    activeQuiz = null;
    answers = {};

    var createForm = renderCreateForm();

    if (!quizzes.length) {
      rootEl.innerHTML =
        renderBanner() + createForm + '<p class="module-empty">暂无练习，点击上方按钮生成一套。</p>';
      autoSelectFirstTask();
      return;
    }

    var list = quizzes
      .map(function (quiz) {
        if (pendingDeleteQuizId === quiz.id) {
          return (
            '<li class="quiz-list-item quiz-list-item--confirm">' +
            '<p class="module-inline-confirm__text">确定删除「' +
            api.escapeHtml(quiz.title) +
            "」吗？</p>" +
            '<div class="module-inline-confirm__actions">' +
            '<button type="button" class="btn btn--primary btn--compact" data-action="confirm-delete-quiz" data-id="' +
            api.escapeAttr(quiz.id) +
            '">确认删除</button>' +
            '<button type="button" class="btn btn--ghost btn--compact" data-action="cancel-delete-quiz">取消</button></div></li>'
          );
        }

        return (
          '<li class="quiz-list-item">' +
          '<div class="quiz-list-item__body">' +
          '<strong class="quiz-list-item__title">' +
          api.escapeHtml(quiz.title) +
          "</strong>" +
          '<span class="quiz-list-item__meta">' +
          api.escapeHtml(DIFFICULTY_LABEL[quiz.difficulty] || quiz.difficulty) +
          " · " +
          (quiz.questions ? quiz.questions.length : 0) +
          " 题 · " +
          api.escapeHtml(api.formatDate(quiz.createdAt)) +
          "</span></div>" +
          '<div class="quiz-list-item__actions">' +
          '<button type="button" class="btn btn--primary btn--compact" data-action="start-quiz" data-id="' +
          api.escapeAttr(quiz.id) +
          '">开始</button>' +
          '<button type="button" class="btn btn--ghost btn--compact" data-action="delete-quiz" data-id="' +
          api.escapeAttr(quiz.id) +
          '" data-title="' +
          api.escapeAttr(quiz.title) +
          '">删除</button></div></li>'
        );
      })
      .join("");

    rootEl.innerHTML =
      renderBanner() +
      createForm +
      '<ul class="quiz-list">' +
      list +
      "</ul>";
    autoSelectFirstTask();
  }

  async function startQuiz(id) {
    if (!id || isBusy) return;
    isBusy = true;

    try {
      activeQuiz = await api.get("/api/quiz/" + encodeURIComponent(id));
      answers = {};
      renderQuizTaking();
    } catch (err) {
      banner = { type: "error", message: "加载练习失败：" + api.networkError(err) };
      renderList();
    } finally {
      isBusy = false;
    }
  }

  function renderQuizTaking() {
    if (!activeQuiz) return;

    var questionsHtml = (activeQuiz.questions || [])
      .map(function (question, index) {
        var prompt = api.getQuestionPrompt(question);
        var options = api.getQuestionOptions(question);
        var inputHtml = "";

        if (question.type === "single_choice" && options.length) {
          inputHtml =
            '<div class="quiz-options">' +
            options
              .map(function (opt) {
                return (
                  '<label class="quiz-option">' +
                  '<input type="radio" name="quiz-answer-' +
                  api.escapeAttr(question.id) +
                  '" data-question-id="' +
                  api.escapeAttr(question.id) +
                  '" value="' +
                  api.escapeAttr(opt.text) +
                  '" />' +
                  "<span>" +
                  renderText(opt.text) +
                  "</span></label>"
                );
              })
              .join("") +
            "</div>";
        } else {
          inputHtml =
            '<input class="form-input" type="text" name="quiz-answer" data-question-id="' +
            api.escapeAttr(question.id) +
            '" placeholder="输入你的答案" />';
        }

        return (
          '<li class="quiz-question">' +
          '<p class="quiz-question__prompt"><span class="quiz-question__num">' +
          (index + 1) +
          ".</span> " +
          renderText(prompt) +
          "</p>" +
          inputHtml +
          "</li>"
        );
      })
      .join("");

    rootEl.innerHTML =
      renderBanner() +
      '<header class="quiz-taking__header">' +
      "<div>" +
      '<h2 class="module-page-title">' +
      api.escapeHtml(activeQuiz.title) +
      "</h2>" +
      '<p class="module-intro">共 ' +
      (activeQuiz.questions ? activeQuiz.questions.length : 0) +
      " 题，完成后自动判分。</p></div>" +
      '<button type="button" class="btn btn--ghost btn--compact" data-action="cancel-quiz">返回列表</button></header>' +
      '<ol class="quiz-questions">' +
      questionsHtml +
      "</ol>" +
      '<div class="quiz-taking__footer">' +
      '<button type="button" class="btn btn--primary" data-action="submit-quiz">提交答卷</button></div>';
  }

  async function submitQuiz() {
    if (!activeQuiz || isBusy) return;

    var payload = {
      answers: (activeQuiz.questions || []).map(function (question) {
        return {
          questionId: question.id,
          answer: answers[question.id] || "",
        };
      }),
    };

    isBusy = true;
    try {
      var result = await api.post(
        "/api/quiz/" + encodeURIComponent(activeQuiz.id) + "/submit",
        payload
      );
      lastSubmittedAnswers = {};
      payload.answers.forEach(function (entry) {
        lastSubmittedAnswers[entry.questionId] = entry.answer;
      });
      renderResult(result);
    } catch (err) {
      banner = { type: "error", message: "提交失败：" + api.networkError(err) };
      renderQuizTaking();
    } finally {
      isBusy = false;
    }
  }

  function renderResult(result) {
    var wrongMap = {};
    (result.wrongQuestions || []).forEach(function (q) {
      wrongMap[q.id] = q;
    });

    var reviewQuestions =
      activeQuiz && Array.isArray(activeQuiz.questions) ? activeQuiz.questions : [];
    var reviewList = reviewQuestions
      .map(function (q, index) {
        var wrong = wrongMap[q.id];
        var isCorrect = !wrong;
        var userAnswer = lastSubmittedAnswers[q.id] || "（未作答）";
        var cls = isCorrect
          ? "quiz-result__review-item quiz-result__review-item--correct"
          : "quiz-result__review-item quiz-result__review-item--wrong";
        var statusLabel = isCorrect ? "正确" : "错误";
        var correctAnswer = wrong ? wrong.answer || "（无）" : "";
        var explanation =
          wrong && wrong.explanation ? renderText(wrong.explanation) : "";

        return (
          '<li class="' +
          cls +
          '">' +
          '<p class="quiz-result__wrong-prompt"><span class="quiz-question__num">' +
          (index + 1) +
          ".</span> " +
          renderText(api.getQuestionPrompt(q)) +
          ' <span class="quiz-result__status">' +
          statusLabel +
          "</span></p>" +
          '<p class="quiz-result__wrong-meta">你的答案：' +
          renderText(userAnswer) +
          "</p>" +
          (!isCorrect
            ? '<p class="quiz-result__wrong-meta">正确答案：' +
              renderText(correctAnswer) +
              "</p>" +
              (explanation
                ? '<p class="quiz-result__wrong-meta">解析：' + explanation + "</p>"
                : "")
            : "") +
          "</li>"
        );
      })
      .join("");

    rootEl.innerHTML =
      '<section class="quiz-result">' +
      '<h2 class="module-page-title">练习完成</h2>' +
      '<p class="quiz-result__score">' +
      result.score +
      '<small>分</small></p>' +
      '<p class="quiz-result__summary">答对 ' +
      result.correctCount +
      " / " +
      result.total +
      " 题</p>" +
      (reviewList
        ? '<div class="quiz-result__wrong"><h3>答题回顾</h3><ul>' + reviewList + "</ul></div>"
        : '<p class="module-empty">全部正确，继续保持！</p>') +
      '<div class="quiz-result__actions">' +
      '<button type="button" class="btn btn--primary" data-action="cancel-quiz">返回练习列表</button>' +
      '<button type="button" class="btn btn--ghost" data-go-view="wrongbook">查看错题本</button></div></section>';

    rootEl.querySelectorAll("[data-go-view]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (window.EduTowerShell) {
          window.EduTowerShell.switchView(el.getAttribute("data-go-view") || "wrongbook");
        }
      });
    });
  }

  async function quickCreateTodayQuiz() {
    if (isBusy) return;

    var task = getFirstQuizReadyTask();
    if (!task || !task.skillId) {
      banner = {
        type: "error",
        message: "今日暂无可练习任务，请先在「学习计划」启用今日学习。",
      };
      renderList();
      return;
    }

    isBusy = true;
    isCreating = true;
    banner = { type: "", message: "" };
    renderList();

    try {
      await api.post("/api/quiz", {
        title: "今日练习 · " + task.title,
        difficulty: "pass",
        questionCount: 3,
        studyTaskId: task.id,
        skillId: task.skillId,
      });
      banner = { type: "success", message: "今日练习已生成。" };
      await refresh();
    } catch (err) {
      banner = { type: "error", message: "生成失败：" + api.networkError(err) };
      renderList();
    } finally {
      isBusy = false;
      isCreating = false;
    }
  }

  async function createQuiz() {
    if (isBusy) return;

    var select = document.getElementById("quizDifficulty");
    var difficulty = select ? select.value : "pass";
    var count = difficulty === "high_score" ? 5 : 3;
    var skillSelect = document.getElementById("quizSkillTarget");
    var taskSelect = document.getElementById("quizTaskTarget");
    var payload = {
      title: difficulty === "high_score" ? "高分强化练习" : "基础巩固练习",
      difficulty: difficulty,
      questionCount: count,
    };

    if (taskSelect && taskSelect.value) {
      var taskOption = taskSelect.options[taskSelect.selectedIndex];
      var taskSkillId = taskOption ? taskOption.getAttribute("data-skill-id") : "";
      if (!taskSkillId) {
        banner = {
          type: "error",
          message: "该计划任务尚未关联技能，请先在「学习计划 → 管理任务」中为任务选择技能。",
        };
        renderList();
        return;
      }
      payload.studyTaskId = taskSelect.value;
      payload.skillId = taskSkillId;
    } else if (skillSelect && skillSelect.value) {
      payload.skillId = skillSelect.value;
    } else {
      banner = { type: "error", message: "请先选择一个技能或带技能的计划任务。" };
      renderList();
      return;
    }

    isBusy = true;
    isCreating = true;
    banner = { type: "", message: "" };
    renderList();
    try {
      await api.post("/api/quiz", payload);
      await refresh();
    } catch (err) {
      banner = { type: "error", message: "生成失败：" + api.networkError(err) };
      renderList();
    } finally {
      isBusy = false;
      isCreating = false;
    }
  }

  async function deleteQuiz(id) {
    if (isBusy || !id) return;

    isBusy = true;
    try {
      await api.delete("/api/quiz/" + encodeURIComponent(id));
      pendingDeleteQuizId = null;
      banner = { type: "success", message: "练习已删除。" };
      await refresh();
    } catch (err) {
      banner = { type: "error", message: "删除失败：" + api.networkError(err) };
      renderList();
    } finally {
      isBusy = false;
    }
  }

  window.EduTowerQuiz = { refresh: refresh };
})();
