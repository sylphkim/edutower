import type { DemoMaterial } from "../types/chatContext";

export const demoMaterials: DemoMaterial[] = [
  {
    id: "material-quadratic-slides",
    subjectId: "subject-hs-math-quadratic",
    title: "二次函数专题课件",
    type: "pdf",
    summary: "老师课件梳理了二次函数定义、图像开口方向、顶点式、对称轴和最值问题的核心方法。",
    knowledgePointIds: [
      "kp-quadratic-definition",
      "kp-graph-opening",
      "kp-vertex-form",
      "kp-axis-of-symmetry",
      "kp-maximum-minimum"
    ]
  },
  {
    id: "material-quadratic-board-photo",
    subjectId: "subject-hs-math-quadratic",
    title: "课堂板书照片：配方法与顶点式",
    type: "link",
    summary: "板书照片记录了从一般式配方得到顶点式的步骤，以及如何从图像读取顶点和对称轴。",
    knowledgePointIds: [
      "kp-vertex-form",
      "kp-axis-of-symmetry",
      "kp-read-parameters-from-graph"
    ]
  },
  {
    id: "material-quadratic-exam-outline",
    subjectId: "subject-hs-math-quadratic",
    title: "二次函数考点大纲",
    type: "text",
    summary: "考点大纲覆盖解析式选择、图像性质判断、最值求解和实际应用题中的定义域约束。",
    knowledgePointIds: [
      "kp-graph-opening",
      "kp-maximum-minimum",
      "kp-real-world-application"
    ]
  }
];
