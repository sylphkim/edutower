/**
 * EduTower — 知识图谱数据（前端静态）
 */
(function () {
  "use strict";

  var SUBJECT_LABELS = {
    "subject-hs-math-quadratic": "高中数学 · 二次函数",
    "subject-math-calculus": "数学 · 微积分",
    "subject-physics": "物理 · 力学",
  };

  var QUADRATIC_POINTS = [
    {
      id: "kp-quadratic-definition",
      subjectId: "subject-hs-math-quadratic",
      title: "二次函数定义",
      description:
        "理解形如 y = ax^2 + bx + c 且 a 不为 0 的函数，并能判断一个式子是否为二次函数。",
      mastery: 0.82,
      prerequisiteIds: [],
    },
    {
      id: "kp-graph-opening",
      subjectId: "subject-hs-math-quadratic",
      title: "图像与开口方向",
      description: "根据 a 的正负判断抛物线开口方向，并理解 a 的大小对图像宽窄的影响。",
      mastery: 0.68,
      prerequisiteIds: ["kp-quadratic-definition"],
    },
    {
      id: "kp-vertex-form",
      subjectId: "subject-hs-math-quadratic",
      title: "顶点式",
      description: "掌握 y = a(x - h)^2 + k 的含义，能在一般式和顶点式之间进行转换。",
      mastery: 0.46,
      prerequisiteIds: ["kp-quadratic-definition"],
    },
    {
      id: "kp-axis-of-symmetry",
      subjectId: "subject-hs-math-quadratic",
      title: "对称轴",
      description: "能用 x = -b / 2a 或顶点式中的 x = h 求出抛物线对称轴。",
      mastery: 0.58,
      prerequisiteIds: ["kp-vertex-form"],
    },
    {
      id: "kp-maximum-minimum",
      subjectId: "subject-hs-math-quadratic",
      title: "最值问题",
      description: "根据开口方向、顶点坐标和题目定义域求二次函数的最大值或最小值。",
      mastery: 0.39,
      prerequisiteIds: ["kp-graph-opening", "kp-vertex-form"],
    },
    {
      id: "kp-read-parameters-from-graph",
      subjectId: "subject-hs-math-quadratic",
      title: "从图像读参数",
      description: "根据图像的开口、顶点、对称轴和与坐标轴交点推断函数参数。",
      mastery: 0.34,
      prerequisiteIds: ["kp-graph-opening", "kp-axis-of-symmetry"],
    },
    {
      id: "kp-real-world-application",
      subjectId: "subject-hs-math-quadratic",
      title: "实际应用题",
      description: "把利润、面积、抛物运动等实际问题建模成二次函数，并结合定义域作答。",
      mastery: 0.31,
      prerequisiteIds: ["kp-maximum-minimum"],
    },
  ];

  var CALCULUS_POINTS = [
    {
      id: "kp-limit-concept",
      subjectId: "subject-math-calculus",
      title: "极限概念",
      description: "理解函数在某点附近的变化趋势，并能判断简单极限是否存在。",
      mastery: 0.61,
      prerequisiteIds: [],
    },
    {
      id: "kp-derivative-definition",
      subjectId: "subject-math-calculus",
      title: "导数定义",
      description: "掌握导数作为瞬时变化率的含义，并能写出基本求导公式。",
      mastery: 0.52,
      prerequisiteIds: ["kp-limit-concept"],
    },
    {
      id: "kp-derivative-geometry",
      subjectId: "subject-math-calculus",
      title: "导数几何意义",
      description: "理解导数与切线斜率的关系，能求切线方程。",
      mastery: 0.47,
      prerequisiteIds: ["kp-derivative-definition"],
    },
    {
      id: "kp-chain-rule",
      subjectId: "subject-math-calculus",
      title: "链式法则",
      description: "对复合函数求导，能识别内外层函数并正确应用链式法则。",
      mastery: 0.33,
      prerequisiteIds: ["kp-derivative-definition"],
    },
    {
      id: "kp-derivative-application",
      subjectId: "subject-math-calculus",
      title: "导数应用",
      description: "利用导数判断单调性、极值与最值，解决优化类问题。",
      mastery: 0.29,
      prerequisiteIds: ["kp-derivative-geometry", "kp-chain-rule"],
    },
  ];

  var PHYSICS_POINTS = [
    {
      id: "kp-newton-laws",
      subjectId: "subject-physics",
      title: "牛顿运动定律",
      description: "理解牛顿三定律的内容，能在直线运动中列写动力学方程。",
      mastery: 0.74,
      prerequisiteIds: [],
    },
    {
      id: "kp-force-analysis",
      subjectId: "subject-physics",
      title: "受力分析",
      description: "会画受力图，能把重力、弹力、摩擦力分解到合适方向。",
      mastery: 0.56,
      prerequisiteIds: ["kp-newton-laws"],
    },
    {
      id: "kp-incline-plane",
      subjectId: "subject-physics",
      title: "斜面运动",
      description: "在斜面情境下分解重力，沿斜面列写牛顿第二定律。",
      mastery: 0.41,
      prerequisiteIds: ["kp-force-analysis"],
    },
    {
      id: "kp-kinematics-graph",
      subjectId: "subject-physics",
      title: "运动图像",
      description: "从 v-t、s-t 图像读取加速度、位移等运动信息。",
      mastery: 0.48,
      prerequisiteIds: ["kp-newton-laws"],
    },
    {
      id: "kp-instant-velocity",
      subjectId: "subject-physics",
      title: "瞬时速度",
      description: "理解瞬时速度与平均速度的区别，联系导数与运动学。",
      mastery: 0.37,
      prerequisiteIds: ["kp-kinematics-graph", "kp-derivative-definition"],
    },
  ];

  var ALL_KNOWLEDGE_POINTS = QUADRATIC_POINTS.concat(CALCULUS_POINTS, PHYSICS_POINTS);

  function masteryColor(mastery) {
    var value = Number(mastery);
    if (Number.isNaN(value)) return "#8a9bab";
    if (value >= 0.7) return "#4d7c5f";
    if (value >= 0.5) return "#9a7b4f";
    return "#b85c4a";
  }

  function masteryLabel(mastery) {
    var pct = Math.round((Number(mastery) || 0) * 100);
    if (pct >= 70) return "掌握良好";
    if (pct >= 50) return "需要巩固";
    return "薄弱重点";
  }

  function buildKnowledgeGraph(points, meta) {
    meta = meta || {};
    var sourcePoints = Array.isArray(points) ? points : ALL_KNOWLEDGE_POINTS;
    var degreeMap = {};
    var subjectLabelMap = meta.subjectLabels || SUBJECT_LABELS;

    sourcePoints.forEach(function (point) {
      degreeMap[point.id] = 0;
    });

    var links = [];
    sourcePoints.forEach(function (point) {
      (point.prerequisiteIds || []).forEach(function (prerequisiteId) {
        if (!degreeMap.hasOwnProperty(prerequisiteId)) return;
        links.push({
          id: prerequisiteId + "__" + point.id,
          source: prerequisiteId,
          target: point.id,
          type: "prerequisite",
        });
        degreeMap[prerequisiteId] += 1;
        degreeMap[point.id] += 1;
      });
    });

    var nodes = sourcePoints.map(function (point) {
      var degree = degreeMap[point.id] || 0;
      return {
        id: point.id,
        label: point.title,
        description: point.description,
        mastery: point.mastery,
        masteryPct: Math.round((Number(point.mastery) || 0) * 100),
        masteryLabel: masteryLabel(point.mastery),
        color: masteryColor(point.mastery),
        weight: Math.max(1, degree + 1),
        degree: degree,
        group: point.subjectId || "general",
        subjectLabel: subjectLabelMap[point.subjectId] || "综合",
      };
    });

    var subjectEntries = meta.subjects;
    if (!subjectEntries) {
      subjectEntries = Object.keys(subjectLabelMap).map(function (id) {
        return { id: id, label: subjectLabelMap[id] };
      });
    }

    return {
      title: meta.title || "知识全景",
      subtitle: meta.subtitle || "全部考点先修关系与掌握度",
      nodes: nodes,
      links: links,
      subjects: subjectEntries,
    };
  }

  function normalizeMastery(value) {
    var num = Number(value);
    if (Number.isNaN(num)) return 0;
    if (num > 1) return Math.min(1, num / 100);
    return Math.min(1, Math.max(0, num));
  }

  function buildGraphFromSkillTree(treeItems, meta) {
    meta = meta || {};
    var subjectLabels = {};
    var points = [];

    function walk(node, rootId, rootLabel) {
      if (!node || !node.id) return;

      var groupId = rootId || node.id;
      var groupLabel = rootLabel || node.title || "技能";
      if (!subjectLabels[groupId]) {
        subjectLabels[groupId] = groupLabel;
      }

      points.push({
        id: node.id,
        subjectId: groupId,
        title: node.title || node.id,
        description: node.description || "",
        mastery: normalizeMastery(node.mastery),
        prerequisiteIds: Array.isArray(node.prerequisites) ? node.prerequisites.slice() : [],
      });

      (node.children || []).forEach(function (child) {
        walk(child, groupId, groupLabel);
      });
    }

    (Array.isArray(treeItems) ? treeItems : []).forEach(function (root) {
      walk(root, root.id, root.title);
    });

    if (!points.length) {
      return buildKnowledgeGraph(ALL_KNOWLEDGE_POINTS, meta);
    }

    return buildKnowledgeGraph(points, {
      title: meta.title || "技能知识图谱",
      subtitle:
        meta.subtitle ||
        "来自技能树的先修关系与掌握度 · 共 " + points.length + " 个节点",
      subjectLabels: subjectLabels,
      subjects: Object.keys(subjectLabels).map(function (id) {
        return { id: id, label: subjectLabels[id] };
      }),
    });
  }

  window.EduTowerGraphData = {
    getAllKnowledgePoints: function () {
      return ALL_KNOWLEDGE_POINTS.slice();
    },
    getDemoKnowledgePoints: function () {
      return QUADRATIC_POINTS.slice();
    },
    buildKnowledgeGraph: buildKnowledgeGraph,
    buildGraphFromSkillTree: buildGraphFromSkillTree,
    buildDemoGraph: function () {
      return buildKnowledgeGraph(QUADRATIC_POINTS, {
        title: "高中数学 · 二次函数",
        subtitle: "考点先修关系与掌握度可视化",
      });
    },
    buildFullGraph: function () {
      return buildKnowledgeGraph(ALL_KNOWLEDGE_POINTS, {
        title: "知识全景",
        subtitle: "全部学科考点关联 · 共 " + ALL_KNOWLEDGE_POINTS.length + " 个知识点",
      });
    },
  };
})();
