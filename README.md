# EduTower 开发说明

EduTower 是一个 AI 学习助手项目。当前阶段的目标是先打通可演示闭环：

```text
静态前端页面 -> Express 主后端 -> FastAPI AI Engine -> LLM Provider -> 返回 AI 回复
```

Express 是面向前端的主后端。FastAPI 作为 AI Engine，负责 Agent、prompt 和模型调用。当前 Express 已经能在聊天请求中注入一份 demo 学习上下文，让 AI 回复从“通用聊天”开始靠近“学习助教聊天”。

## 当前项目状态

已完成：

- Express + TypeScript 主后端骨架。
- 统一成功/失败响应格式。
- `GET /api/health` 健康检查。
- `POST /api/ai/chat` 产品聊天入口，由 Express 转发到 FastAPI AI Engine。
- `POST /chat` 兼容旧静态前端，内部同样会走 AI Engine。
- `POST /api/llm/chat`、`POST /api/llm/generate` 底层 LLM Provider 调试接口。
- `materials / plan / skills / quiz / wrongbook / memory` 模块 mock/stub 接口。
- demo chat context 类型、mock 数据和组装服务。
- `/api/ai/chat` 和 `/chat` 调用 AI Engine 时会附带 demo chat context。
- `/api/ai/chat` 响应会返回 `debugContextSummary`，便于 demo 验收。

当前 demo chat context 使用“高中数学二次函数”场景，包含：

- demo 学科信息。
- demo 学习资料：老师课件、板书照片、考点大纲。
- demo 知识点：二次函数定义、图像与开口方向、顶点式、对称轴、最值问题、实际应用题等。
- demo 薄弱点：顶点式转换不熟、不会从图像读参数、最值应用题容易漏定义域等。
- demo session history：最近几轮学习对话。

仍未完成：

- 前端建议从 legacy `/chat` 迁移到 `/api/ai/chat`。
- AI Engine 需要确保读取 `context`，并把学习上下文融入 prompt。
- 真实资料上传、RAG、知识点抽取、学习计划、测验判分、错题本、长期记忆、数据库、登录鉴权都还没做。

## 架构边界

```text
Frontend / static
  只调用 Express API

Express Backend / src
  产品 API、业务流程、统一响应、mock/stub、chat context、AI Engine bridge

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
- AI Engine 接收 `message / session_id / context`，负责生成回复。
- `LLMService` 只保留底层 Provider 调试能力，不放业务 prompt 和业务 JSON schema。

## 技术栈

| 层 | 技术栈 | 当前目录 |
| --- | --- | --- |
| 前端演示页 | HTML / CSS / JavaScript | `static/` |
| 主后端 | Node.js + TypeScript + Express | `src/` |
| AI Engine | Python + FastAPI | `AI-Agent/` |
| LLM Provider | OpenAI-compatible API | 由 AI Engine 负责接入 |
| 文档 | Markdown | `docs/` |

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

当前返回结构：

```text
ChatContext
  subject
  materials
  knowledgePoints
  weakPoints
  sessionHistory
  generatedAt
