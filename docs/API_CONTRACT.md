# API 契约

EduTower 当前对外暴露 Express 后端 API。Express 是面向产品和前端的后端服务，并将 Agent 或模型执行委托给 FastAPI AI Engine。多数产品模块仍处于 mock 阶段，目的是让前端和后续业务逻辑可以尽早基于稳定路径集成。

## 响应格式

接口标题：通用响应格式

说明：Express API 默认使用统一响应结构。成功响应包含 `ok` 和 `data`；失败响应包含 `ok` 和 `error`。

字段名：`ok`、`data`、`error`、`code`、`message`

JSON 示例：

```json
{
  "ok": true,
  "data": {}
}
```

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Route not found."
  }
}
```

备注：mock 模块会在 `data` 中返回 `meta` 和 `result`，用于说明当前模块状态和返回内容。

字段名：`meta`、`module`、`status`、`message`、`result`

JSON 示例：

```json
{
  "ok": true,
  "data": {
    "meta": {
      "module": "plan.generate",
      "status": "mock",
      "message": "Study plan generation is scaffolded only."
    },
    "result": {}
  }
}
```

## 稳定接口

接口标题：稳定接口列表

说明：以下接口路径当前作为前端和后端之间的稳定契约使用。

字段名：`Method`、`Path`、`Status`、`Purpose`

| Method | Path | Status | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | ready | 服务健康检查 |
| POST | `/api/ai/chat` | ready | 面向产品的聊天接口，内部调用 FastAPI AI Engine `/chat` |
| POST | `/chat` | ready | 兼容旧静态前端的聊天接口，返回 `{ reply }` |
| POST | `/api/llm/chat` | ready | 用于测试模型供应商的底层通用聊天接口 |
| POST | `/api/llm/generate` | ready | 用于测试模型供应商的底层通用文本生成接口 |
| POST | `/api/materials/upload` | mock | 学习资料上传占位接口 |
| GET | `/api/materials/chunks` | mock | 学习资料分块占位接口 |
| POST | `/api/plan/generate` | mock | 学习计划生成占位接口 |
| GET | `/api/skills/tree` | mock | 技能树占位接口 |
| POST | `/api/quiz/generate` | mock | 题目生成占位接口 |
| POST | `/api/quiz/submit` | mock | 答题提交占位接口 |
| GET | `/api/wrongbook` | mock | 错题本列表占位接口 |
| GET | `/api/memory/profile` | mock | 学习者记忆画像占位接口 |
| POST | `/api/memory/update` | mock | 学习者记忆更新占位接口 |

备注：`Status` 使用 `ready` 或 `mock` 标识接口当前状态；字段名保持英文，说明内容使用中文。

## AI 聊天上下文

接口标题：AI 聊天上下文注入

说明：`POST /api/ai/chat` 的前端请求格式不变，前端仍然只需要传 `message` 和 `session_id`。

字段名：`message`、`session_id`

JSON 示例：

```json
{
  "message": "How do I convert a quadratic function into vertex form?",
  "session_id": "demo-session"
}
```

备注：Express 内部会根据 `session_id` 构建 demo chat context，并将该 context 一起转发给 FastAPI AI Engine `/chat`。当前 context 使用高中数学二次函数的 mock 学习数据，包括学科信息、学习资料、知识点、薄弱点和最近几轮 session history。

接口标题：旧版聊天接口兼容

说明：旧版 `POST /chat` 接口也会在 Express 内部向 AI Engine 传递同一份 demo chat context。

字段名：`reply`

JSON 示例：

```json
{
  "reply": "..."
}
```

备注：为了兼容旧前端，`POST /chat` 的响应结构保持 `{ "reply": "..." }` 不变。

## 当前边界

接口标题：当前实现边界

说明：项目目前尚未实现真实文件解析、RAG、向量存储、学习计划生成、题目批改、错题本持久化或长期记忆持久化。

字段名：无新增字段。

JSON 示例：无。

备注：产品流程应优先通过 Express 进入；FastAPI 仍作为 AI Engine 边界使用。
