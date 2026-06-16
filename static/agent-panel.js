/**
 * EduTower — Agent 侧栏面板
 * Agent 状态：GET /api/agent/panel（后端生成）
 * 学习锦囊：技能树推荐 + 记忆技巧
 * 今日复习清单：只读，来自学习计划「今日学习」任务
 */
(function () {
  "use strict";

  var API_BASE = window.EDUTOWER_API || "";
  var PANEL_API = API_BASE + "/api/agent/panel";
  var SESSION_KEY = "edutower_session_id";
  var CONVERSATION_KEY = "edutower_conversation_id";

  var GENERIC_MEMORY_TIPS = [
    {
      title: "主动回忆",
      text: "先合上书回忆要点，再对照笔记补漏，比反复阅读更能巩固长期记忆。",
    },
    {
      title: "间隔复习",
      text: "今天学、明天回顾、一周后再巩固，按遗忘曲线安排复习比临时突击更有效。",
    },
    {
      title: "费曼技巧",
      text: "试着把知识点讲给同学听；讲不清楚的地方，就是你还没真正理解的地方。",
    },
    {
      title: "交错练习",
      text: "同一章节里混合不同题型练习，比按题型一块块刷更能提升迁移能力。",
    },
    {
      title: "先测后学",
      text: "做题前先快速自测旧知识，激活已有记忆后再学新内容，吸收会更快。",
    },
    {
      title: "错题复盘",
      text: "错题不要只看答案，写下「错在哪一步、正确思路是什么」，下次才不容易再错。",
    },
  ];

  var TOPIC_MEMORY_TIPS = [
    {
      keywords: ["极限", "连续"],
      tips: [
        {
          title: "先画图再算",
          text: "极限题先画函数趋势或数轴示意，判断左右极限是否一致，再代入计算。",
        },
        {
          title: "抓主导项",
          text: "无穷大比阶时，先比较最高次项系数，往往比展开全部式子更省时间。",
        },
      ],
    },
    {
      keywords: ["导数", "微分"],
      tips: [
        {
          title: "几何意义先行",
          text: "看到导数先想切线斜率与单调性，再套公式，不容易在求导细节上绕晕。",
        },
        {
          title: "复合函数分层",
          text: "链式法则先把内外层函数标出来，一层层求，避免漏乘某层导数。",
        },
      ],
    },
    {
      keywords: ["积分"],
      tips: [
        {
          title: "先判类型",
          text: "不定积分先判断能否直接公式、换元还是分部，定积分则优先看对称性与几何面积。",
        },
        {
          title: "写清中间步骤",
          text: "积分题中间变量换元要写清楚，回代时不易出错，也方便自查。",
        },
      ],
    },
    {
      keywords: ["中值", "罗尔", "拉格朗日"],
      tips: [
        {
          title: "条件对照表",
          text: "中值定理题先逐条核对连续、可导、端点值等条件，缺一条就不能直接用。",
        },
      ],
    },
    {
      keywords: ["二次", "抛物"],
      tips: [
        {
          title: "顶点式优先",
          text: "二次函数求最值或画图，优先化为顶点式，对称轴与最值一眼可见。",
        },
      ],
    },
    {
      keywords: ["行列式", "矩阵", "线代"],
      tips: [
        {
          title: "行变换记符号",
          text: "行列式行交换要变号，某行乘 k 则整体乘 k，按规则逐步化简不易乱。",
        },
      ],
    },
  ];

  var statusEl = document.getElementById("agentStatusDisplay");
  var tipsEl = document.getElementById("agentTipsDisplay");
  var checklistEl = document.getElementById("agentChecklistDisplay");
  if (!statusEl || !tipsEl || !checklistEl) {
    return;
  }

  var backendData = null;
  var dailyTasks = [];
  var recommendedSkills = [];
  var featuredSkill = null;
  var currentTipPool = GENERIC_MEMORY_TIPS.slice();
  var currentTipIndex = -1;
  var isLoadingPanel = false;
  var isLoadingChecklist = false;
  var isLoadingTips = false;

  bindEvents();
  refreshStudyTips();
  refreshChecklistFromDaily();
  refreshFromBackend();

  function getSessionId() {
    return sessionStorage.getItem(SESSION_KEY) || "default";
  }

  function getConversationId() {
    return sessionStorage.getItem(CONVERSATION_KEY) || "";
  }

  function getProjectId() {
    return window.EduTowerPlan && typeof window.EduTowerPlan.getProjectId === "function"
      ? window.EduTowerPlan.getProjectId()
      : "";
  }

  function flattenSkills(nodes, list) {
    var target = list || [];
    (nodes || []).forEach(function (node) {
      target.push(node);
      if (node.children && node.children.length) {
        flattenSkills(node.children, target);
      }
    });
    return target;
  }

  function scoreSkill(skill) {
    if (!skill || skill.archivedAt) return -1;
    if (skill.isUnlocked === false) return -1;
    if (skill.learningState === "mastered") return -1;

    var score = 0;
    if (skill.prerequisiteRisk) score += 45;
    if (skill.learningState === "learning") score += 35;

    var mastery = Number(skill.mastery);
    if (!Number.isNaN(mastery)) {
      score += Math.max(0, 55 - mastery);
    }

    if (skill.learningState === "not_started") score += 12;
    return score;
  }

  function skillMetaLabel(skill) {
    if (skill.prerequisiteRisk) return "前置风险 · 建议优先";
    if (skill.learningState === "learning") return "学习中 · 掌握度 " + Math.round(Number(skill.mastery) || 0) + "%";
    if (typeof skill.mastery === "number") return "掌握度 " + Math.round(skill.mastery) + "%";
    return "待巩固";
  }

  function buildTipPoolForSkill(skill) {
    var title = skill && skill.title ? String(skill.title) : "";
    var pool = [];
    TOPIC_MEMORY_TIPS.forEach(function (group) {
      var matched = group.keywords.some(function (keyword) {
        return title.indexOf(keyword) !== -1;
      });
      if (matched) {
        pool = pool.concat(group.tips);
      }
    });
    return pool.length ? pool : GENERIC_MEMORY_TIPS.slice();
  }

  function pickTipIndex(pool) {
    if (!pool.length) return 0;
    if (pool.length === 1) return 0;

    var nextIndex = currentTipIndex;
    var guard = 0;
    while (nextIndex === currentTipIndex && guard < 8) {
      nextIndex = Math.floor(Math.random() * pool.length);
      guard += 1;
    }
    return nextIndex;
  }

  function renderStudyTips(animate) {
    var kpHtml = "";

    if (recommendedSkills.length) {
      kpHtml =
        '<ul class="agent-tips-kp">' +
        recommendedSkills
          .map(function (skill) {
            return (
              '<li class="agent-tips-kp__item">' +
              '<span class="agent-tips-kp__badge">建议复习</span>' +
              '<span class="agent-tips-kp__title">' +
              escapeHtml(skill.title) +
              "</span>" +
              '<span class="agent-tips-kp__meta">' +
              escapeHtml(skillMetaLabel(skill)) +
              "</span></li>"
            );
          })
          .join("") +
        "</ul>";
    } else {
      kpHtml =
        '<p class="agent-tips-empty">暂无技能推荐。可在「学习计划」中启用方向，或在「技能图谱」中标记学习进度。</p>';
    }

    var tipIndex = pickTipIndex(currentTipPool);
    var tip = currentTipPool[tipIndex] || GENERIC_MEMORY_TIPS[0];
    currentTipIndex = tipIndex;

    function applyHtml() {
      tipsEl.innerHTML =
        kpHtml +
        '<div class="agent-tips-memory" id="agentTipsMemory">' +
        '<span class="agent-tips-memory__label">记忆小技巧</span>' +
        '<strong class="agent-tips-memory__title">' +
        escapeHtml(tip.title) +
        "</strong>" +
        '<p class="agent-tips-memory__text">' +
        escapeHtml(tip.text) +
        "</p></div>";
    }

    if (!animate) {
      applyHtml();
      return;
    }

    var memoryEl = document.getElementById("agentTipsMemory");
    if (memoryEl) {
      memoryEl.classList.add("agent-tips-memory--changing");
    }

    window.setTimeout(function () {
      applyHtml();
    }, 160);
  }

  function rotateMemoryTip() {
    currentTipPool = featuredSkill
      ? buildTipPoolForSkill(featuredSkill)
      : GENERIC_MEMORY_TIPS.slice();
    renderStudyTips(true);
  }

  async function refreshStudyTips() {
    if (isLoadingTips) return;
    isLoadingTips = true;

    tipsEl.innerHTML = '<p class="agent-tips-empty">正在整理学习建议…</p>';

    try {
      var api = window.EduTowerApi;
      var model = window.EduTowerSkillsModel;
      var projectId = getProjectId();
      var query = model
        ? model.buildTreeQuery({ projectId: projectId || undefined })
        : projectId
          ? "?projectId=" + encodeURIComponent(projectId)
          : "";

      var data =
        api && typeof api.get === "function"
          ? await api.get("/api/skills/tree" + query)
          : null;

      var items = data && Array.isArray(data.items) ? data.items : [];
      var flatSkills = model ? model.flattenTree(items, []) : flattenSkills(items, []);

      recommendedSkills = flatSkills
        .map(function (skill) {
          return { skill: skill, score: scoreSkill(skill) };
        })
        .filter(function (entry) {
          return entry.score >= 0;
        })
        .sort(function (left, right) {
          return right.score - left.score;
        })
        .slice(0, 2)
        .map(function (entry) {
          return entry.skill;
        });

      featuredSkill = recommendedSkills[0] || null;
      currentTipPool = featuredSkill
        ? buildTipPoolForSkill(featuredSkill)
        : GENERIC_MEMORY_TIPS.slice();
      currentTipIndex = -1;
      renderStudyTips(false);
    } catch (_err) {
      recommendedSkills = [];
      featuredSkill = null;
      currentTipPool = GENERIC_MEMORY_TIPS.slice();
      currentTipIndex = -1;
      renderStudyTips(false);
    } finally {
      isLoadingTips = false;
    }
  }

  function mapDailyTask(task) {
    return {
      id: task.id,
      title: task.title,
      rawStatus: task.status || "todo",
      timeRange: task.estimatedMinutes ? task.estimatedMinutes + " 分钟" : "",
      status:
        task.status === "done"
          ? "done"
          : task.status === "in_progress"
            ? "active"
            : "pending",
    };
  }

  function bindEvents() {
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.matches("[data-action='agent-refresh-tips']")) {
        rotateMemoryTip();
      }
    });

    checklistEl.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.matches("[data-action='agent-open-plan']")) {
        if (window.EduTowerShell && typeof window.EduTowerShell.switchView === "function") {
          window.EduTowerShell.switchView("plan");
        }
        return;
      }

      var btn = target.closest("[data-action='agent-cycle-task']");
      if (!btn) return;

      var taskId = btn.getAttribute("data-task-id") || "";
      var currentStatus = btn.getAttribute("data-current-status") || "todo";
      if (!taskId) return;

      cycleDailyTask(taskId, currentStatus);
    });
  }

  async function refreshChecklistFromDaily() {
    if (isLoadingChecklist) return;
    isLoadingChecklist = true;

    checklistEl.innerHTML =
      '<li class="checklist-empty">正在同步今日学习任务…</li>';

    try {
      if (window.EduTowerPlan && typeof window.EduTowerPlan.loadTodayTasks === "function") {
        var payload = await window.EduTowerPlan.loadTodayTasks();
        var tasks = payload && Array.isArray(payload.tasks) ? payload.tasks : [];
        dailyTasks = tasks.map(mapDailyTask);
        renderChecklist();
        return;
      }

      dailyTasks = [];
      renderChecklist();
    } catch (_err) {
      dailyTasks = [];
      checklistEl.innerHTML =
        '<li class="checklist-empty">暂时无法加载今日任务。</li>';
    } finally {
      isLoadingChecklist = false;
    }
  }

  async function cycleDailyTask(taskId, currentStatus) {
    if (!window.EduTowerPlan || typeof window.EduTowerPlan.updateDailyTaskStatus !== "function") {
      return;
    }

    var nextStatus =
      typeof window.EduTowerPlan.nextDailyTaskStatus === "function"
        ? window.EduTowerPlan.nextDailyTaskStatus(currentStatus)
        : currentStatus === "todo"
          ? "in_progress"
          : currentStatus === "in_progress"
            ? "done"
            : "todo";

    try {
      await window.EduTowerPlan.updateDailyTaskStatus(taskId, nextStatus);
      await refreshChecklistFromDaily();
      if (window.EduTowerHome && typeof window.EduTowerHome.refresh === "function") {
        window.EduTowerHome.refresh();
      }
    } catch (_err) {
      /* ignore */
    }
  }

  async function refreshFromBackend() {
    if (isLoadingPanel) return;
    isLoadingPanel = true;

    renderAgentLoading();

    try {
      var url = PANEL_API + "?session_id=" + encodeURIComponent(getSessionId());
      var conversationId = getConversationId();
      if (conversationId) {
        url += "&conversation_id=" + encodeURIComponent(conversationId);
      }
      if (window.EduTowerChat && typeof window.EduTowerChat.getAgentPanelHints === "function") {
        var hints = window.EduTowerChat.getAgentPanelHints();
        if (hints && hints.topic) {
          url += "&topic=" + encodeURIComponent(hints.topic);
        }
        if (hints && hints.lastMessage) {
          url += "&last_message=" + encodeURIComponent(hints.lastMessage);
        }
      }
      var response = await fetch(url);
      var result = await response.json();

      if (!response.ok || !result || result.ok !== true || !result.data) {
        throw new Error(extractErrorMessage(result, response));
      }

      backendData = result.data;
      renderAgentStatus();
    } catch (err) {
      console.error("[EduTower] /api/agent/panel 请求失败:", err);
      renderAgentError();
    } finally {
      isLoadingPanel = false;
    }
  }

  function extractErrorMessage(result, response) {
    if (result && result.error && typeof result.error.message === "string") {
      return result.error.message.trim();
    }
    return "请求失败（HTTP " + response.status + "）";
  }

  function renderAgentLoading() {
    statusEl.innerHTML =
      '<div class="panel-placeholder panel-placeholder--loading">' +
      '<span class="status-dot status-dot--active"></span>' +
      "<span>正在同步 Agent 执行状态…</span></div>";
  }

  function renderAgentError() {
    statusEl.innerHTML =
      '<div class="panel-placeholder panel-placeholder--error">暂时无法获取 Agent 状态，请确认后端已启动。</div>';
  }

  function renderAgentStatus() {
    if (!backendData || !backendData.agent) {
      renderAgentError();
      return;
    }

    var agent = backendData.agent;
    var stepsHtml = (agent.steps || [])
      .map(function (step) {
        var cls = "reasoning-step";
        if (step.status === "done") cls += " reasoning-step--done";
        if (step.status === "current") cls += " reasoning-step--current";
        return (
          '<li class="' +
          cls +
          '"><span class="step-index"></span><span class="step-text">' +
          escapeHtml(step.label) +
          "</span></li>"
        );
      })
      .join("");

    statusEl.innerHTML =
      '<div class="agent-status">' +
      '<span class="status-dot status-dot--active"></span>' +
      '<span class="status-label">' +
      escapeHtml(agent.activeLabel || "Agent 就绪") +
      "</span></div>" +
      '<ol class="reasoning-path">' +
      stepsHtml +
      "</ol>";
  }

  function renderChecklist() {
    if (!dailyTasks.length) {
      checklistEl.innerHTML =
        '<li class="checklist-empty">今日任务来自学习计划。<button type="button" class="btn-link" data-action="agent-open-plan">去启用今日学习</button></li>';
      return;
    }

    checklistEl.innerHTML = dailyTasks
      .map(function (item) {
        var cls = "checklist-item";
        if (item.status === "done") cls += " checklist-item--done";
        if (item.status === "active") cls += " checklist-item--active";

        var iconCls = "check-icon";
        var iconContent = "";
        if (item.status === "done") {
          iconContent = "✓";
        } else if (item.status === "active") {
          iconCls += " check-icon--ring";
        } else {
          iconCls += " check-icon--empty";
        }

        return (
          '<li class="' +
          cls +
          '"><button type="button" class="checklist-item__toggle" data-action="agent-cycle-task" data-task-id="' +
          escapeAttr(item.id) +
          '" data-current-status="' +
          escapeAttr(item.rawStatus || "todo") +
          '" aria-label="切换完成状态"><span class="' +
          iconCls +
          '" aria-hidden="true">' +
          iconContent +
          "</span></button><div class=\"checklist-body\"><span class=\"checklist-title\">" +
          escapeHtml(item.title) +
          '</span><span class="checklist-time">' +
          escapeHtml(item.timeRange || "今日任务") +
          "</span></div></li>"
        );
      })
      .join("");
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

  window.EduTowerAgentPanel = {
    refreshFromBackend: refreshFromBackend,
    refreshChecklist: refreshChecklistFromDaily,
    refreshStudyTips: refreshStudyTips,
    getChecklist: function () {
      return dailyTasks.slice();
    },
  };
})();
