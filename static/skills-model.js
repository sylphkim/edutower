/**
 * EduTower — 技能树模型（前后端字段对齐的共享工具）
 */
(function () {
  "use strict";

  var LEARNING_STATE_LABEL = {
    not_started: "未开始",
    learning: "学习中",
    mastered: "已掌握",
  };

  function flattenTree(nodes, list) {
    var target = list || [];
    (nodes || []).forEach(function (node) {
      target.push(node);
      if (node.children && node.children.length) {
        flattenTree(node.children, target);
      }
    });
    return target;
  }

  function findSkill(flatSkills, id) {
    if (!id || !flatSkills) return null;
    for (var i = 0; i < flatSkills.length; i++) {
      if (flatSkills[i].id === id) return flatSkills[i];
    }
    return null;
  }

  function findSkillTitle(flatSkills, id) {
    var skill = findSkill(flatSkills, id);
    return skill ? skill.title : id;
  }

  function getNodeCssKey(node) {
    if (!node || node.isUnlocked === false) return "locked";
    if (node.archivedAt) return "archived";
    if (node.learningState === "mastered") return "mastered";
    if (node.learningState === "learning") return "in_progress";
    return "available";
  }

  function getNodeBadgeLabel(node) {
    if (!node || node.isUnlocked === false) return "未解锁";
    if (node.archivedAt) return "已归档";
    return LEARNING_STATE_LABEL[node.learningState] || node.learningState || "未开始";
  }

  function formatSkillOptionLabel(skill) {
    if (!skill) return "";
    var suffix = getNodeBadgeLabel(skill);
    if (skill.isUnlocked === false) {
      return skill.title + "（未解锁）";
    }
    if (skill.prerequisiteRisk) {
      return skill.title + "（" + suffix + " · 前置风险）";
    }
    if (skill.learningState && skill.learningState !== "not_started") {
      return skill.title + "（" + suffix + "）";
    }
    return skill.title;
  }

  function buildPrerequisiteIdsFromEdges(nodeId, dependencyEdges) {
    return (dependencyEdges || [])
      .filter(function (edge) {
        return edge && edge.targetId === nodeId;
      })
      .map(function (edge) {
        return edge.sourceId;
      })
      .sort();
  }

  function normalizeTreeResponse(data) {
    var items = data && Array.isArray(data.items) ? data.items : [];
    var dependencyEdges =
      data && Array.isArray(data.dependencyEdges) ? data.dependencyEdges : [];
    var themeEdges = data && Array.isArray(data.themeEdges) ? data.themeEdges : [];
    return {
      items: items,
      dependencyEdges: dependencyEdges,
      themeEdges: themeEdges,
      flatSkills: flattenTree(items, []),
    };
  }

  function buildTreeQuery(options) {
    options = options || {};
    var params = [];
    if (options.projectId) {
      params.push("projectId=" + encodeURIComponent(options.projectId));
    }
    if (options.includeArchived) {
      params.push("includeArchived=true");
    }
    return params.length ? "?" + params.join("&") : "";
  }

  window.EduTowerSkillsModel = {
    LEARNING_STATE_LABEL: LEARNING_STATE_LABEL,
    flattenTree: flattenTree,
    findSkill: findSkill,
    findSkillTitle: findSkillTitle,
    getNodeCssKey: getNodeCssKey,
    getNodeBadgeLabel: getNodeBadgeLabel,
    formatSkillOptionLabel: formatSkillOptionLabel,
    buildPrerequisiteIdsFromEdges: buildPrerequisiteIdsFromEdges,
    normalizeTreeResponse: normalizeTreeResponse,
    buildTreeQuery: buildTreeQuery,
  };
})();
