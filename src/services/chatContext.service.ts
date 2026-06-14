import { conversationsRepository } from "../repositories/conversations.repository";
import type { ConversationWithMessages } from "../repositories/conversations.repository";
import { knowledgeNodesRepository } from "../repositories/knowledgeNodes.repository";
import type { KnowledgeNodeWithPrerequisites } from "../repositories/knowledgeNodes.repository";
import { materialsRepository } from "../repositories/materials.repository";
import { projectsRepository } from "../repositories/projects.repository";
import { weakPointsRepository } from "../repositories/weakPoints.repository";
import { getDemoUserId } from "./demo.service";
import { memoryService } from "./memory.service";
import type { Material, MaterialSourceType, WeakPoint } from "../generated/prisma/client";
import type {
  ChatContext,
  ChatMemory,
  DemoKnowledgePoint,
  DemoMaterial,
  DemoSessionMessage,
  DemoSubject,
  DemoWeakPoint
} from "../types/chatContext";

// 单轮聊天最多带入的历史消息条数（取最近的），避免长对话把上下文撑爆。
const MAX_SESSION_HISTORY_MESSAGES = 40;

// 会话未关联项目（自由答疑）时的空项目上下文。
const EMPTY_SUBJECT: DemoSubject = {
  id: "",
  name: "",
  gradeLevel: "",
  learningGoal: ""
};

// Material.sourceType(含 image) → 上下文 type(无 image)。
// 沿用 demo 把图片当链接资源的约定。
const SOURCE_TYPE_TO_MATERIAL_TYPE: Record<MaterialSourceType, DemoMaterial["type"]> = {
  pdf: "pdf",
  doc: "doc",
  text: "text",
  link: "link",
  image: "link"
};

export interface BuildChatContextParams {
  sessionId: string;
  /** 前端显式子对话时传入；优先用它定位会话，否则按 sessionId(externalSessionId) 查。 */
  conversationId?: string;
  /** 显式指定项目（如智能体面板）；优先级高于会话所属项目。 */
  projectId?: string;
}

interface ProjectContext {
  subject: DemoSubject;
  materials: DemoMaterial[];
  knowledgePoints: DemoKnowledgePoint[];
  weakPoints: DemoWeakPoint[];
}

const EMPTY_PROJECT_CONTEXT: ProjectContext = {
  subject: EMPTY_SUBJECT,
  materials: [],
  knowledgePoints: [],
  weakPoints: []
};

// 把这次请求对应到一条已存在的会话：
// - 传了 conversationId → 取该子对话；
// - 否则按 externalSessionId === sessionId 查（free_qa 懒创建出来的会话）。
// 查不到（如某会话的第一条消息，此时会话还没落库）→ 返回 null，历史/项目按空处理。
async function resolveConversation(
  params: BuildChatContextParams,
  userId: string
): Promise<ConversationWithMessages | null> {
  if (params.conversationId) {
    return conversationsRepository.findByIdForUser(params.conversationId, userId);
  }

  return conversationsRepository.findByExternalSessionIdForUser(params.sessionId, userId);
}

// 会话消息（已按 createdAt 升序）→ 聊天上下文里的 sessionHistory。
// 只保留最近 N 条，仍按时间顺序排列。
function toSessionHistory(conversation: ConversationWithMessages | null): DemoSessionMessage[] {
  if (!conversation) {
    return [];
  }

  return conversation.messages.slice(-MAX_SESSION_HISTORY_MESSAGES).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString()
  }));
}

function toContextSubject(project: { id: string; subject: string; goal: string }): DemoSubject {
  return {
    id: project.id,
    name: project.subject,
    gradeLevel: "", // 库里不跟踪年级
    learningGoal: project.goal
  };
}

function toContextKnowledgePoints(
  projectId: string,
  nodes: KnowledgeNodeWithPrerequisites[]
): DemoKnowledgePoint[] {
  return nodes.map((node) => ({
    id: node.id,
    subjectId: projectId,
    title: node.title,
    description: node.description ?? "",
    mastery: node.mastery / 100, // 库 0-100 整数 → 上下文 0-1 小数
    prerequisiteIds: node.prerequisiteLinks.map((link) => link.prerequisiteId)
  }));
}

function toContextMaterials(projectId: string, materials: Material[]): DemoMaterial[] {
  return materials.map((material) => ({
    id: material.id,
    subjectId: projectId,
    title: material.title,
    type: material.sourceType ? SOURCE_TYPE_TO_MATERIAL_TYPE[material.sourceType] : "text",
    summary: material.summary ?? "",
    knowledgePointIds: [] // 库里无 材料↔知识点 直接关联
  }));
}

function toContextWeakPoints(weakPoints: WeakPoint[]): DemoWeakPoint[] {
  return weakPoints.map((weakPoint) => ({
    id: weakPoint.id,
    knowledgePointId: weakPoint.knowledgeNodeId,
    title: weakPoint.title,
    reason: weakPoint.description ?? "",
    severity: weakPoint.severity, // 枚举 low/medium/high 与上下文 union 一致
    suggestedAction: "" // 库里无该字段
  }));
}

// 会话挂了项目 → 接真实科目/知识点/薄弱点/资料；否则（自由答疑无项目）返回空。
async function buildProjectContext(
  projectId: string | null,
  userId: string
): Promise<ProjectContext> {
  if (!projectId) {
    return EMPTY_PROJECT_CONTEXT;
  }

  const project = await projectsRepository.findByIdForUser(projectId, userId);

  if (!project) {
    // 会话挂的项目已被删 / 不属于该用户 → 当作无项目处理。
    return EMPTY_PROJECT_CONTEXT;
  }

  const [nodes, weakPoints, materials] = await Promise.all([
    knowledgeNodesRepository.listTreeByProject(projectId, false),
    weakPointsRepository.listActiveByProject(projectId),
    materialsRepository.listByProjectForUser(projectId, userId)
  ]);

  return {
    subject: toContextSubject(project),
    knowledgePoints: toContextKnowledgePoints(projectId, nodes),
    weakPoints: toContextWeakPoints(weakPoints),
    materials: toContextMaterials(projectId, materials)
  };
}

// 长期记忆：按 importance 降序 -> createdAt 降序，取前 20 条。
async function loadTopMemories(): Promise<ChatMemory[]> {
  const { items: allMemories } = await memoryService.list();

  const importanceRank: Record<string, number> = { high: 3, medium: 2, low: 1 };

  return allMemories
    .sort((a, b) => {
      const rankDiff = (importanceRank[b.importance] ?? 0) - (importanceRank[a.importance] ?? 0);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 20)
    .map((m) => ({
      type: m.type,
      title: m.title,
      content: m.content
    }));
}

export const chatContextService = {
  async buildContext(params: BuildChatContextParams): Promise<ChatContext> {
    const userId = await getDemoUserId();

    // 定位本会话：取真实聊天记录 + 关联项目。
    const conversation = await resolveConversation(params, userId);
    const sessionHistory = toSessionHistory(conversation);

    // 项目上下文优先级：显式 projectId > 会话所属项目 > 无（自由答疑置空）。
    const projectId = params.projectId?.trim() || conversation?.projectId || null;
    const projectContext = await buildProjectContext(projectId, userId);

    const memories = await loadTopMemories();

    return {
      subject: projectContext.subject,
      materials: projectContext.materials,
      knowledgePoints: projectContext.knowledgePoints,
      weakPoints: projectContext.weakPoints,
      sessionHistory,
      generatedAt: new Date().toISOString(),
      memories
    };
  }
};
