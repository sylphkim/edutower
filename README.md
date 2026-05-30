# EduTower Backend

EduTower 是一个 AI 学习助手后端项目。当前仓库以 Express 作为主后端，负责产品 API、流程编排、静态页面托管、业务模块框架和 mock 数据；FastAPI 作为 AI Engine，负责 Agent 和模型推理能力。

当前阶段重点是“先把整体框架搭稳”，不是一次性完成全部业务功能。除了已有的通用 LLM 调用接口和 Express 到 FastAPI 的 AI Engine 桥接，其它 EduTower 业务模块目前都是可运行的 mock/stub。

## 技术栈

- Runtime: Node.js
- Language: TypeScript
- Web framework: Express
- AI Engine: FastAPI
- LLM SDK: `openai`
- Config: `dotenv`
- Dev runner: `tsx`
- Build: `tsc`
- API style: REST API

Express 是产品主入口。`/api/ai/chat` 会调用 FastAPI AI Engine 的 `/chat`；`/api/llm/*` 保留为底层 OpenAI-compatible Provider 直连测试接口。

LLM 接入层使用 OpenAI-compatible Chat Completions API。虽然依赖包叫 `openai`，但通过 `LLM_BASE_URL` 可以接 DeepSeek、OpenRouter、硅基流动或其它兼容服务。

## 当前框架

项目采用传统后端分层：

```text
src/
  app.ts                  # Express app，统一挂载 API 路由和错误处理
  server.ts               # 服务启动入口
  config/
    env.ts                # 环境变量读取和默认值
  routes/                 # 路由层：只定义 URL 和 HTTP method
  controllers/            # 控制器层：处理 req/res，做轻量参数检查
  services/               # 服务层：业务逻辑、LLM 调用、mock/stub 返回
  mock/                   # 当前阶段的演示数据
  types/                  # 共享类型定义
  utils/                  # 响应格式、错误、日志等通用工具
docs/                     # API 契约、模块拆分、开发流程说明
```

核心原则：

- `routes` 不写业务逻辑。
- `controllers` 不直接拼复杂业务结果。
- `services` 承担业务实现，后续真实功能优先在这里替换 mock。
- `types` 维护跨模块共享的数据结构。
- `AiEngineService` 只负责调用 FastAPI AI Engine。
- `LLMService` 保持通用，不塞学习计划、测验、错题本等具体业务逻辑。

## 已有能力

已完成：

- Express + TypeScript 后端基础结构
- 统一成功/失败响应格式
- Express 到 FastAPI AI Engine 的 `/api/ai/chat` 桥接
- OpenAI-compatible LLM 调用服务
- 健康检查接口
- 通用 LLM chat/generate 接口
- EduTower 业务模块 API 框架
- 各模块 mock 数据和领域类型
- API 契约与模块文档

## 暂未实现

以下功能还没有真实实现，目前只保留接口和 mock/stub：

- 资料上传、解析、切块
- RAG 和向量数据库
- 知识点自动抽取
- 学习计划真实生成
- 测验题真实生成和判分
- 错题本持久化
- 长期记忆持久化和更新策略
- 用户系统、登录鉴权
- 数据库接入
- 独立前端工程

## 安装

```bash
npm install
```

## 环境变量

复制示例文件：

```bash
cp .env.example .env
```

示例：

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

- `AI_ENGINE_BASE_URL` 是 FastAPI AI Engine 地址，默认 `http://127.0.0.1:8000`。
- `AI_ENGINE_TIMEOUT_MS` 是 Express 调用 AI Engine 的超时时间。
- `LLM_PROVIDER` 用来标识当前模型服务商。
- `LLM_API_KEY` 是模型服务 API Key。
- `LLM_MODEL` 是模型名称。
- `LLM_BASE_URL` 是 OpenAI-compatible 服务地址。
- `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL` 仍可作为旧配置 fallback。

## 本地开发

启动开发服务：

```bash
npm run dev
```

默认地址：

```text
http://localhost:3000
```

Windows PowerShell 如果遇到 `npm.ps1` 执行策略问题，可以使用：

```bash
npm.cmd run dev
```

## 构建和启动

```bash
npm run build
npm start
```

Windows PowerShell 可使用：

```bash
npm.cmd run build
npm.cmd start
```

## API 概览

已具备真实能力：

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| POST | `/api/llm/chat` | 通用 LLM 多轮消息接口 |
| POST | `/api/llm/generate` | 通用文本生成接口 |
| POST | `/api/ai/chat` | 面向 EduTower 的 chat 入口，由 Express 调用 FastAPI AI Engine |
| POST | `/chat` | 兼容当前静态前端的 chat 入口，返回 `{ reply }` |

业务模块占位接口：

| Method | Path | 当前状态 |
| --- | --- | --- |
| POST | `/api/materials/upload` | mock/stub |
| GET | `/api/materials/chunks` | mock/stub |
| POST | `/api/plan/generate` | mock/stub |
| GET | `/api/skills/tree` | mock/stub |
| POST | `/api/quiz/generate` | mock/stub |
| POST | `/api/quiz/submit` | mock/stub |
| GET | `/api/wrongbook` | mock/stub |
| GET | `/api/memory/profile` | mock/stub |
| POST | `/api/memory/update` | mock/stub |

详细契约见 `docs/API_CONTRACT.md`。

## 后续怎么开发

建议按下面顺序推进：

1. Materials 模块：实现真实上传、解析、切块，替换 `src/services/materials.service.ts` 的 mock 返回。
2. Skills 模块：基于资料 chunks 抽取知识点，完善 `src/types/edutower.ts` 中的知识点结构。
3. Plan 模块：根据知识点、学习目标和时间生成学习计划。
4. Quiz 模块：根据知识点生成题目，并实现提交判分。
5. Wrongbook 模块：记录错题、解释、复习次数和复习状态。
6. Memory 模块：沉淀用户画像、薄弱点、偏好和长期学习状态。
7. Database/Auth：等业务数据结构稳定后再接数据库和用户系统。

开发新模块时建议保持这个节奏：

1. 先在 `src/types/edutower.ts` 定义类型。
2. 在 `src/mock/` 准备最小 mock 数据。
3. 在 `src/services/` 写服务函数。
4. 在 `src/controllers/` 接入请求和响应。
5. 在 `src/routes/` 暴露路由。
6. 在 `src/app.ts` 挂载路由。
7. 更新 `docs/API_CONTRACT.md`。
8. 跑 `npm run build` 确认类型通过。

## 文档

- `docs/API_CONTRACT.md`: API 路径、响应格式、当前实现状态
- `docs/MODULE_SPLIT.md`: 模块拆分和代码边界
- `docs/DEVELOPMENT_FLOW.md`: 推荐开发阶段和推进顺序
