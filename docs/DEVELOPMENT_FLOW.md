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

## Phase 2：AI 主链路

已完成：

- 通过 `POST /api/ai/chat` 打通 Express 到 FastAPI AI Engine 的 bridge。
- legacy `POST /chat` 保留为静态前端兼容 adapter。
- demo chat context 类型、mock 数据和 `chatContextService`。
- `POST /api/ai/chat` 和 legacy `POST /chat` 都会向 AI Engine 转发 demo context。

当前主链路：

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

## Phase 3：产品模块分层

已完成：

- `wrongbook / materials / quiz / skills / plan / memory` 已整理为 routes/controller/service/types 分层。
- 产品模块 routes 已提供稳定 CRUD 路径。
- controller 只负责取参数、调用 service、返回统一响应。
- service 暂时使用内存数组，负责基础校验、CRUD 和明确错误。
- mock 数据只作为内存数组初始数据。

当前产品模块共同边界：

- 不接数据库。
- 不接登录鉴权。
- 不直接调用 AI Engine。
- 不大改 `app.ts`。
- 生成类能力先使用简单 mock 逻辑，不调用真实 LLM。

## Phase 4：逐步接真实能力

推荐顺序：

1. AI Engine：在学习助教 prompt 中消费 `context`。
2. Materials：实现真实资料上传、解析、OCR/chunking 和 RAG 数据入口。
3. Skills：从资料 chunks 中抽取或维护 knowledge points，并替换内存数组。
4. Chat Context：把 demo mock 数据替换成 database、RAG 和 memory-backed data。
5. Plan：基于学习目标、时间预算和 knowledge gaps 调用 AI 生成学习计划。
6. Quiz：基于 materials/skills 调用 AI 生成题目，并增强提交判分。
7. Wrongbook：从 quiz submit 结果自动沉淀错题和复习状态。
8. Memory：从学习事件、错题、计划和每日总结中更新长期记忆。

## 开发约束

- 改接口前先更新 `docs/API_CONTRACT.md`。
- Express 主后端改动后必须运行 `npm run build`。
- 前端只对接 Express，不直接调用 FastAPI。
- FastAPI 不直接操作产品数据库。
- 产品模块新增能力时优先保持 route shape 稳定。
- 提交信息格式为 `<type>: <中文说明>`。
