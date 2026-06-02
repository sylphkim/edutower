# 开发流程

## Phase 1：后端基础

已完成：

- Express + TypeScript server。
- 环境变量配置。
- 统一成功/失败响应格式。
- 通用 OpenAI-compatible LLM service。
- `GET /api/health`。
- `POST /api/llm/chat`。
- `POST /api/llm/generate`。

## Phase 2：EduTower Scaffold

当前 scaffold 已完成：

- 面向产品的 route group。
- 基础 domain types。
- mock data。
- 占位 module service 和 controller。
- API 契约文档。
- 通过 `POST /api/ai/chat` 打通 Express 到 FastAPI AI Engine 的 bridge。
- demo chat context 类型、mock 数据和 `chatContextService`。
- `POST /api/ai/chat` 和 legacy `POST /chat` 都会向 AI Engine 转发 demo context。

## Phase 2.5：主链路对齐

当前架构决策：

- Express 是主后端，也是 product flow owner。
- FastAPI 是 AI Engine，负责 Agent 和模型执行。
- Frontend 应优先调用 Express endpoints。
- 当前 legacy `POST /chat` 只作为静态前端兼容 adapter 保留。
- Express 负责构建当前 demo learning context。
- FastAPI 接收 `message`、`session_id` 和 `context`。

当前 demo 主链路：

```text
Frontend
-> POST /api/ai/chat
-> Express 读取 message 和 session_id
-> chatContextService.buildContext({ sessionId })
-> aiEngineService.chat({ sessionId, message, context })
-> FastAPI POST /chat
-> LLM Provider
-> 返回 reply
```

## Phase 3：逐步替换 mock/stub

推荐顺序：

1. AI Engine：在学习助教 prompt 中消费 `context`。
2. Materials：实现真实资料上传、解析和 chunking。
3. Skills：从资料 chunks 中抽取 knowledge points。
4. Chat Context：把 demo mock 数据替换成 database、RAG 和 memory-backed data。
5. Plan：基于学习目标、时间预算和 knowledge gaps 生成学习计划。
6. Quiz：基于 knowledge points 生成题目，并支持提交结果。
7. Wrongbook：持久化错题和复习状态。
8. Memory：持久化 learner profile，并从学习事件中更新长期记忆。

## 开发约束

- 替换 mock/stub 时，应保持公开 route shape 稳定。
- 改接口前先更新 `docs/API_CONTRACT.md`。
- Express 主后端改动后必须运行 `npm run build`。
- 前端只对接 Express，不直接调用 FastAPI。
- FastAPI 不直接操作产品数据库。
- 提交信息默认使用中文，格式为 `<type>: <description>`。
