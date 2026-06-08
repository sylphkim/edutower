export type MaterialType = "slides" | "photo" | "outline" | "note" | "other";
export type MaterialOrigin = "uploaded" | "manual" | "mock";
export type MaterialSource = MaterialOrigin;
export type MaterialSourceType = "pdf" | "doc" | "image" | "text" | "link";
export type MaterialStatus = "pending" | "processing" | "ready" | "failed";

export interface MaterialItem {
  id: string;
  title: string;
  type: MaterialType;
  source: MaterialSource;
  status: MaterialStatus;
  folderId: string | null;
  sourceType: MaterialSourceType | null;
  originalFileName: string | null;
  storedFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  storagePath: string | null;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialListQuery {
  folderId?: string | null;
}

export interface CreateMaterialInput {
  title: string;
  type: MaterialType;
  source?: MaterialSource;
  folderId?: string | null;
  summary?: string;
}

export interface CreateUploadedMaterialInput {
  folderId?: string | null;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
}

export interface UpdateMaterialInput {
  title?: string;
  type?: MaterialType;
  status?: MaterialStatus;
  folderId?: string | null;
  summary?: string;
}
