const TOPIC_RULES: Array<{ label: string; keywords: string[] }> = [
  { label: "二次函数", keywords: ["二次函数", "抛物线", "顶点式", "对称轴", "开口方向"] },
  { label: "导数与积分", keywords: ["导数", "积分", "微分", "定积分", "不定积分", "切线斜率"] },
  {
    label: "线性代数",
    keywords: [
      "行列式",
      "矩阵",
      "向量",
      "特征值",
      "特征向量",
      "线性方程",
      "秩",
      "艾米特",
      "厄米",
      "埃尔米特",
      "hermitian",
      "对角化",
      "正交",
      "内积",
      "张量"
    ]
  },
  { label: "三角函数", keywords: ["三角函数", "正弦", "余弦", "正切", "弧度", "诱导公式"] },
  { label: "概率统计", keywords: ["概率", "统计", "期望", "方差", "分布", "抽样"] },
  { label: "立体几何", keywords: ["立体几何", "空间向量", "三视图", "体积", "表面积"] },
  { label: "数列", keywords: ["数列", "等差数列", "等比数列", "递推", "通项公式"] },
  { label: "英语", keywords: ["英语", "单词", "语法", "阅读理解", "作文", "完形填空"] },
  { label: "物理", keywords: ["力学", "电磁", "牛顿", "电路", "动量", "能量守恒"] },
  { label: "化学", keywords: ["化学", "反应方程式", "元素", "摩尔", "有机", "电离"] }
];

export function inferTopicFromMessage(text: string): string {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "综合复习";
  }

  const lower = normalized.toLowerCase();

  for (const rule of TOPIC_RULES) {
    const matched = rule.keywords.some((keyword) => lower.includes(keyword.toLowerCase()));

    if (matched) {
      return rule.label;
    }
  }

  return normalized.length > 18 ? `${normalized.slice(0, 18)}…` : normalized;
}

export function truncateFocusLabel(text: string, maxLength = 22): string {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "组织回答";
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}
