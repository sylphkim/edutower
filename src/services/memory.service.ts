import { mockMemoryProfile } from "../mock/memory";
import type { MemoryProfile, StubPayload } from "../types/edutower";
import { createStubPayload } from "./stub.service";

export const memoryService = {
  getProfile(): StubPayload<{ profile: MemoryProfile }> {
    return createStubPayload("memory.profile", "Memory profile retrieval is scaffolded only.", {
      profile: mockMemoryProfile
    });
  },

  updateProfile(): StubPayload<{ profile: MemoryProfile }> {
    return createStubPayload("memory.update", "Memory update is scaffolded only.", {
      profile: mockMemoryProfile
    });
  }
};
