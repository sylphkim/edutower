import { mockKnowledgePoints } from "../mock/knowledgePoints";
import type { KnowledgePoint, StubPayload } from "../types/edutower";
import { createStubPayload } from "./stub.service";

export const skillsService = {
  getTree(): StubPayload<{ knowledgePoints: KnowledgePoint[] }> {
    return createStubPayload("skills.tree", "Skill tree generation is scaffolded only.", {
      knowledgePoints: mockKnowledgePoints
    });
  }
};
