# EduTower 开发说明

EduTower 是一个 AI 学习助手项目。当前阶段先稳定 Express 主后端的产品 API 和 AI Engine 桥接，让前端可以基于清晰的接口形状继续集成。

```text
静态前端页面 -> Express 主后端 -> FastAPI AI Engine -> LLM Provider -> 返回 AI 回复
```

Express 是面向前端的主后端，负责产品 API、统一响应、产品数据组织和 AI Engine bridge。FastAPI 作为 AI Engine，负责 Agent、prompt 和模型调用。

## 当前状态

已完成：

- Express + TypeScript 主后端骨架。
- 统一成功/失败响应格式。
- `GET /api/health` 健康检查。
- `POST /api/ai/chat` 产品聊天入口，由 Express 转发到 FastAPI AI Engine。
- `POST /chat` 兼容旧静态前端，内部同样会走 AI Engine。
- `POST /api/llm/chat`、`POST /api/llm/generate` 底层 LLM Provider 调试接口。
- `wrongbook / materials / quiz / skills / plan / memory` 已整理为 routes/controller/service/types 分层。
- 产品模块当前使用内存数组保存数据，提供稳定 CRUD 接口。
- demo chat context 类型、mock 数据和组装服务。
- `/api/ai/chat` 和 `/chat` 调用 AI Engine 时会附带 demo chat context。

当前仍未接入：

- 数据库。
- 登录鉴权。
- 真实文件上传、OCR、RAG、向量数据库。
- 真实 LLM 生成学习计划、测验题目或每日总结。
- 产品模块数据持久化。

## 架构边界

```text
Frontend / static
  只调用 Express API

Express Backend / src
  产品 API、业务流程、统一响应、内存数据、chat context、AI Engine bridge

FastAPI AI Engine / AI-Agent
  Agent、prompt、工具调用、LLM provider、模型错误处理

LLM Provider
  DeepSeek / OpenAI / OpenRouter / 硅基流动等 OpenAI-compatible 服务
```

核心规则：

- 前端不要直接调用 FastAPI。
- Express 是唯一面向前端的后端入口。
- FastAPI 只作为 AI Engine，不直接操作产品数据。
- Express 负责组装产品侧上下文，例如 `ChatContext`。
- `LLMService` 只保留底层 Provider 调试能力，不放业务 prompt 和业务 JSON schema。

## 技术栈

| 层 | 技术栈 | 当前目录 |
| --- | --- | --- |
| 前端演示页 | HTML / CSS / JavaScript | `static/` |
| 主后端 | Node.js + TypeScript + Express | `src/` |
| AI Engine | Python + FastAPI | `AI-Agent/` |
| LLM Provider | OpenAI-compatible API | 由 AI Engine 负责接入 |
| 文档 | Markdown | `docs/` |

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制示例文件：

```bash
cp .env.example .env
```

Windows PowerShell 可手动复制：

```powershell
Copy-Item .env.example .env
```

核心配置：

```env
PORT=3000

AI_ENGINE_BASE_URL=http://127.0.0.1:8000
AI_ENGINE_TIMEOUT_MS=30000

LLM_PROVIDER=deepseek
LLM_API_KEY=your_api_key_here
LLM_MODEL=deepseek-v4-pro
LLM_BASE_URL=https://api.deepseek.com
LLM_TIMEOUT_MS=30000
LLM_MAX_OUTPUT_TOKENS=1000
```

说明：

- `AI_ENGINE_BASE_URL` 是 Express 调用 FastAPI 的地址。
- `AI_ENGINE_TIMEOUT_MS` 是 Express 等待 AI Engine 的超时时间。
- `LLM_*` 当前主要用于底层 LLM 调试接口。
- 不要提交 `.env`。

### 3. 启动 Express

```bash
npm run dev
```

Windows PowerShell 如遇执行策略问题：

```bash
npm.cmd run dev
```

默认地址：

```text
http://localhost:3000
```

### 4. 启动 AI Engine

当前 AI Engine 位于：

```text
AI-Agent/
```

当前入口：

```bash
cd AI-Agent
python main.py
```

默认地址：

```text
http://127.0.0.1:8000
```

## 主要接口

详细契约见 [docs/API_CONTRACT.md](docs/API_CONTRACT.md)。

| 模块 | 接口概览 |
| --- | --- |
| Health | `GET /api/health` |
| AI Chat | `POST /api/ai/chat`、`POST /chat` |
| LLM Debug | `POST /api/llm/chat`、`POST /api/llm/generate` |
| Materials | `GET/POST /api/materials`、`GET/PATCH/DELETE /api/materials/:id` |
| Plan | `GET/POST /api/plan`、`GET/PATCH/DELETE /api/plan/:id` |
| Skills | `GET/POST /api/skills`、`GET /api/skills/tree`、`GET/PATCH/DELETE /api/skills/:id` |
| Quiz | `GET/POST /api/quiz`、`GET/DELETE /api/quiz/:id`、`POST /api/quiz/:id/submit` |
| Wrongbook | `GET/POST /api/wrongbook`、`GET/PATCH/DELETE /api/wrongbook/:id` |
| Memory | `GET/POST /api/memory`、`GET/PATCH/DELETE /api/memory/:id`、`POST /api/memory/daily-summary` |

## Chat Context Demo

当前 chat context 仍是 demo/mock，不接数据库。所有 `sessionId` 会返回同一份二次函数学习上下文。

相关文件：

```text
src/types/chatContext.ts
src/mock/demoSubject.ts
src/mock/demoMaterials.ts
src/mock/demoKnowledgePoints.ts
src/mock/demoWeakPoints.ts
src/mock/demoSessionHistory.ts
src/services/chatContext.service.ts
```

组装入口：

```ts
chatContextService.buildContext({ sessionId })
```

说明：

- 现在 demo 阶段暂时忽略真实用户系统。
- 代码保留了 `sessionId` 参数。
- 后续可以根据 `sessionId` 查询数据库里的用户资料、历史记录和长期记忆。

## 当前目录说明

```text
src/
  app.ts
  server.ts
  config/
  routes/
  controllers/
  services/
  mock/
  types/
  utils/

AI-Agent/
  main.py
  Module/

static/
  index.html
  app.js
  style.css

docs/
  API_CONTRACT.md
  MODULE_SPLIT.md
  DEVELOPMENT_FLOW.md
```

## 开发规则

- 改接口前先更新 `docs/API_CONTRACT.md`。
- Express 主后端改动后必须跑 `npm run build`。
- 前端只对接 Express。
- AI Engine 只暴露给 Express。
- `.env`、`.venv`、`node_modules`、`dist` 不提交。
- 提交信息格式为 `<type>: <中文说明>`，例如 `refactor: 重构 memory 为长期记忆 CRUD 分层`。

## 当前最小验收目标

当前主链路：

```text
前端输入一句学习问题
-> POST /api/ai/chat
-> Express 构建 demo chat context
-> Express 调 FastAPI /chat
-> AI Engine 基于 context 返回 reply
-> 前端展示 AI 回复
```

当前产品模块验收：

```text
前端或调试工具调用 Express 产品 API
-> Express route
-> controller 取 params/body
-> service 操作内存数组
-> 返回统一响应
```
