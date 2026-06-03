# 模块划分

本项目使用 Express 作为面向产品和前端的主后端，使用 FastAPI 作为 AI Engine。Express 负责 API 契约、产品流程、模块路由和静态页面托管；FastAPI 负责 `/chat` 背后的 Agent 和模型执行。

## 现有基础模块

| 范围 | 文件 | 职责 |
| --- | --- | --- |
| 应用启动 | `src/server.ts`、`src/app.ts` | 启动 Express，并挂载 API 路由 |
| 环境配置 | `src/config/env.ts` | 读取 Express、AI Engine 和 LLM provider 配置 |
| AI Engine bridge | `src/services/aiEngine.service.ts`、`src/controllers/ai.controller.ts`、`src/routes/ai.routes.ts` | 将 Express 产品聊天接口转发到 FastAPI |
| LLM 调试 | `src/services/llm.service.ts`、`src/controllers/llm.controller.ts`、`src/routes/llm.routes.ts` | 提供底层 OpenAI-compatible provider 调试能力 |
| 工具层 | `src/utils/*` | 统一响应、错误处理和日志 |

## EduTower 产品模块

| 模块 | Route | Controller | Service | Mock |
| --- | --- | --- | --- | --- |
| AI facade | `src/routes/ai.routes.ts` | `src/controllers/ai.controller.ts` | `src/services/aiEngine.service.ts` | 无 |
| Chat Context | 无独立 route | `src/controllers/ai.controller.ts` | `src/services/chatContext.service.ts` | `src/mock/demoSubject.ts`、`src/mock/demoMaterials.ts`、`src/mock/demoKnowledgePoints.ts`、`src/mock/demoWeakPoints.ts`、`src/mock/demoSessionHistory.ts` |
| Materials | `src/routes/materials.routes.ts` | `src/controllers/materials.controller.ts` | `src/services/materials.service.ts` | `src/mock/materials.ts` |
| Plan | `src/routes/plan.routes.ts` | `src/controllers/plan.controller.ts` | `src/services/plan.service.ts` | `src/mock/plan.ts` |
| Skills | `src/routes/skills.routes.ts` | `src/controllers/skills.controller.ts` | `src/services/skills.service.ts` | `src/mock/knowledgePoints.ts` |
| Quiz | `src/routes/quiz.routes.ts` | `src/controllers/quiz.controller.ts` | `src/services/quiz.service.ts` | `src/mock/quiz.ts` |
| Wrongbook | `src/routes/wrongbook.routes.ts` | `src/controllers/wrongbook.controller.ts` | `src/services/wrongbook.service.ts` | `src/mock/wrongbook.ts` |
| Memory | `src/routes/memory.routes.ts` | `src/controllers/memory.controller.ts` | `src/services/memory.service.ts` | `src/mock/memory.ts` |

## 类型归属

共享产品类型放在 `src/types/edutower.ts`。

demo chat context 类型放在 `src/types/chatContext.ts`，包括 `DemoSubject`、`DemoMaterial`、`DemoKnowledgePoint`、`DemoWeakPoint`、`DemoSessionMessage` 和 `ChatContext`。

LLM provider 类型放在 `src/types/llm.ts`。

FastAPI engine 请求和响应的兼容逻辑集中在 `src/services/aiEngine.service.ts`。

## 设计原则

- `LLMService` 只保留通用 provider 调试能力，不承载产品业务 prompt。
- 产品流程应经过 Express controller/service，不要直接写在 route 文件里。
- Express 可以在调用 FastAPI 前组装产品侧上下文，例如 `ChatContext`。
- Agent、工具调用和模型编排应放在 FastAPI AI Engine，或未来专门的 bridge service 中。
- mock/stub 模块可以先稳定接口形状，再逐步替换内部实现。
