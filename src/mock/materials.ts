import type { Material, MaterialChunk } from "../types/edutower";

export const mockMaterials: Material[] = [
  {
    id: "mat-001",
    title: "Calculus Starter Notes",
    sourceType: "pdf",
    status: "indexed",
    uploadedAt: "2026-05-27T00:00:00.000Z"
  }
];

export const mockMaterialChunks: MaterialChunk[] = [
  {
    id: "chunk-001",
    materialId: "mat-001",
    order: 1,
    text: "A derivative describes the instantaneous rate of change of a function.",
    knowledgePointIds: ["kp-derivative"]
  },
  {
    id: "chunk-002",
    materialId: "mat-001",
    order: 2,
    text: "The chain rule helps differentiate composite functions.",
    knowledgePointIds: ["kp-chain-rule"]
  }
];
