# Module Split

EduTower 使用 Express 作为面向前端的主后端，使用 FastAPI 作为 AI Engine。Express 负责产品 API、数据库读写、文件上传、上下文组装和统一响应；FastAPI 负责 Agent、prompt、工具编排和模型调用。

## 基础模块

| 模块 | 主要文件 | 职责 |
| --- | --- | --- |
| 应用启动 | `src/server.ts`, `src/app.ts` | 启动 Express，挂载全局中间件和 API routes |
| 环境配置 | `src/config/env.ts` | 读取 Express、AI Engine、LLM provider 配置 |
| 统一响应 | `src/utils/apiResponse.ts` | 输出 `{ ok, data }` 和 `{ ok, error }` |
| 错误处理 | `src/utils/errors.ts`, `src/app.ts` | 定义 `AppError`，在全局错误处理中间件中转换响应 |
| 日志 | `src/utils/logger.ts` | 输出服务端日志 |
| Prisma | `src/lib/prisma.ts`, `prisma/schema.prisma` | 初始化 Prisma Client，定义数据库模型 |
| Demo 用户/项目 | `src/services/demoUser.service.ts`, `src/services/demoProject.service.ts`, `src/repositories/users.repository.ts`, `src/repositories/projects.repository.ts` | 当前阶段替代真实用户和项目上下文 |
| AI Engine bridge | `src/routes/ai.routes.ts`, `src/controllers/ai.controller.ts`, `src/services/aiEngine.service.ts` | 将产品聊天请求转发给 FastAPI，并处理降级 |
| LLM Debug | `src/routes/llm.routes.ts`, `src/controllers/llm.controller.ts`, `src/services/llm.service.ts`, `src/types/llm.ts` | 提供底层 OpenAI-compatible provider 调试能力 |
| Chat Context | `src/services/chatContext.service.ts`, `src/types/chatContext.ts`, `src/mock/demo*.ts` | 组装当前 demo 学习上下文 |
| Agent Panel | `src/routes/agentPanel.routes.ts`, `src/controllers/agentPanel.controller.ts`, `src/services/agentPanel.service.ts`, `src/types/agentPanel.ts` | 基于 demo context 和错题数据输出面板信息 |
| 文件上传中间件 | `src/middlewares/materialUpload.middleware.ts` | 校验并保存资料上传文件 |
| 本地日期工具 | `src/utils/localDate.ts` | Asia/Shanghai 本地日期与次日零点计算，供每日学习单使用 |
| 零点 Sweeper | `src/services/dailySheetSweeper.ts`, `src/server.ts` | 每 60 秒扫描过零点未结束的学习单并强制结算；服务启动时挂载 |

## 产品模块

产品模块统一按 routes/controller/service/repository/types/mock 分层。不是每个模块都一定有 repository 或 mock；有数据库读写时优先通过 repository，仍是内存数据时保留 mock。