```

说明：

- 现在 demo 阶段暂时忽略真实用户系统。
- 代码保留了 `sessionId` 参数。
- 后续可以根据 `sessionId` 查询数据库里的用户资料、历史记录和长期记忆。

## 本地启动

### 1. 安装 Express 依赖

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
- `LLM_*` 当前主要用于底层 LLM 调试接口；产品聊天主链路优先走 AI Engine。
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

AI Engine 同学需要补齐依赖文件后，使用团队约定的 Python 环境启动。当前入口是：

```bash
cd AI-Agent
python main.py
```

默认地址：

```text
http://127.0.0.1:8000
```

## 接口契约

详细说明见 [docs/API_CONTRACT.md](docs/API_CONTRACT.md)。

### 健康检查

```http
GET /api/health
```

响应：

```json
{
  "ok": true,
  "data": {
    "status": "ok"
  }
}
```

### 前端聊天入口

```http
POST /api/ai/chat
```

前端请求格式不变，只需要传 `message` 和 `session_id`：

```json
{
  "session_id": "demo-session",
  "message": "我总是不会把二次函数一般式转成顶点式，应该怎么复习？"
}
```

Express 内部会构建 demo chat context，并转发给 FastAPI AI Engine：

```json
{
  "session_id": "demo-session",
  "message": "我总是不会把二次函数一般式转成顶点式，应该怎么复习？",
  "context": {
    "subject": {},
    "materials": [],
    "knowledgePoints": [],
    "weakPoints": [],
    "sessionHistory": [],
    "generatedAt": "2026-05-31T00:00:00.000Z"
  }
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "reply": "可以先从顶点式转换开始复习...",
    "text": "可以先从顶点式转换开始复习...",
    "engine": "fastapi",
    "debugContextSummary": {
      "materialCount": 3,
      "knowledgePointCount": 7,
      "weakPointCount": 3,
      "sessionHistoryCount": 6
    }
  }
}
```

### 临时兼容接口

```http
POST /chat
```

该接口用于兼容当前静态前端。内部也会给 AI Engine 传 demo chat context，但响应仍保持旧格式：

```json
{
  "reply": "..."
}
```

后续前端迁移完成后，优先使用 `/api/ai/chat`。

### 底层 LLM 调试接口

```http
POST /api/llm/chat
POST /api/llm/generate
```

这两个接口用于调试 OpenAI-compatible Provider，不作为产品聊天主入口。

## 当前目录说明

```text
src/
  app.ts
  server.ts
  config/
  routes/
  controllers/
  services/
    aiEngine.service.ts
    chatContext.service.ts
  mock/
    demoSubject.ts
    demoMaterials.ts
    demoKnowledgePoints.ts
    demoWeakPoints.ts
    demoSessionHistory.ts
  types/
    chatContext.ts
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

## 当前协作重点

### 前端

负责范围：聊天页面 + 调 Express API。

下一步任务：

1. 将聊天接口统一切到 Express 的 `POST /api/ai/chat`。
2. 请求体继续发送 `message` 和 `session_id`。
3. 页面显示用户消息、AI 回复、loading 和 error。
4. 不直接调用 FastAPI。

验收标准：

前端打开网页，输入一句二次函数相关问题，能看到 AI 回复；断网或后端报错时，也能看到清楚的错误提示。

### Express 后端

负责范围：产品 API、chat context、AI Engine bridge。

当前状态：

桥接基础已完成，`/api/ai/chat` 和 `/chat` 都会调用 FastAPI `/chat`，并向 AI Engine 传入 demo chat context。

下一步任务：

1. 维护 `POST /api/ai/chat` 路由和统一响应。
2. 继续维护 `AI_ENGINE_BASE_URL` 和 `AI_ENGINE_TIMEOUT_MS` 环境变量。
3. 根据 demo 验收反馈调整 chat context mock 内容。
4. 后续逐步把 mock context 替换为数据库、RAG 和长期记忆数据。

验收标准：

用 Postman/curl 调 `POST /api/ai/chat`，Express 能成功转发到 FastAPI，并返回 `debugContextSummary`。

### AI Engine

负责范围：FastAPI + Agent + LLM。

下一步任务：

1. 提供或维护 `POST /chat`。
2. 接收 `message / session_id / context`。
3. 将 `context` 整理进学习助教 prompt。
4. 调用 LLM provider。
5. 返回标准 JSON。
6. 做模型调用错误处理。
7. 不直接修改产品数据。

验收标准：

单独调用 FastAPI `POST /chat`，传入 `message` 和 `context`，能得到体现学科、知识点、薄弱点和历史对话的模型回复。

## 开发规则

- 改接口前先更新 `docs/API_CONTRACT.md`。
- Express 主后端改动后必须跑 `npm run build`。
- 前端只对接 Express。
- AI Engine 只暴露给 Express。
- `.env`、`.venv`、`node_modules`、`dist` 不提交。
- 提交信息默认使用中文，格式为 `<type>: <description>`。

## 当前最小验收目标

当前只验收这一条主链路：

```text
前端输入一句二次函数学习问题
-> POST /api/ai/chat
-> Express 构建 demo chat context
-> Express 调 FastAPI /chat
-> AI Engine 基于 context 返回 reply
-> 前端展示 AI 回复
```

暂时不验收：

- 数据库
- 登录
- 文件上传
- RAG
- 向量数据库
- 技能树真实生成
- 测验真实生成
- 错题本持久化
- 长期记忆
