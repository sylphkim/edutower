# EduTower API Contract

本文档描述当前 Express 后端对前端暴露的 API 契约。Express 是唯一面向前端的产品 API 边界；FastAPI 只作为 AI Engine，由 Express 内部调用，不直接操作产品数据库。

```text
Frontend / static
-> Express API
-> FastAPI AI Engine
-> LLM Provider
```

## 状态标记

| Status | 含义 |
| --- | --- |
| `ready` | 已挂载，接口形状稳定，当前阶段可验收 |
| `partial` | 已挂载，但仍依赖 demo 用户、mock 生成或缺少完整产品闭环 |
| `mock` | 主要使用内存数据或 demo context，不代表真实持久化能力 |
| `debug` | 调试接口，不建议作为前端产品流程依赖 |
| `implemented-not-mounted` | 代码已实现，但当前未在 `app.ts` 暴露为公开 API |

## 通用响应

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

- controller 统一使用 `sendSuccess()` 返回成功响应。
- service 抛出的 `AppError` 会由全局错误处理中间件转换为统一失败响应。
- 未捕获异常会返回 `INTERNAL_ERROR`。
- 当前多数业务接口使用 Demo 用户，不要求登录态。

例如 `GET /api/health` 的健康检查响应：

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "database": "not_configured"
  }
}
```

- `status`：`"ok"` 或 `"degraded"`（数据库异常时降级）。
- `database`：`"ok"`、`"not_configured"`、`"error"`。当前阶段未配置 `DATABASE_URL` 时返回 `"not_configured"`。

## API总览

| Method | Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/health` | ready | 健康检查 |
| POST | `/api/ai/chat` | ready | 产品聊天入口，内部调用 FastAPI AI Engine，失败时降级 |
| POST | `/chat` | ready | legacy 聊天接口，兼容旧静态前端 |
| GET | `/api/agent/panel` | mock | 基于 demo chat context 生成 Agent 面板数据 |
| POST | `/api/llm/chat` | debug | 直接调底层 LLM chat |
| POST | `/api/llm/generate` | debug | 直接调底层 LLM text generation |
| `/api/materials` | ready | 资料 CRUD、文件夹筛选、单文件上传 |
| `/api/plan` | partial | 学习计划 CRUD 已持久化，AI 生成计划未完成 |
| `/api/skills` | partial | 知识点/技能 CRUD 已持久化，仍使用 demo project |
| `/api/quiz` | partial | Quiz 持久化，题目生成仍是 mock 规则 |
| `/api/wrongbook` | partial | 错题项持久化，taxonomy 仍是服务端常量 |
| `/api/memory` | mock | 长期记忆当前为内存 mock |
| `/api/material-folders` | implemented-not-mounted | 文件夹模块已实现，但当前未在 `app.ts` 挂载 |

## AI Chat

### `POST /api/ai/chat`

请求体：

```json
{
  "message": "讲一下二次函数顶点式",
  "session_id": "demo-session"
}
```

也支持 `sessionId`。如果不传 session，默认为 `"default"`。

成功响应：

```json
{
  "ok": true,
  "data": {
    "answer": "...",
    "reply": "...",
    "text": "...",
    "session_id": "demo-session",
    "engine": "fastapi",
    "debugContextSummary": {
      "materialCount": 3,
      "knowledgePointCount": 5,
      "weakPointCount": 2,
      "sessionHistoryCount": 4
    }
  }
}
```

内部流程：

- Express 校验 `message`，读取 `session_id` 或 `sessionId`。
- Express 使用 demo chat context 组装学习上下文。
- 优先请求 FastAPI AI Engine 的 `POST /chat`。
- FastAPI 不可达或返回异常时，降级到本地 LLM 调用。
- 如果本地 LLM 缺少 API key，可返回 mock reply。

### `POST /chat`

legacy 接口，仍由 Express 处理并调用同一套 AI Engine bridge。

响应格式：

```json
{
  "reply": "..."
}
```

## Materials

