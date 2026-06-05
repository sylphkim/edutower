import type { WrongbookTaxonomyEntry } from "../types/wrongbook";

export const BUILTIN_WRONGBOOK_SUBJECTS: WrongbookTaxonomyEntry[] = [
  {
    id: "uncategorized",
    label: "未分类",
    hint: "尚未归入具体学科或主题",
    builtIn: true
  },
  {
    id: "math-quadratic",
    label: "数学 · 二次函数",
    hint: "与 AI 复习的二次函数考点一致",
    builtIn: true
  },
  {
    id: "math-calculus",
    label: "数学 · 微积分",
    hint: "极限、导数、微分等",
    builtIn: true
  },
  {
    id: "math-general",
    label: "数学 · 综合",
    hint: "数学综合或暂未细分主题",
    builtIn: true
  },
  {
    id: "physics",
    label: "物理",
    hint: "力学、电磁、光学等",
    builtIn: true
  },
  {
    id: "chemistry",
    label: "化学",
    hint: "元素、反应、实验等",
    builtIn: true
  },
  {
    id: "english",
    label: "英语",
    hint: "词汇、语法、阅读等",
    builtIn: true
  },
  {
    id: "other",
    label: "其他",
    hint: "其他学科或暂未归类",
    builtIn: true
  }
];

export const BUILTIN_WRONGBOOK_CATEGORIES: WrongbookTaxonomyEntry[] = [
  { id: "uncategorized", label: "未分类", builtIn: true },
  { id: "concept", label: "概念不清", builtIn: true },
  { id: "calculation", label: "计算错误", builtIn: true },
  { id: "method", label: "方法不熟", builtIn: true },
  { id: "careless", label: "审题粗心", builtIn: true },
  { id: "memory", label: "记忆遗漏", builtIn: true }
];
