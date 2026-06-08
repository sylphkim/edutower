# Development Flow

本文档说明 EduTower 当前如何分阶段推进、下一阶段接入哪些真实能力，以及开发时必须遵守的边界。

## 阶段推进

### Phase 1: 后端基础与统一 API

状态：已完成。

- Express + TypeScript 主后端。
- `.env` 配置读取。
- 统一成功/失败响应格式。
- 全局错误处理中间件。
- `GET /api/health`。
- OpenAI-compatible LLM debug service。
- `POST /api/llm/chat`、`POST /api/llm/generate`。

验收重点：

- Express 可启动。
- `npm.cmd run build` 通过。
- API 成功/失败响应结构一致。

### Phase 2: AI 主链路

状态：已完成基础链路，仍使用 demo context。

- `POST /api/ai/chat` 打通 Express 到 FastAPI AI Engine。
- legacy `POST /chat` 保持兼容。
- `chatContextService` 组装 demo 学习上下文。
- AI Engine 不可用时，Express 可降级到本地 LLM；缺少 LLM key 时可返回 mock reply。

当前链路：

```text
Frontend
-> POST /api/ai/chat
-> Express 读取 message 和 session_id/sessionId
-> chatContextService.buildContext({ sessionId })
-> aiEngineService.chat({ sessionId, message, context })
-> FastAPI POST /chat
-> LLM Provider
-> 返回 reply
```

### Phase 3: 产品模块分层与持久化

状态：已完成主要模块分层，多数模块已接 Prisma。

- `materials / plan / skills / quiz / wrongbook / memory` 已整理为 routes/controller/service/types 分层。
- `materials / plan / skills / quiz / wrongbook` 主要通过 Prisma/SQLite 持久化。
- `memory` 当前仍是内存 mock。
- `chat context` 当前仍来自 `src/mock/demo*`。
- Demo 用户和 Demo project 用于当前开发阶段。

模块分层职责：

- route：只注册 HTTP method 和 path。
- controller：只读 `req.params`、`req.query`、`req.body`、`req.file`，调用 service，返回统一响应。
- service：处理业务校验、Demo 用户/项目、跨 repository 组合、错误转换。
- repository：只做 Prisma 读写，不处理 HTTP 和业务规则。
- types：定义模块输入输出契约。

### Phase 4: 资料库与文件一致性

状态：已完成当前最小闭环。

- Material 支持 `folderId`，可查询全部、指定文件夹、未分类。
- MaterialFolder repository/service/controller/routes 已完成，但当前未在 `app.ts` 挂载为公开 API。
- `POST /api/materials/upload` 支持单文件上传。
- 上传文件保存到 `uploads/materials/`。
- 上传成功时数据库记录和磁盘文件成对存在。
- 上传失败时清理已落盘文件。
- 删除上传资料时先删磁盘文件，再删数据库记录。
- 删除文本/链接资料时不触碰磁盘文件。
- 删除路径限制在 `uploads/materials/` 范围内。

当前最小验收：

```text
上传资料
-> 文件落盘
-> Material 记录入库
-> 删除资料
-> 文件和数据库记录都消失
```

## 下一阶段真实能力

推荐按下面顺序接入，不要一次性铺太多面。

### 1. 公开资料文件夹 API

- 在 `app.ts` 挂载 `/api/material-folders`。
- 前端接入文件夹列表、创建、重命名、删除空文件夹。
- 验证 Material 列表的 `folderId` 筛选和文件夹 CRUD 可配合使用。

### 2. 上传文件访问与下载

- 设计受控下载接口，而不是直接全局暴露 `uploads/`。
- 下载路径必须来自数据库记录。
- 继续限制文件路径只能在 `uploads/materials/` 内。
- 普通文本/链接资料不应返回文件下载地址。

### 3. 文件解析与文本抽取

- PDF、DOC/DOCX、图片 OCR 分阶段接入。
- 抽取结果写入 `Material.extractedText` 或后续专用 chunk 表。
- 文件解析失败不应破坏原始 Material 记录。
- 解析状态需要复用或扩展 `Material.status`。

