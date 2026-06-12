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
| `/api/plan` | partial | 旧学习计划 CRUD 已持久化；阶段计划版本与提案接口为 ready |
| `/api/daily` | ready | 每日学习单：生成、任务状态、重排、结束、总结建议决策、历史查询 |
| `/api/skills` | partial | 知识点/技能 CRUD 已持久化，仍使用 demo project |
| `/api/quiz` | partial | Quiz 持久化；题目经 FastAPI AI Engine 出题、失败兜底 mock；取测验不返回正确答案 |
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

阶段计划版本使用独立子资源，不改变上面的旧 Plan CRUD：

| Method | Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/plan/:projectId/versions` | ready | 按版本倒序查询阶段计划历史 |
| GET | `/api/plan/:projectId/versions/current` | ready | 查询当前已确认版本 |
| GET | `/api/plan/:projectId/versions/:versionId` | ready | 查询指定版本 |
| POST | `/api/plan/:projectId/versions` | ready | 创建下一版本草稿 |
| PATCH | `/api/plan/:projectId/versions/:versionId` | ready | 整份替换草稿阶段 |
| POST | `/api/plan/:projectId/versions/:versionId/confirm` | ready | 确认草稿并替代旧版本 |
| POST | `/api/plan/:projectId/versions/:versionId/revise` | ready | 复制当前确认版本为新草稿 |
| POST | `/api/plan/:projectId/proposals/apply` | ready | 校验并原子保存 AI Engine 的整体计划提案 |

### `POST /api/plan/:projectId/proposals/apply`

该接口是 AI Engine 到 Express 的受信后端契约。Express 不调用模型，只接收结构化提案，完成严格校验后在单个事务中创建知识树、前置关系和版本 1 阶段计划草稿。

```json
{
  "proposalId": "unique-proposal-id",
  "metadata": {
    "provider": "optional",
    "model": "optional",
    "generatedAt": "optional"
  },
  "nodes": [
    {
      "key": "algebra-basics",
      "title": "代数基础",
      "description": "可选",
      "parentKey": "optional-parent-key"
    }
  ],
  "prerequisiteEdges": [
    {
      "prerequisiteKey": "algebra-basics",
      "nodeKey": "quadratic-functions"
    }
  ],
  "phases": [
    {
      "title": "基础阶段",
      "goal": "掌握基础知识",
      "description": "可选",
      "completionCriteria": "可选",
      "nodeKeys": ["algebra-basics"]
    }
  ]
}
```

成功响应的 `data`：

```json
{
  "planVersion": {},
  "knowledgeNodes": [
    {
      "key": "algebra-basics",
      "id": "database-node-id"
    }
  ],
  "idempotentReplay": false
}
```

- 仅允许初始化属于 Demo 用户、状态为 `planning`、没有知识点且没有计划版本的项目；成功后项目仍为 `planning`。
- 首次应用返回 201。相同 `proposalId` 和相同规范化内容重试返回 200 及原结果；同 ID 不同内容返回 409。
- `parentKey` 只描述展示树，`prerequisiteEdges` 描述业务 DAG；两种图分别检测循环。
- 所有引用必须指向提案内节点。每个节点至少属于一个阶段，前置节点首次出现的阶段不得晚于后继节点。
- 限制为 200 个节点、50 个阶段、1000 条前置边和 1000 个阶段节点引用。
- 无直接前置的节点初始解锁；其余节点锁定。所有节点初始为 `not_started`、`mastery = 0`。
- `inputSnapshot` 由后端组装，包含项目目标字段、已关联资料的元数据、提案元数据、规范化内容哈希和 node key 映射；不包含文件路径或完整 `extractedText`。
- 知识节点、父子关系、前置边、阶段和阶段节点关联在同一事务内写入，失败不会保留部分数据。

创建草稿请求：

```json
{
  "inputSnapshot": {},
  "phases": [
    {
      "title": "基础阶段",
      "goal": "掌握基础知识",
      "description": "可选",
      "completionCriteria": "可选",
      "knowledgeNodeIds": ["knowledge-node-id"]
    }
  ]
}
```

- 同一项目最多存在一个 `draft`；冲突返回 409。
- 草稿允许空阶段或阶段暂时没有知识点，确认时要求至少一个阶段且每阶段至少一个有效知识点。
- `PATCH` 请求体只能包含完整的 `phases` 数组；阶段和知识点顺序按数组顺序保存。
- 知识点必须未归档且属于当前项目；同一阶段不可重复，同一知识点可以出现在多个阶段。
- 已确认和已替代版本不可修改。重复确认当前版本是幂等操作。
- 确认会在同一事务中替代旧确认版本、激活项目并更新 `planConfirmedAt`。
- `revise` 复制当前确认版本的阶段、知识点关联和 `inputSnapshot`，版本号自动递增。

版本响应示例：

```json
{
  "id": "plan-version-id",
  "projectId": "project-id",
  "version": 1,
  "status": "draft",
  "inputSnapshot": {},
  "phases": [
    {
      "id": "phase-id",
      "title": "基础阶段",
      "goal": "掌握基础知识",
      "order": 0,
      "knowledgeNodeIds": ["knowledge-node-id"]
    }
  ],
  "createdAt": "2026-06-10T00:00:00.000Z",
  "updatedAt": "2026-06-10T00:00:00.000Z"
}
```

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

## Daily Tasks

`/api/daily` 提供"今日任务 + 当天学习记录"闭环。每张 `DailyTaskSheet` 表示一个项目在某个本地日期（固定 `Asia/Shanghai` 时区）生成并持久化的学习单；同项目同一天只有一张，页面刷新只会读取已有记录，不会重新生成。

| Method | Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/daily/:projectId/today` | ready | 读取当天学习记录，不触发生成 |
| POST | `/api/daily/:projectId/today` | ready | 幂等获取或生成当天学习单；新建返回 201，已存在返回 200 |
| POST | `/api/daily/:projectId/today/regenerate` | ready | 重排今天未完成任务，生成新批次 |
| POST | `/api/daily/:projectId/today/close` | ready | 用户主动结束当天学习并生成总结 |
| GET | `/api/daily/:projectId/sheets` | ready | 查询历史学习单（含总结） |
| PATCH | `/api/daily/:projectId/tasks/:taskId` | ready | 修改任务状态；最后一个任务完成时自动结束当天 |
| POST | `/api/daily/:projectId/summaries/:summaryId/decisions` | ready | 对总结建议批量决策并回写技能树/薄弱点 |

