import type { DemoKnowledgePoint } from "../types/chatContext";

export const demoKnowledgePoints: DemoKnowledgePoint[] = [
  {
    id: "kp-quadratic-definition",
    subjectId: "subject-hs-math-quadratic",
    title: "二次函数定义",
    description: "理解形如 y = ax^2 + bx + c 且 a 不为 0 的函数，并能判断一个式子是否为二次函数。",
    mastery: 0.82,
    prerequisiteIds: []
  },
  {
    id: "kp-graph-opening",
    subjectId: "subject-hs-math-quadratic",
    title: "图像与开口方向",
    description: "根据 a 的正负判断抛物线开口方向，并理解 a 的大小对图像宽窄的影响。",
    mastery: 0.68,
    prerequisiteIds: ["kp-quadratic-definition"]
  },
  {
    id: "kp-vertex-form",
    subjectId: "subject-hs-math-quadratic",
    title: "顶点式",
    description: "掌握 y = a(x - h)^2 + k 的含义，能在一般式和顶点式之间进行转换。",
    mastery: 0.46,
    prerequisiteIds: ["kp-quadratic-definition"]
  },
  {
    id: "kp-axis-of-symmetry",
    subjectId: "subject-hs-math-quadratic",
    title: "对称轴",
    description: "能用 x = -b / 2a 或顶点式中的 x = h 求出抛物线对称轴。",
    mastery: 0.58,
    prerequisiteIds: ["kp-vertex-form"]
  },
  {
    id: "kp-maximum-minimum",
    subjectId: "subject-hs-math-quadratic",
    title: "最值问题",
    description: "根据开口方向、顶点坐标和题目定义域求二次函数的最大值或最小值。",
    mastery: 0.39,
    prerequisiteIds: ["kp-graph-opening", "kp-vertex-form"]
  },
  {
    id: "kp-read-parameters-from-graph",
    subjectId: "subject-hs-math-quadratic",
    title: "从图像读参数",
    description: "根据图像的开口、顶点、对称轴和与坐标轴交点推断函数参数。",
    mastery: 0.34,
    prerequisiteIds: ["kp-graph-opening", "kp-axis-of-symmetry"]
  },
  {
    id: "kp-real-world-application",
    subjectId: "subject-hs-math-quadratic",
    title: "实际应用题",
    description: "把利润、面积、抛物运动等实际问题建模成二次函数，并结合定义域作答。",
    mastery: 0.31,
    prerequisiteIds: ["kp-maximum-minimum"]
  }
];