Materials 已接 Prisma/SQLite。上传文件保存在 `uploads/materials/`，数据库保存资料记录和文件元数据。

### 资料列表

| Method | Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/materials` | ready | 查询全部资料 |
| GET | `/api/materials?folderId=<folderId>` | ready | 查询指定文件夹资料 |
| GET | `/api/materials?folderId=unclassified` | ready | 查询未分类资料 |

响应：

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "material-id",
        "title": "线性代数复习",
        "type": "slides",
        "source": "uploaded",
        "status": "ready",
        "folderId": null,
        "sourceType": "pdf",
        "originalFileName": "线性代数复习.pdf",
        "storedFileName": "uuid.pdf",
        "mimeType": "application/pdf",
        "fileSize": 12345,
        "storagePath": "uploads/materials/uuid.pdf",
        "createdAt": "2026-06-08T00:00:00.000Z",
        "updatedAt": "2026-06-08T00:00:00.000Z"
      }
    ]
  }
}
```

### 创建 JSON 资料

`POST /api/materials`

请求体：

```json
{
  "title": "手写笔记",
  "type": "note",
  "source": "manual",
  "folderId": null,
  "summary": "可选摘要"
}
```

说明：

- `folderId` 传字符串表示放入指定文件夹。
- `folderId` 传 `null` 或不传表示未分类。
- service 会校验文件夹存在且属于当前 Demo 用户。

### 上传文件资料

`POST /api/materials/upload`

请求格式：`multipart/form-data`

字段：

| Field | Required | 说明 |
| --- | --- | --- |
| `file` | yes | 单个上传文件 |
| `folderId` | no | 非空字符串表示指定文件夹；空字符串或不传表示未分类 |

限制：

- 最大 20 MB。
- 允许 `.pdf`、`.doc`、`.docx`、`.jpg`、`.jpeg`、`.png`。
- 同时校验扩展名和 MIME。
- 文件名由服务端生成，不信任客户端文件名作为存储文件名。

上传资料推断规则：

| 扩展名 | `type` | `sourceType` |
| --- | --- | --- |
| `.pdf` | `slides` | `pdf` |
| `.doc`, `.docx` | `note` | `doc` |
| `.jpg`, `.jpeg`, `.png` | `photo` | `image` |

文件一致性规则：

- 上传成功且数据库创建成功：磁盘文件和数据库记录同时存在。
- 文件落盘后业务校验或数据库创建失败：自动删除本次文件，不创建数据库记录。
- 删除上传资料：先删除磁盘文件，再删除数据库记录。
- 删除文本/链接资料：只删除数据库记录。
- 数据库记录存在但磁盘文件已丢失：删除资料仍可完成。
- 删除路径只能位于 `uploads/materials/` 内。

### 单条资料

| Method | Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/materials/:id` | ready | 查询单条资料 |
| PATCH | `/api/materials/:id` | ready | 更新资料元数据，可移动文件夹 |
| DELETE | `/api/materials/:id` | ready | 删除资料，上传资料会同步清理磁盘文件 |

`PATCH` 请求体：

```json
{
  "title": "新标题",
  "type": "note",
  "status": "ready",
  "folderId": null,
  "summary": "新摘要"
}
```

## Material Folders

资料文件夹模块已完成 repository/service/controller/routes，但当前没有在 `src/app.ts` 挂载，所以不是公开 ready API。

已实现但未公开挂载的路由设计：

| Method | Planned Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/material-folders` | implemented-not-mounted | 查询文件夹列表 |
| POST | `/api/material-folders` | implemented-not-mounted | 创建文件夹 |
| PATCH | `/api/material-folders/:id` | implemented-not-mounted | 重命名文件夹 |
| DELETE | `/api/material-folders/:id` | implemented-not-mounted | 删除空文件夹 |

规则：

- 文件夹名会 trim 并按小写 normalizedName 查重。
- 删除非空文件夹返回 409。
- `normalizedName` 不返回给调用方。

## Plan

`/api/plan` 已接 Prisma，使用 Demo 用户和 Demo project。当前是 CRUD 能力，不包含真实 AI 生成计划。