| 模块 | Routes | Controllers | Services | Repositories | Types | Mock |
| --- | --- | --- | --- | --- | --- | --- |
| Materials | `src/routes/materials.routes.ts` | `src/controllers/materials.controller.ts` | `src/services/materials.service.ts` | `src/repositories/materials.repository.ts` | `src/types/materials.ts` | `src/mock/materials.ts` |
| MaterialFolders | `src/routes/materialFolders.routes.ts` | `src/controllers/materialFolders.controller.ts` | `src/services/materialFolders.service.ts` | `src/repositories/materialFolders.repository.ts` | `src/types/materialFolders.ts` | none |
| Plan | `src/routes/plan.routes.ts` | `src/controllers/plan.controller.ts`, `src/controllers/planVersions.controller.ts`, `src/controllers/planProposals.controller.ts` | `src/services/plan.service.ts`, `src/services/planVersions.service.ts`, `src/services/planProposals.service.ts`, `src/services/planProposalValidation.ts` | `src/repositories/projects.repository.ts`, `src/repositories/planVersions.repository.ts`, `src/repositories/planProposals.repository.ts` | `src/types/plan.ts`, `src/types/planVersion.ts`, `src/types/planProposal.ts` | `src/mock/plan.ts` |
| DailyTasks | `src/routes/dailyTasks.routes.ts` | `src/controllers/dailyTasks.controller.ts` | `src/services/dailyTasks.service.ts`, `src/services/dailySummaries.service.ts`, `src/services/dailyTaskGeneration.ts`, `src/services/dailyTaskMappers.ts` | `src/repositories/dailyTaskSheets.repository.ts` | `src/types/dailyTasks.ts` | none |
| Skills | `src/routes/skills.routes.ts` | `src/controllers/skills.controller.ts` | `src/services/skills.service.ts` | `src/repositories/knowledgeNodes.repository.ts` | `src/types/skills.ts` | `src/mock/skills.ts`, `src/mock/knowledgePoints.ts` |
| Quiz | `src/routes/quiz.routes.ts` | `src/controllers/quiz.controller.ts` | `src/services/quiz.service.ts`, `src/services/quizGenerator.service.ts` | `src/repositories/quizzes.repository.ts` | `src/types/quiz.ts` | `src/mock/quiz.ts` |
| Wrongbook | `src/routes/wrongbook.routes.ts` | `src/controllers/wrongbook.controller.ts` | `src/services/wrongbook.service.ts` | `src/repositories/wrongbook.repository.ts` | `src/types/wrongbook.ts` | `src/mock/wrongbook.ts`, `src/mock/wrongbookTaxonomy.ts` |
| Memory | `src/routes/memory.routes.ts` | `src/controllers/memory.controller.ts` | `src/services/memory.service.ts` | none | `src/types/memory.ts` | `src/mock/memory.ts` |

当前状态：

- Materials、Plan、DailyTasks、Skills、Quiz、Wrongbook 主要使用 Prisma/SQLite。
- Skills 的节点、DAG 前置依赖、学习状态、解锁资格和归档字段都由 Express 后端通过 Prisma/SQLite 管理。
- MaterialFolders 已实现完整分层，但当前未在 `src/app.ts` 挂载为公开 API。
- Memory 仍使用内存 mock；每日总结确认后写入的记忆同样落在 mock 中。
- Chat Context 仍使用 demo mock，不直接从数据库/RAG 读取。

Skills 分层边界：

- controller 只解析 `projectId`、`includeArchived` 和 PATCH body。
- service 负责学习状态校验、自动解锁、前置风险派生和依赖环检测。
- repository 负责 `KnowledgeNode` / `KnowledgeNodePrerequisite` 的 Prisma 读写和事务。
- 前端只调用 Express API，不直接推导解锁资格或风险。
- FastAPI AI Engine 不直接读写技能树数据库；后续需要技能上下文时由 Express 组装后传给 AI Engine。

DailyTasks 分层边界：

- controller 只解析 `projectId`、`taskId`、`summaryId`、query 和 body，调用 service 返回统一响应。
- `dailyTasks.service` 负责今日学习单的幂等获取/生成、任务状态流转、重排和用户结束入口。
- `dailySummaries.service` 负责结束流程：证据聚合、总结草稿、规则建议、决策应用和零点强制结算。
- `dailyTaskGeneration.ts` 是纯生成逻辑：系统规则限定候选池，AI 只在候选内排序、取舍并解释，输出经严格校验，失败回退规则排序。
- `dailyTaskSheets.repository` 负责学习单、任务、总结、建议、薄弱点、状态事件的 Prisma 读写和事务；建议决策事务复用 `knowledgeNodes.repository` 导出的状态变更与自动解锁函数，保证与 Skills PATCH 同一套解锁规则。
- AI 调用走 `llm.service`（OpenAI-compatible provider）；未配置 key 或调用失败时整条链路保持可用。

## 分层职责

### Routes

