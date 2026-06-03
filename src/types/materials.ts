export type MaterialType = "slides" | "photo" | "outline" | "note" | "other";
export type MaterialSource = "uploaded" | "manual" | "mock";
export type MaterialStatus = "pending" | "processing" | "ready" | "failed";

export interface MaterialItem {
  id: string;
  title: string;
  type: MaterialType;
  source: MaterialSource;
  status: MaterialStatus;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

// 创建时不传 id、状态和时间，由 service 统一补齐。
export interface CreateMaterialInput {
  title: string;
  type: MaterialType;
  source?: MaterialSource;
  summary?: string;
}

// PATCH 只传需要修改的字段。
export interface UpdateMaterialInput {
  title?: string;
  type?: MaterialType;
  status?: MaterialStatus;
  summary?: string;
}
