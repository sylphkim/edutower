import type { DemoWeakPoint } from "../types/chatContext";

export const demoWeakPoints: DemoWeakPoint[] = [
  {
    id: "weak-vertex-form-conversion",
    knowledgePointId: "kp-vertex-form",
    title: "顶点式转换不熟",
    reason: "学生能看懂顶点式含义，但从一般式配方时容易漏掉系数 a 或常数项调整。",
    severity: "high",
    suggestedAction: "先练习带步骤的配方法，再用 3 道一般式转顶点式题目做即时巩固。"
  },
  {
    id: "weak-read-graph-parameters",
    knowledgePointId: "kp-read-parameters-from-graph",
    title: "不会从图像读参数",
    reason: "学生常只关注开口方向，忽略顶点、对称轴和交点对参数范围的提示。",
    severity: "medium",
    suggestedAction: "用图像标注题训练先读顶点和对称轴，再判断 a、b、c 的符号。"
  },
  {
    id: "weak-application-domain",
    knowledgePointId: "kp-real-world-application",
    title: "最值应用题容易漏定义域",
    reason: "学生会套顶点求最值，但在利润、面积等应用题中经常忘记变量的实际取值范围。",
    severity: "high",
    suggestedAction: "每道应用题先写变量含义和定义域，再判断顶点是否落在可取范围内。"
  }
];
