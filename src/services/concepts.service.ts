import { conceptsRepository } from "../repositories/concepts.repository";
import { getDemoUserId } from "./demoUser.service";

/** 全局技能图谱的一项：概念 + 掌握度（无掌握记录时 state/mastery 为 null = 未点亮）。 */
export interface ConceptListItem {
  id: string;
  name: string;
  subject: string | null;
  state: "mastered" | "learning" | null;
  mastery: number | null;
  sources: string[];
}

export const conceptsService = {
  /** 当前用户的全局概念列表（不进项目也能看），按学科、名称排序。 */
  async listGlobal(): Promise<{ concepts: ConceptListItem[] }> {
    const userId = await getDemoUserId();
    const records = await conceptsRepository.listConceptsWithMastery(userId);

    const concepts: ConceptListItem[] = records.map((record) => ({
      id: record.id,
      name: record.name,
      subject: record.subject,
      state: record.masteryRecord ? record.masteryRecord.state : null,
      mastery: record.masteryRecord ? record.masteryRecord.mastery : null,
      sources: record.masteryRecord ? record.masteryRecord.sources : []
    }));

    return { concepts };
  }
};