### 当天学习记录结构

`GET /api/daily/:projectId/today`、`POST .../today`、`.../regenerate`、`.../close` 都返回同一个 `DailyStudyRecord`：

```json
{
  "sheet": {
    "id": "sheet-id",
    "projectId": "project-id",
    "planVersionId": "confirmed-plan-version-id-or-null",
    "currentPhaseId": "plan-phase-id-or-null",
    "localDate": "2026-06-11",
    "timezone": "Asia/Shanghai",
    "availableMinutes": 60,
    "generationCount": 1,
    "status": "active",
    "generatedAt": "2026-06-11T01:00:00.000Z",
    "closesAt": "2026-06-11T16:00:00.000Z",
    "endedAt": null,
    "closeReason": null,
    "tasks": [
      {
        "id": "task-id",
        "title": "继续学习：一般式与参数",
        "type": "master_skill",
        "status": "todo",
        "order": 0,
        "knowledgeNodeId": "node-id",
        "materialId": null,
        "planPhaseId": null,
        "carriedFromTaskId": null,
        "estimatedMinutes": 30,
        "sourceType": "plan",
        "selectionReason": "继续推进学习中的知识点。",
        "generationBatch": 1,
        "completedAt": null,
        "createdAt": "2026-06-11T01:00:00.000Z",
        "updatedAt": "2026-06-11T01:00:00.000Z"
      }
    ],
    "createdAt": "2026-06-11T01:00:00.000Z",
    "updatedAt": "2026-06-11T01:00:00.000Z"
  },
  "summary": null,
  "conversations": []
}
```

- `sheet` 为 `null` 表示今天还没有学习单（仅 GET 可能出现）。
- `summary` 在结束当天学习后出现，结构见下文。
- `conversations` 是当天与该项目关联的子对话（id、type、title、messageCount、时间戳）。当前聊天链路尚未把对话写入 `Conversation` 表，所以通常为空数组；接入后无需改动本接口。
- 任务字段说明：`sourceType` 为 `plan/carry_over/wrongbook/weak_point` 等候选来源；`selectionReason` 是 AI 或规则给出的入选理由；`carriedFromTaskId` 指向昨天未完成的原任务；`generationBatch` 区分同一天多次编排的批次。
- 学习单状态：`generating`（占位生成中）、`active`（进行中）、`awaiting_confirmation`（已结束待确认建议）、`completed`（正常完成）、`forced_closed`（零点强制结束）、`generation_failed`（生成失败，可重新 POST 重试）。
- 学习单不对外返回 `inputSnapshot`；候选池、AI/规则选择结果和失败原因等判断依据完整保留在该字段中，可直接查库审计。

### 生成规则

`POST /api/daily/:projectId/today` 的内部流程：