| Method | Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/plan` | partial | 查询学习计划列表 |
| GET | `/api/plan/:id` | partial | 查询单个学习计划 |
| POST | `/api/plan` | partial | 创建学习计划 |
| PATCH | `/api/plan/:id` | partial | 更新学习计划 |
| DELETE | `/api/plan/:id` | partial | 删除学习计划 |

创建请求体：

```json
{
  "title": "期末复习计划",
  "goal": "两周内完成复习",
  "materialIds": [],
  "skillIds": [],
  "days": []
}
```

## Skills

`/api/skills` 映射到 Prisma `KnowledgeNode` 和 `KnowledgeNodePrerequisite`。技能树属于学习项目；`parentId/order` 只负责展示布局，真实业务依赖来自 DAG 前置边。

| Method | Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/skills` | partial | 查询 demo project 技能平铺列表 |
| GET | `/api/skills/tree` | ready | 查询项目技能树、DAG 依赖边、解锁状态和风险提示 |
| GET | `/api/skills/:id` | partial | 查询 demo project 单个技能 |
| POST | `/api/skills` | partial | 创建 demo project 技能，结构管理仍是开发接口 |
| PATCH | `/api/skills/:id` | ready | 受控修改学习状态，并触发后端自动解锁 |
| DELETE | `/api/skills/:id` | partial | 当前仍是硬删除；后续会改成“有历史则归档” |

### `GET /api/skills/tree`

Query：

| 参数 | 说明 |
| --- | --- |
| `projectId` | 可选；不传时使用 demo project |
| `includeArchived` | 可选；只有字符串 `"true"` 会包含归档节点 |

成功响应的 `data`：

```json
{
  "items": [
    {
      "id": "skill-id",
      "title": "二次函数定义",
      "description": "可选描述",
      "parentId": "parent-skill-id",
      "prerequisites": [],
      "learningState": "mastered",
      "isUnlocked": true,
      "unlockedAt": "2026-06-01T00:00:00.000Z",
      "mastery": 100,
      "order": 1,
      "createdAt": "2026-06-10T00:00:00.000Z",
      "updatedAt": "2026-06-10T00:00:00.000Z",
      "prerequisiteRisk": false,
      "riskPrerequisiteIds": [],
      "children": []
    }
  ],
  "dependencyEdges": [
    {
      "sourceId": "prerequisite-skill-id",
      "targetId": "dependent-skill-id"
    }
  ]
}
```

说明：

- `items` 是展示树；`dependencyEdges` 是真实 DAG 依赖边。
- `description`、`parentId`、`unlockedAt`、`archivedAt` 无值时可能不出现在 JSON 中。
- 默认只返回 `archivedAt = null` 的节点；活跃节点的 `parentId` 如果指向隐藏节点，会在展示树中提升为根，原始 `parentId` 不改。
- `prerequisites` 和 `dependencyEdges` 只包含本次可见节点集合内的依赖。
- `prerequisiteRisk` 只在 `isUnlocked=true` 的节点上计算。
- `riskPrerequisiteIds` 返回整条可见上游依赖链中当前未 `mastered` 的祖先节点 id。
- 如果本次可见依赖图存在环，返回 `409 INVALID_REQUEST`。

### `PATCH /api/skills/:id`

Query：

| 参数 | 说明 |
| --- | --- |
| `projectId` | 可选；不传时使用 demo project |

请求体只能包含一个字段：

```json
{
  "learningState": "learning"
}
```

`learningState` 只允许：

```text
not_started | learning | mastered
```

行为：

- 只能修改学习状态，不能由客户端直接修改 `isUnlocked`、`unlockedAt`、`prerequisites`、`parentId`、`mastery`、`order` 或风险字段。
- 节点不存在或不属于该 `projectId` 返回 404。
- 归档节点返回 409。
- 锁定节点只能 PATCH 当前状态作为幂等 no-op；要改成其他状态返回 409。
- 解锁节点允许三态互转，包括 `mastered -> learning`。
- 当节点实际变成 `mastered` 时，后端检查它的直接后续节点；所有直接前置都已 `mastered` 的活跃后续节点会自动 `isUnlocked=true` 并写入 `unlockedAt`。
- 上游回退不会重新锁定后续节点；风险由下一次 `GET /api/skills/tree` 派生。

