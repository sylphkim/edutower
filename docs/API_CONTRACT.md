# API 契约

EduTower 当前对外暴露 Express 后端 API。Express 是面向产品和前端的后端服务，并将 Agent 或模型执行委托给 FastAPI AI Engine。

当前产品模块已经从早期单一演示接口整理为 routes/controller/service/types 分层，并暂时使用内存数组保存数据。

## 通用响应格式

成功响应：

```json
{
  "ok": true,
  "data": {}
}
```

失败响应：

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Route not found."
  }
}
```

说明：

- `sendSuccess` 负责成功响应。
- `sendError` 和全局错误处理中间件负责失败响应。
- service 中抛出的 `AppError` 会由 `app.ts` 中的全局错误处理中间件转换成统一失败响应。

## 稳定接口列表

| Method | Path | Status | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | ready | 服务健康检查 |
| POST | `/api/ai/chat` | ready | 面向产品的聊天接口，内部调用 FastAPI AI Engine `/chat` |
| POST | `/chat` | ready | 兼容旧静态前端的聊天接口，返回 `{ reply }` |
| POST | `/api/llm/chat` | ready | 用于测试模型供应商的底层通用聊天接口 |
| POST | `/api/llm/generate` | ready | 用于测试模型供应商的底层通用文本生成接口 |

## 产品模块接口

### Materials

当前只维护资料 metadata，不做真实文件上传、OCR、RAG 或数据库持久化。

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/materials` | 获取资料列表 |
| GET | `/api/materials/:id` | 获取单条资料 |
| POST | `/api/materials` | 创建资料 metadata |
| PATCH | `/api/materials/:id` | 更新资料 metadata |
| DELETE | `/api/materials/:id` | 删除资料 metadata |

### Plan

当前只保存学习计划记录，不调用真实 LLM 生成计划。

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plan` | 获取学习计划列表 |
| GET | `/api/plan/:id` | 获取单条学习计划 |
| POST | `/api/plan` | 创建学习计划 |
| PATCH | `/api/plan/:id` | 更新学习计划 |
| DELETE | `/api/plan/:id` | 删除学习计划 |

### Skills

当前使用内存数组保存技能记录；`/tree` 会按 `parentId` 组织 `children`。

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/skills` | 获取技能扁平列表 |
| GET | `/api/skills/tree` | 获取技能树 |
| GET | `/api/skills/:id` | 获取单条技能 |
| POST | `/api/skills` | 创建技能 |
| PATCH | `/api/skills/:id` | 更新技能 |
| DELETE | `/api/skills/:id` | 删除技能 |

### Quiz

当前不接真实 LLM；`POST /api/quiz` 会根据请求体创建一份 mock quiz。

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/quiz` | 获取测验列表 |
| GET | `/api/quiz/:id` | 获取单条测验 |
| POST | `/api/quiz` | 创建 mock 测验 |
| POST | `/api/quiz/:id/submit` | 提交答案并返回评分结果 |
| DELETE | `/api/quiz/:id` | 删除测验 |

### Wrongbook

当前使用内存数组保存错题记录，不接数据库。

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/wrongbook` | 获取错题列表 |
| GET | `/api/wrongbook/:id` | 获取单条错题 |
| POST | `/api/wrongbook` | 创建错题 |
| PATCH | `/api/wrongbook/:id` | 更新错题 |
| DELETE | `/api/wrongbook/:id` | 删除错题 |

### Memory

当前使用内存数组保存长期学习记忆；`daily-summary` 暂时根据请求体拼接简单文本，不调用真实 LLM。

注意：`POST /api/memory/daily-summary` 在 routes 中必须写在 `/:id` 前面。

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/memory` | 获取记忆列表 |
| GET | `/api/memory/:id` | 获取单条记忆 |
| POST | `/api/memory` | 创建记忆 |
| PATCH | `/api/memory/:id` | 更新记忆 |
| DELETE | `/api/memory/:id` | 删除记忆 |
| POST | `/api/memory/daily-summary` | 创建每日总结型记忆 |

## AI 聊天上下文

`POST /api/ai/chat` 的前端请求格式保持简单，只需要传 `message` 和 `session_id`。

请求示例：

```json
{
  "message": "How do I convert a quadratic function into vertex form?",
  "session_id": "demo-session"
}
```

Express 内部会根据 `session_id` 构建 demo chat context，并将该 context 一起转发给 FastAPI AI Engine `/chat`。

旧版 `POST /chat` 接口也会在 Express 内部向 AI Engine 传递同一份 demo chat context；为了兼容旧前端，响应结构保持：

```json
{
  "reply": "..."
}
```

## 当前边界

- 产品模块当前只使用进程内内存数组；重启服务后数据会恢复为 mock 初始数据。
- 当前不接数据库、不接登录鉴权。
- Materials 不做真实上传、解析、OCR 或 RAG。
- Plan、Quiz、Memory 的生成类能力当前不调用真实 LLM。
- FastAPI 仍作为 AI Engine 边界使用，不直接操作产品数据。

## Plan / Quiz / Skills 字段关系

- `PlanDay.title` 保留在 API 响应中，但由 service 根据 `day` 派生，不作为数据库字段。
- `PlanTask.materialId` 是有效业务字段，API 继续读写，并持久化到 `StudyTask.materialId`。
- `PlanTask.quizId` 已从计划 API 中删除；前端和 mock 不再携带该字段。
- `Quiz.studyTaskId` 表达一次计划任务产生的多轮测验关系；一个 `StudyTask` 可以关联多个 `Quiz`。
- `QuizItem.materialId` 只作为响应兼容字段返回，来源是关联计划任务的 `materialId`，创建测验时不再接收 `materialId`。
- `POST /api/quiz` 创建测验时必须提供 `skillId` 或 `studyTaskId`。如果使用 `studyTaskId`，该任务必须属于当前 demo project，并且能确定对应知识点。
- `SkillItem.prerequisites` 继续保留在技能 API 中，并由 `KnowledgeNodePrerequisite` 持久化。重复依赖、自依赖或跨项目依赖会返回 400。