1. 先结算该项目所有已过零点仍未结束的历史学习单（惰性兜底，详见"自动结束"）。
2. 以 `Asia/Shanghai` 本地日期占位创建学习单（唯一约束保证并发下只有一张）。
3. 系统规则构建候选池，限制今天可选的知识点范围：
   - 最近一张已结束学习单中的未完成任务（续排，`carry_over`）；
   - 已确认薄弱点对应的巩固练习（`weak_point`）；
   - 未订正错题按知识点聚合的复习任务（`wrongbook`）；
   - 进行中（`learning` 且已解锁）的知识点继续学习（`plan`）；
   - 新知识点（已解锁未开始），存在已确认整体计划时仅限当前阶段（`plan`）。
4. AI 只在候选池内排序、取舍并为每个任务写一句理由；AI 不可用、超时或输出不合法时回退到规则排序。AI 不能创造候选之外的任务。
5. 任务与生成快照在同一事务内落库，学习单变为 `active`。

约束：

- `availableMinutes` 来自项目 `dailyMinutes`（缺省 60，范围 15–480），按预计时长贪心控制任务总量，单日最多 8 个任务。
- 项目不存在返回 404；`completed/archived` 项目返回 409。
- 生成失败时学习单标记 `generation_failed` 并记录错误，再次 POST 会重新生成；占位超过 2 分钟未完成视为中断，可被重新认领。

### 修改任务状态

`PATCH /api/daily/:projectId/tasks/:taskId`

请求体只允许一个字段：

```json
{
  "status": "done"
}
```

- `status` 只允许 `todo | in_progress | done`，`cancelled` 由系统在重排时写入。
- 只有 `active` 状态学习单上的任务可以修改；已取消任务返回 409。
- 响应返回 `{ "task": {}, "sheet": {}, "summary": {}, "autoClosed": false }`。
- 当最后一个未完成任务变为 `done` 时，后端在同一请求内自动结束当天学习（`closeReason=all_tasks_done`），响应中 `autoClosed=true` 且带上生成的总结。

### 重排未完成任务

`POST /api/daily/:projectId/today/regenerate`

- 仅 `active` 学习单可重排；今天没有学习单返回 404。
- 已完成任务保留；未完成任务标记 `cancelled`（不删除历史）。
- 重新执行候选规则与 AI 编排生成新批次，`generationCount` 加一；当天已完成的同类工作不会重复生成。

### 结束当天学习

三种触发方式，统一走同一条结束流程：

| 触发 | `closeReason` | 建议决策方 |
| --- | --- | --- |
| 任务全部完成（PATCH 自动触发） | `all_tasks_done` | 用户 |
| `POST .../today/close` | `user` | 用户 |
| 当天 24:00（零点） | `midnight` | 系统（`system_forced`） |

结束流程：

1. 聚合当天证据：任务完成情况、测验作答与正确率、新增错题、当天对话。
2. 生成总结草稿 `aiDraft`：优先调用 AI 生成 3-5 句中文总结，失败时回退到确定性模板。
3. 按规则生成待确认建议（`SummarySuggestion`，AI 不直接改状态）：
   - `knowledge_status`：完成学习任务的知识点建议进入「学习中」；任务全部完成且测验正确率达标的建议「已掌握」；无测验数据时建议小幅提升掌握度。
   - `weakness`：当天测验正确率低（≥2 题且 <50%）或新增错题 ≥2 道的知识点，建议标记薄弱点。
   - `review_suggestion`：列出未完成任务，提示明日自动续排。
4. 有建议时学习单与总结进入 `awaiting_confirmation`；没有建议时直接确认（`confirmationSource` 按触发方式取 `user/system/system_forced`）并完成。

`POST .../today/close` 在学习单非 `active` 时返回 409。

### 总结建议决策

`POST /api/daily/:projectId/summaries/:summaryId/decisions`

请求体：

```json
{
  "decisions": [
    { "suggestionId": "suggestion-1", "action": "accept" },
    { "suggestionId": "suggestion-2", "action": "modify", "proposedMastery": 40 },
    { "suggestionId": "suggestion-3", "action": "reject" }
  ],
  "confirmedContent": "可选；全部决策完成后写入的总结正文，缺省使用 aiDraft"
}
```

- `action` 允许 `accept | modify | reject`；`modify` 必须覆盖 `modifiedContent`、`proposedLearningState`、`proposedMastery` 中至少一个。
- 支持分批提交；每条建议只能决策一次，重复决策返回 409。
- 接受或修改的建议在同一事务中生效：
  - `knowledge_status`：更新 `KnowledgeNode.learningState/mastery`，复用技能树的自动解锁规则（变为 `mastered` 时解锁满足条件的直接后续节点），并写入 `KnowledgeStateEvent` 审计记录（含证据快照）。
  - `weakness`：创建或刷新项目内 `WeakPoint`（含证据快照）。
  - `review_suggestion`：仅记录决策，无直接副作用（续排由次日生成规则自动完成）。
