import { mockStudyPlan } from "../mock/plan";
import type { StubPayload, StudyPlan } from "../types/edutower";
import { createStubPayload } from "./stub.service";

export const planService = {
  generatePlan(): StubPayload<{ plan: StudyPlan }> {
    return createStubPayload("plan.generate", "Study plan generation is scaffolded only.", {
      plan: mockStudyPlan
    });
  }
};
