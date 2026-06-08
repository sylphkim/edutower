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
  var pendingDeleteQuizId = null;
  var banner = { type: "", message: "" };

  var DIFFICULTY_LABEL = {
    pass: "及格练",
    high_score: "高分练",
  };

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
      if (!(target instanceof HTMLInputElement)) return;
      if (target.name !== "quiz-answer") return;
      answers[target.getAttribute("data-question-id") || ""] = target.value;
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

  async function loadTargetOptions() {
    try {
      var skillData = await api.get("/api/skills");
      skills = skillData && Array.isArray(skillData.items) ? skillData.items : [];
    } catch (_err) {
      skills = [];
    }

    if (window.EduTowerPlan && typeof window.EduTowerPlan.getActivePlanTasks === "function") {
      planTasks = window.EduTowerPlan
        .getActivePlanTasks()
        .filter(function (task) {
          return task && task.skillId;
        });
    } else {
      planTasks = [];
    }
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
    var skillOptions = skills
      .map(function (skill) {
        return (
          '<option value="' +
          api.escapeAttr(skill.id) +
          '">' +
          api.escapeHtml(skill.title) +
          "</option>"
        );
      })
      .join("");

    var taskOptions = planTasks
      .map(function (task) {
        return (
          '<option value="' +
          api.escapeAttr(task.id) +
          '" data-skill-id="' +
          api.escapeAttr(task.skillId) +
          '">' +
          api.escapeHtml(task.title) +
          "</option>"
        );
      })
      .join("");

    var hasTarget = skills.length > 0 || planTasks.length > 0;

    return (
      '<section class="quiz-create">' +
      '<h3 class="module-subtitle">生成新练习</h3>' +
      '<div class="quiz-create__row">' +
      '<select id="quizDifficulty" class="form-input form-input--compact">' +
      '<option value="pass">及格练（3 题）</option>' +
      '<option value="high_score">高分练（5 题）</option>' +
      "</select>" +
      '<select id="quizSkillTarget" class="form-input form-input--compact">' +
      '<option value="">按技能生成</option>' +
      skillOptions +
      "</select>" +
      '<select id="quizTaskTarget" class="form-input form-input--compact">' +
      '<option value="">按计划任务生成</option>' +
      taskOptions +
      "</select>" +
      '<button type="button" class="btn btn--primary btn--compact" data-action="create-quiz"' +
      (hasTarget ? "" : " disabled") +
      ">生成练习</button></div>" +
      (hasTarget
        ? ""
        : '<p class="module-empty">请先创建技能，或创建带技能的计划任务。</p>') +
      "</section>"
    );
  }

  function renderList() {
    activeQuiz = null;
    answers = {};

    var createForm = renderCreateForm();

    if (!quizzes.length) {
      rootEl.innerHTML =
        renderBanner() + createForm + '<p class="module-empty">暂无练习，点击上方按钮生成一套。</p>';
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
                  '<input type="radio" name="quiz-answer" data-question-id="' +
                  api.escapeAttr(question.id) +
                  '" value="' +
                  api.escapeAttr(opt.text) +
                  '" />' +
                  "<span>" +
                  api.escapeHtml(opt.text) +
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
          api.escapeHtml(prompt) +
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
      await syncWrongbook(result, payload.answers);
      renderResult(result);
    } catch (err) {
      banner = { type: "error", message: "提交失败：" + api.networkError(err) };
      renderQuizTaking();
    } finally {
      isBusy = false;
    }
  }

  async function syncWrongbook(result, submittedAnswers) {
    if (!result.wrongQuestions || !result.wrongQuestions.length) return;

    var answerMap = {};
    submittedAnswers.forEach(function (entry) {
      answerMap[entry.questionId] = entry.answer;
    });

    for (var i = 0; i < result.wrongQuestions.length; i++) {
      var question = result.wrongQuestions[i];
      try {
        await api.post("/api/wrongbook", {
          question: question,
          wrongAnswer: answerMap[question.id] || "",
          subject: "math-calculus",
          category: "uncategorized",
        });
      } catch (_err) {
        /* 单条失败不影响整体 */
      }
    }
  }

  function renderResult(result) {
    var wrongList = (result.wrongQuestions || [])
      .map(function (q) {
        return "<li>" + api.escapeHtml(api.getQuestionPrompt(q)) + "</li>";
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
      (wrongList
        ? '<div class="quiz-result__wrong"><h3>错题回顾</h3><ul>' + wrongList + "</ul></div>"
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
      payload.studyTaskId = taskSelect.value;
      var taskOption = taskSelect.options[taskSelect.selectedIndex];
      var taskSkillId = taskOption ? taskOption.getAttribute("data-skill-id") : "";
      if (taskSkillId) {
        payload.skillId = taskSkillId;
      }
    } else if (skillSelect && skillSelect.value) {
      payload.skillId = skillSelect.value;
    } else {
      banner = { type: "error", message: "请先选择一个技能或带技能的计划任务。" };
      renderList();
      return;
    }

    isBusy = true;
    banner = { type: "", message: "" };
    try {
      await api.post("/api/quiz", payload);
      await refresh();
    } catch (err) {
      banner = { type: "error", message: "生成失败：" + api.networkError(err) };
      renderList();
    } finally {
      isBusy = false;
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