### 4. RAG 与 Chat Context 数据化

- 将 demo chat context 替换为数据库、资料 chunks、错题、技能掌握度和长期记忆。
- Express 负责组装产品上下文。
- FastAPI AI Engine 只消费上下文并执行 Agent/LLM。
- 前端仍只调用 Express。

### 5. AI 生成学习计划和测验

- Plan：基于学习目标、可用时间、资料、技能薄弱点生成计划草稿。
- Quiz：基于资料 chunks 和 skill 生成题目。
- Wrongbook：继续从 quiz submit 沉淀错题。
- Memory：从学习事件、错题、计划完成情况中生成长期记忆。

### 6. 用户系统与权限

- 用真实用户替换 Demo 用户。
- 所有资料、文件夹、计划、技能、测验、错题、记忆必须按用户隔离。
- 文件下载、删除、移动都必须校验资源归属。

## 开发约束

### API 契约

- 改公开接口前先更新 `docs/API_CONTRACT.md`。
- 新接口必须说明 path、method、请求体、响应体、错误状态和当前 ready/mock/partial 状态。
- 不要把未挂载接口写成 ready。

### 分层边界

- controller 不直接调用 Prisma 或 repository。
- controller 不处理重名、归属、文件夹是否存在等业务规则。
- service 不使用 Express `Request` / `Response`。
- service 不直接拼 HTTP 响应。
- repository 不 trim、不 lowerCase、不决定 HTTP 状态码。
- repository 不调用其他 repository 来做业务判断。

### 文件上传与删除

- Multer 只挂在真正处理上传的 route 上，不作为全局中间件。
- 文件存储名必须由服务端生成。
- 数据库存储 `storagePath` 使用项目相对路径，不保存开发机绝对路径。
- 写库失败必须清理本次已落盘文件。
- 删除上传资料必须先删磁盘文件，再删数据库记录。
- 磁盘删除非 `ENOENT` 错误时必须保留数据库记录。
- 删除路径必须限制在 `uploads/materials/` 内。

### 数据库与 Prisma

- schema 变更和业务代码变更分步做。
- 修改 Prisma schema 后至少运行 `npx.cmd prisma validate`。
- 改 TypeScript 后运行 `npm.cmd run build`。
- 不在文档整理阶段顺手生成 migration。
- 不把 Demo 用户逻辑当成真实鉴权。

### AI Engine

- 前端不能直接调用 FastAPI。
- FastAPI 不直接操作产品数据库。
- Express 负责产品 API、权限、数据读取和上下文组装。
- FastAPI 负责 Agent、prompt、工具编排和模型调用。
- LLM debug 接口只用于调试，不作为前端产品主流程。

### Mock 与真实能力

- mock 能力必须在文档里标明。
- 从 mock 迁移到真实能力时，优先保持 API shape 稳定。
- 不能在已有 ready 接口上悄悄改变字段含义。
- Demo context 替换为数据库/RAG 前，需要先明确数据来源和失败降级策略。

### 验收与提交

- 每个阶段至少有一个最小端到端验收目标。
- Express 相关改动完成后运行 `npm.cmd run build`。
- 文件/数据库一致性相关改动必须用真实上传和删除流程验收。
- 提交信息格式使用 `<type>: <中文说明>`，例如 `docs: 更新开发流程文档`。

## 当前推荐工作顺序

1. 补齐文档：README、API_CONTRACT、DEVELOPMENT_FLOW、MODULE_SPLIT。
2. 挂载并验收 `/api/material-folders`。
3. 设计受控文件下载接口。
4. 接入文件解析，先做 PDF，再做 DOC/DOCX 和图片 OCR。
5. 设计资料 chunks/RAG schema。
6. 用真实资料上下文替换 demo chat context。
7. 接 AI 生成计划和测验。
8. 引入真实用户和权限隔离。