专项说明见 `docs/SKILL_TREE.md`。

## Quiz

Quiz、Question、Attempt 已接 Prisma；题目生成仍是 mock 规则，不调用真实 LLM。

| Method | Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/quiz` | partial | 查询测验列表 |
| GET | `/api/quiz/:id` | partial | 查询单个测验 |
| POST | `/api/quiz` | partial | 创建 mock 测验 |
| POST | `/api/quiz/:id/submit` | partial | 提交答案并写入答题记录/错题 |
| DELETE | `/api/quiz/:id` | partial | 删除测验 |

创建请求体：

```json
{
  "title": "二次函数小测",
  "skillId": "skill-id",
  "studyTaskId": "task-id",
  "difficulty": "pass",
  "questionCount": 5
}
```

提交请求体：

```json
{
  "answers": [
    {
      "questionId": "question-id",
      "answer": "A"
    }
  ]
}
```

## Wrongbook

错题项已接 Prisma；subject/category taxonomy 当前由服务端常量提供，创建/删除 taxonomy 主要是重分配错题分类字段。

| Method | Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/wrongbook` | partial | 查询错题列表、subjects、categories |
| GET | `/api/wrongbook/:id` | partial | 查询单条错题 |
| POST | `/api/wrongbook` | partial | 创建错题 |
| PATCH | `/api/wrongbook/:id` | partial | 更新错题 |
| DELETE | `/api/wrongbook/:id` | partial | 软删除错题 |
| POST | `/api/wrongbook/subjects` | partial | 创建 subject taxonomy |
| DELETE | `/api/wrongbook/subjects/:id` | partial | 删除 subject 并重分配错题 |
| POST | `/api/wrongbook/categories` | partial | 创建 category taxonomy |
| DELETE | `/api/wrongbook/categories/:id` | partial | 删除 category 并重分配错题 |

列表响应包含：

```json
{
  "items": [],
  "subjects": [],
  "categories": []
}
```

## Memory

Memory 当前使用内存 mock，不是 Prisma 持久化。服务重启后会回到 mock 初始状态。

| Method | Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/memory` | mock | 查询记忆列表 |
| GET | `/api/memory/:id` | mock | 查询单条记忆 |
| POST | `/api/memory` | mock | 创建记忆 |
| PATCH | `/api/memory/:id` | mock | 更新记忆 |
| DELETE | `/api/memory/:id` | mock | 删除记忆 |
| POST | `/api/memory/daily-summary` | mock | 根据请求体生成每日总结型记忆 |

## LLM Debug

这些接口用于底层模型连通性调试，不建议前端产品流程直接依赖。

### `POST /api/llm/chat`

请求体：

```json
{
  "message": "你好"
}
```

响应数据：

```json
{
  "text": "...",
  "model": "...",
  "provider": "...",
  "usage": {}
}
```

### `POST /api/llm/generate`

请求体：

```json
{
  "systemPrompt": "你是学习助手",
  "userPrompt": "生成复习建议",
  "temperature": 0.7,
  "maxOutputTokens": 1000
}
```

## 当前 mock / partial 能力

- chat context 使用 `src/mock/demo*` 数据。
- Agent panel 主要来自 demo chat context，错题复习数量来自 wrongbook 当前数据。
- Memory 使用内存 mock。
- Quiz 题目生成是 mock 规则，但 Quiz/Question/Attempt 可持久化。
- Wrongbook taxonomy 使用服务端常量，WrongbookItem 可持久化。
- Plan、Skills、Materials、Wrongbook、Quiz 目前主要依赖 Demo 用户或 Demo project。
- 登录鉴权、多真实用户、OCR/RAG、文件下载、上传文件静态访问仍未完成。
