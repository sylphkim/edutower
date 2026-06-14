/**
 * EduTower — Agent 实时状态跟踪（内存）
 * 用于在 AI 聊天过程中向后端其他模块实时报告 Agent 当前执行阶段。
 * 状态按 sessionId 隔离，超时后自动过期。
 */

export type AgentPhase =
  | "idle"       // 空闲
  | "thinking"   // 推理中
  | "searching"  // 检索资料
  | "generating" // 生成回答
  | "done"       // 已完成
  | "error";     // 出错

export interface SessionAgentPhase {
  phase: AgentPhase;
  activeLabel: string;
  updatedAt: number;
}

const DEFAULT_PHASE: SessionAgentPhase = {
  phase: "idle",
  activeLabel: "Agent 就绪",
  updatedAt: Date.now()
};

/** sessionId → 当前状态 */
const store = new Map<string, SessionAgentPhase>();

/** 超过此毫秒数的状态视为过期，当作 idle 处理 */
const EXPIRY_MS = 120_000;

function isExpired(entry: SessionAgentPhase): boolean {
  return Date.now() - entry.updatedAt > EXPIRY_MS;
}

export const agentStatusService = {
  /**
   * 更新某个会话的 Agent 执行阶段。
   */
  setPhase(sessionId: string, phase: AgentPhase, activeLabel: string): void {
    store.set(sessionId, {
      phase,
      activeLabel,
      updatedAt: Date.now()
    });
  },

  /**
   * 读取某个会话的 Agent 执行阶段。
   * 如果从未设置或已过期则返回 idle。
   */
  getPhase(sessionId: string): SessionAgentPhase {
    const entry = store.get(sessionId);
    if (!entry || isExpired(entry)) {
      return DEFAULT_PHASE;
    }
    return entry;
  },

  /**
   * 手动清理过期状态。
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, val] of store) {
      if (now - val.updatedAt > EXPIRY_MS) {
        store.delete(key);
      }
    }
  }
};
