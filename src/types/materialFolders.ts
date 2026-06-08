export interface MaterialFolderItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialFolderInput {
  name: string;
}

export interface UpdateMaterialFolderInput {
  name?: string;
}
