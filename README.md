# EduTower 开发说明

EduTower 是一个 AI 学习助手项目。当前阶段的目标不是一次性做完整产品，而是先打通第一个可演示闭环：

```text
静态前端页面 -> Express 主后端 -> FastAPI AI Engine -> LLM Provider -> 返回 AI 回复
```

本 README 面向开发协作使用，优先说明当前项目状态、架构边界、接口契约和第 1-2 天四人分工。

## 当前项目状态

已完成：

- Express + TypeScript 主后端骨架。
- 统一成功/失败响应格式。
- `GET /api/health` 健康检查。
- `POST /api/ai/chat` 产品聊天入口，由 Express 转发到 FastAPI AI Engine。
- `POST /chat` 临时兼容当前静态前端，后续前端应迁移到 `/api/ai/chat`。
- `POST /api/llm/chat`、`POST /api/llm/generate` 底层 LLM Provider 调试接口。
- `materials / plan / skills / quiz / wrongbook / memory` 模块 mock/stub 接口。
- `.venv`、`node_modules`、`dist` 不再进入 Git 追踪。

仍未完成：

- 前端还需要从 legacy `/chat` 迁移到 `/api/ai/chat`。
- AI Engine 还需要补依赖文件、启动说明、`/health` 和真实 LLM 调用。
- Express 后端还缺学习助教上下文 stub，例如科目、知识点、薄弱点、session history。
- 真实资料上传、RAG、知识点抽取、学习计划、测验判分、错题本、长期记忆、数据库、登录鉴权都还没做。

## 架构边界

```text
Frontend / static
  只调用 Express API

Express Backend / src
  产品 API、业务流程、统一响应、mock/stub、AI Engine bridge

FastAPI AI Engine / AI-Agent
  Agent、prompt、工具调用、LLM provider、模型错误处理

LLM Provider
  DeepSeek / OpenAI / OpenRouter / 硅基流动等 OpenAI-compatible 服务
```

核心规则：

- 前端不要直接调用 FastAPI。
- Express 是唯一面向前端的后端入口。
- FastAPI 只作为 AI Engine，不直接操作产品数据。
- 业务模块不要直接绕过 Express 流程调用 AI Engine。
- `LLMService` 只保留底层 Provider 调试能力，不放业务 prompt 和业务 JSON schema。

## 技术栈

| 层 | 技术栈 | 当前目录 |
| --- | --- | --- |
| 前端演示页 | HTML / CSS / JavaScript | `static/` |
| 主后端 | Node.js + TypeScript + Express | `src/` |
| AI Engine | Python + FastAPI | `AI-Agent/` |
| LLM Provider | OpenAI-compatible API | 由 AI Engine 负责接入 |
| 文档 | Markdown | `docs/` |

## 第 1-2 天四人分工

### 前端

负责范围：聊天页面 + 调 Express API。

下一步任务：

1. 找到当前静态演示页里的聊天区域。
2. 新建或整理 API 请求函数。
3. 聊天接口统一调用 Express 的 `POST /api/ai/chat`。
4. 页面显示用户消息。
5. 页面显示 AI 回复。
6. 请求中显示 loading。
7. 请求失败显示 error。
8. 不直接调用 FastAPI。

验收标准：

前端打开网页，输入一句话，能看到 AI 回复；断网或后端报错时，也能看到清楚的错误提示。

注意事项：

这两天不要做复杂页面，不要做技能树、错题本、资料上传，只做聊天链路页面。

### Express 后端 A

负责范围：主后端桥接 + API 契约。

当前状态：

桥接基础已完成，`/api/ai/chat` 已能调用 FastAPI `/chat`，并把结果包装成统一响应格式。

下一步任务：

1. 维护 `POST /api/ai/chat` 路由。
2. 接收前端 `message / session_id`。
3. 调用 FastAPI `POST /chat`。
4. 维护 `AI_ENGINE_BASE_URL` 和 `AI_ENGINE_TIMEOUT_MS` 环境变量。
5. 做超时处理。
6. 做错误处理。
7. 把 FastAPI 返回包装成统一格式。
8. 保证前端不需要知道 FastAPI 存在。

验收标准：

用 Postman/curl 调 `POST /api/ai/chat`，Express 能成功转发到 FastAPI，并返回统一格式。

注意事项：

不要写 `materials / quiz / wrongbook` 的具体业务。第 1-2 天只管桥接链路稳定。

### Express 后端 B

负责范围：聊天相关业务上下文 stub。

下一步任务：

1. 准备 demo 学科资料 mock。
2. 准备 demo 知识点 mock。
3. 准备 demo 薄弱点 mock。
4. 准备 demo session history mock。
5. 提供一个 `chatContext` service。
6. 让 Express A 可以把上下文传给 AI Engine。

建议新增文件：

```text
src/mock/chatContext.ts
src/services/chatContext.service.ts
src/types/chatContext.ts
```

验收标准：

用户问“我该怎么复习”，AI 回复里能体现“当前科目、知识点、薄弱点”，而不是普通聊天机器人回复。

注意事项：

重点是让 AI 聊天从“通用聊天”变成“学习助教聊天”。先做 stub，不接数据库，不做真实 RAG。

### AI Engine

负责范围：FastAPI + Agent + LLM。

下一步任务：

1. 整理 FastAPI 项目入口。
2. 提供 `POST /chat`。
3. 接收 `message / session_id / context`。
4. 拼接学习助教 prompt。
5. 调用 LLM provider。
6. 返回标准 JSON。
7. 做模型调用错误处理。
8. 不直接修改产品数据。

建议补齐：

```text
AI-Agent/requirements.txt
GET /health
AI Engine 启动说明
```

验收标准：

单独调用 FastAPI `POST /chat`，传入 `message` 和 `context`，能得到真实模型回复。

注意事项：

AI Engine 不直接写技能树状态、不直接写错题本、不直接写学习进度、不直接操作 Express 数据库。AI Engine 只负责：输入上下文，输出 AI 回复。

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
- `LLM_*` 当前主要用于底层 LLM 调试接口；最终真实模型调用优先放在 AI Engine。
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

请求：

```json
{
  "session_id": "demo-session",
  "message": "我该怎么复习导数？"
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "reply": "建议你先复习导数定义...",
    "text": "建议你先复习导数定义...",
    "engine": "fastapi"
  }
}
```

### 临时兼容接口

```http
POST /chat
```

该接口只用于兼容当前静态前端，返回：

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
- 提交信息默认使用中文，格式为 `<type>: <description>`。

## 当前最小验收目标

第 1-2 天只验收这一条主链路：

```text
前端输入一句话
-> POST /api/ai/chat
-> Express 调 FastAPI /chat
-> AI Engine 返回 reply
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