- 只注册 HTTP method 和 path。
- 只挂载该路由需要的 middleware，例如上传中间件。
- 固定路径必须放在 `/:id` 这类参数路径前面。
- 不写业务判断，不直接调用 service 以外的层。

### Controllers

- 读取 `req.params`、`req.query`、`req.body`、`req.file`。
- 调用 service。
- 使用 `sendSuccess()` 返回响应。
- 使用 `try/catch -> next(error)` 交给全局错误处理。
- 不直接调用 Prisma 或 repository。
- 不做重名、归属、文件夹是否存在等业务判断。

### Services

- 负责业务规则、输入校验、Demo 用户/项目获取、错误转换和 API DTO 映射。
- 可以组合多个 repository。
- 可以处理文件和数据库一致性这类业务顺序。
- 不使用 Express `Request` / `Response`。
- 不直接拼 HTTP JSON 响应。

### Repositories

- 只负责 Prisma 读写。
- 不 trim、不 lowerCase、不判断重名。
- 不决定 HTTP 状态码。
- 不调用 Express。
- 不处理文件上传、文件删除或磁盘路径。

### Types

- 定义模块公开输入输出类型。
- API DTO 优先放在 `src/types/<module>.ts`。
- Prisma 类型只在 repository/service 内部使用，不直接作为对外 API 契约。

### Mock

- 只用于 demo context、内存模块或尚未真实生成的能力。
- mock 文件放在 `src/mock/`。
- 从 mock 迁移到真实能力时，优先保持 API shape 稳定。

## 类型文件归属

| 类型范围 | 放置位置 |
| --- | --- |
| 产品模块 DTO | `src/types/<module>.ts` |
| 资料文件夹 DTO | `src/types/materialFolders.ts` |
| Chat context | `src/types/chatContext.ts` |
| Agent panel | `src/types/agentPanel.ts` |
| LLM provider | `src/types/llm.ts` |
| 旧共享学习类型 | `src/types/edutower.ts` |
| Prisma generated types | `src/generated/prisma/*` |

规则：

- 新增产品模块时，优先新增自己的 `src/types/<module>.ts`。
- 不要把 Express `Request`、`Response`、`Express.Multer.File` 放进 service 输入类型。
- 上传 service 使用与 Express 无关的输入类型，例如 `CreateUploadedMaterialInput`。
- 对外返回字段应稳定；可为空字段优先用 `null` 表达“没有值”，不要让调用方同时处理字段缺失和 null。

## Express 与 FastAPI 边界

### Express 负责

- 对前端公开 API。
- 统一响应和错误处理。
- 读取请求参数、校验业务输入。
- Prisma 数据库读写。
- Demo 用户/项目和未来真实用户权限。
- 资料上传、文件元数据、文件删除一致性。
- 组装 Chat Context。
- 调用 FastAPI AI Engine。

### FastAPI AI Engine 负责

- 接收 Express 传入的 `session_id`、`message`、`context`。
- Agent 编排。
- prompt 构造。
- 工具调用。
- LLM provider 调用。
- 返回 AI 回复。

### 明确禁止

- 前端直接调用 FastAPI。
- FastAPI 直接操作产品数据库。
- FastAPI 直接读写 `uploads/materials/`。
- Express 的 route 文件承载业务规则。
- repository 处理 HTTP、文件上传或业务错误码。

## 当前推荐新增模块方式

新增产品模块时按以下顺序落地：

1. `src/types/<module>.ts`
2. `src/repositories/<module>.repository.ts`，如果需要数据库
3. `src/services/<module>.service.ts`
4. `src/controllers/<module>.controller.ts`
5. `src/routes/<module>.routes.ts`
6. 在 `src/app.ts` 挂载公开 API
7. 更新 `docs/API_CONTRACT.md`
8. 运行 `npm.cmd run build`

如果模块仍是 mock 阶段，可以先省略 repository，但必须在文档里标明 mock 状态。
