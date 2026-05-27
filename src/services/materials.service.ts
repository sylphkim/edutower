import { mockMaterialChunks, mockMaterials } from "../mock/materials";
import type { Material, MaterialChunk, StubPayload } from "../types/edutower";
import { createStubPayload } from "./stub.service";

export const materialsService = {
  createUploadPlaceholder(): StubPayload<{ material: Material }> {
    return createStubPayload("materials.upload", "Material upload is scaffolded only.", {
      material: mockMaterials[0]
    });
  },

  listChunks(): StubPayload<{ chunks: MaterialChunk[] }> {
    return createStubPayload("materials.chunks", "Material chunk retrieval is scaffolded only.", {
      chunks: mockMaterialChunks
    });
  }
};
