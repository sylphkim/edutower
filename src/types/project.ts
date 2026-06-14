// 项目「设置」入口的输入/输出类型。难度由 targetScore（如 "及格"/"冲高分"）承担，
// 项目级没有独立 difficulty 字段；测验难度在出题时单独选（pass/high_score）。

export interface ProjectSetupInput {
  title?: string;
  subject?: string;
  goal?: string;
  targetScore?: string | null;
  deadline?: string | null; // ISO 日期字符串
  startDate?: string | null; // ISO 日期字符串
  dailyMinutes?: number | null;
  /** true=盖上 goalConfirmedAt（目标确认）；false=撤销确认。 */
  goalConfirmed?: boolean;
}

export interface ProjectDetail {
  id: string;
  title: string;
  subject: string;
  goal: string;
  targetScore: string | null;
  startDate: string | null;
  deadline: string | null;
  dailyMinutes: number | null;
  status: string;
  goalConfirmedAt: string | null;
  planConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