- 全部建议决策完成后：总结变为 `confirmed`，学习单从 `awaiting_confirmation` 变为 `completed`，并写入每日总结型长期记忆（当前 Memory 仍为内存 mock）。
- 响应返回 `{ "summary": {}, "sheet": {} }`。

总结与建议结构：

```json
{
  "id": "summary-id",
  "dailyTaskSheetId": "sheet-id",
  "summaryDate": "2026-06-10T16:00:00.000Z",
  "status": "awaiting_confirmation",
  "aiDraft": "今天完成了……",
  "confirmedContent": null,
  "weaknesses": "「图像与开口方向」今日新增 2 道错题……",
  "confirmationSource": null,
  "confirmedAt": null,
  "suggestions": [
    {
      "id": "suggestion-id",
      "type": "knowledge_status",
      "knowledgeNodeId": "node-id",
      "studyTaskId": "task-id",
      "content": "今天完成了「图像与开口方向」的学习任务，建议将其状态更新为「学习中」。",
      "proposedLearningState": "learning",
      "proposedMastery": 30,
      "modifiedContent": null,
      "status": "pending",
      "decisionSource": null,
      "decidedAt": null
    }
  ]
}
```

### 自动结束（24:00）

- 每张学习单创建时写入 `closesAt` = 本地日期次日 00:00（`Asia/Shanghai`）。
- 服务端定时任务每 60 秒扫描一次过期未结束的学习单；同时所有 `/api/daily` 接口入口都会先惰性结算该项目的过期学习单，服务重启也不会漏掉。
- 过期的 `active` 学习单按 `midnight` 原因走完整结束流程；产生的建议由系统直接按建议内容接受（`decisionSource=system_forced`）。
- 过期的 `awaiting_confirmation` 学习单（用户结束了但没确认完）剩余建议同样由系统强制决策。
- 系统判断依据完整保留：`KnowledgeStateEvent.evidenceSnapshot` 与 `WeakPoint.evidenceSnapshot` 记录当天测验正确率、新增错题数、决策来源与原因（`midnight_auto_close`）。
- 强制结束的学习单最终状态为 `forced_closed`；尚未生成完成的学习单（`generating/generation_failed`）过零点后直接关闭，不生成总结。

### 历史查询

`GET /api/daily/:projectId/sheets?date=YYYY-MM-DD&limit=31`

- `date` 可选，查指定日期；`limit` 可选，1–62，缺省 31。
- 按日期倒序返回 `{ "items": [ { "sheet": {}, "summary": {} } ] }`。

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

Quiz、Question、Attempt 已接 Prisma。出题走 `前端→Express→FastAPI→LLM`：Express 出题器（`src/services/quizGenerator.service.ts`）调用 FastAPI AI Engine 的 `POST /generate-quiz`（入参知识点 + 难度 + 题数），由 FastAPI 内部拼 prompt、调 LLM 出**单项选择题**；Express 负责校验/规整/落库，**不直连 LLM**，FastAPI 不可用或返回不合格时兜底内置 mock 题。难度档位（`pass`/`high_score`）影响出题难易。取测验（list/get/create）响应**不返回** `answer`/`explanation`，正确答案只在 `/submit` 结果里返回。

| Method | Path | Status | 说明 |
| --- | --- | --- | --- |
| GET | `/api/quiz` | partial | 查询测验列表（题目不含正确答案/解析） |
| GET | `/api/quiz/:id` | partial | 查询单个测验（题目不含正确答案/解析） |
| POST | `/api/quiz` | partial | 创建测验（AI 出题，失败兜底 mock；响应不含正确答案） |
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
- Memory 使用内存 mock；每日总结确认后会调用它写入记忆，服务重启即丢失。
- Quiz 题目经 FastAPI AI Engine 生成（Express 调用，不直连 LLM；失败兜底 mock），Quiz/Question/Attempt 可持久化；取测验响应不含正确答案。
- Wrongbook taxonomy 使用服务端常量，WrongbookItem 可持久化。
- Plan、Daily、Skills、Materials、Wrongbook、Quiz 目前主要依赖 Demo 用户或 Demo project。
- Daily 的 `conversations` 依赖 `Conversation` 表；聊天链路尚未持久化对话，当前通常为空数组。
- Daily 的 AI 排序与 AI 总结依赖 `LLM_API_KEY`；未配置或调用失败时自动回退到确定性规则，不影响接口可用性。
- 登录鉴权、多真实用户、OCR/RAG、文件下载、上传文件静态访问仍未完成。
