# EduTower Data Model

本文档记录当前 Prisma 数据模型和 API 映射关系。当前数据库使用 Prisma + SQLite；`DATABASE_URL` 默认指向本地 `dev.db`。

当前阶段使用 Demo 用户和 Demo project 作为开发上下文。这只用于本地开发和模块串联，不等于真实登录鉴权，也不代表多用户权限已经完成。

## 模型总览

核心所有权关系：

```text
User
├─ MaterialFolder
├─ Material
├─ StudyProject
├─ Conversation
├─ WrongbookItem
└─ DailySummary
```

学习项目关系：

```text
StudyProject
├─ ProjectMaterial -> Material
├─ KnowledgeNode
│  └─ KnowledgeNodePrerequisite
├─ StudyPlanVersion
│  └─ PlanPhase
│     └─ PlanPhaseKnowledgeNode -> KnowledgeNode
├─ DailyTaskSheet
│  ├─ StudyTask
│  └─ DailySummary
├─ StudySession
├─ Quiz
├─ WrongbookItem
├─ WeakPoint
└─ KnowledgeStateEvent
```

测验与错题关系：

```text
Quiz
├─ QuizQuestion
│  ├─ QuizOption
│  └─ QuizAttempt
└─ WrongbookItem
```

## 用户与资料库

### User

`User` 是顶层所有者。当前代码通过 Demo 用户工作，后续真实用户系统会替换这层上下文。

主要关系：

- `User 1 -> N MaterialFolder`
- `User 1 -> N Material`
- `User 1 -> N StudyProject`
- `User 1 -> N Conversation`
- `User 1 -> N WrongbookItem`
- `User 1 -> N DailySummary`

删除 `User` 时，Prisma 会级联删除其资料、文件夹、项目、对话、错题和每日总结记录。

### MaterialFolder

`MaterialFolder` 表示资料文件夹。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 文件夹 ID |
| `userId` | 所属用户 |
| `name` | 展示名称 |
| `normalizedName` | 规范化名称，用于同用户下查重 |
| `createdAt`, `updatedAt` | 时间戳 |

约束：

- `@@unique([userId, normalizedName])` 保证同一用户下逻辑同名文件夹唯一。
- `@@index([userId])` 支持按用户列出文件夹。
- 删除用户时文件夹级联删除。
- 删除非空文件夹由 `Material.folder` 的 `onDelete: Restrict` 和 service 计数判断共同保护。

### Material

`Material` 表示资料。文本、链接、上传文件都属于同一个模型，只是上传文件会多出文件元数据。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `userId` | 所属用户 |
| `folderId` | 可空；`null` 表示未分类 |
| `title` | 展示标题 |
| `category` | 资料分类，对应 API 的 `type` |
| `sourceType` | 文件/来源类型：`pdf/doc/image/text/link` |
| `origin` | 来源：`uploaded/manual/mock` |
| `status` | 状态：`pending/processing/ready/failed` |
| `originalFileName` | 客户端原始文件名，可空 |
| `storedFileName` | 服务端生成文件名，可空，非空唯一 |
| `mimeType` | MIME 类型，可空 |
| `fileSize` | 文件大小，可空 |
| `storagePath` | 项目相对路径，可空 |
| `summary` | 摘要，可空 |
| `extractedText` | 后续文件解析文本，可空 |

索引与约束：

- `storedFileName String? @unique`：允许多条空值记录；非空存储文件名唯一。
- `@@index([userId])`：按用户查询资料。
- `@@index([userId, folderId])`：按用户和文件夹筛选资料。
- `folderId = null` 表示未分类。

文件一致性：

- `storagePath` 保存项目相对路径，不保存开发机绝对路径。
- 磁盘文件删除不是 Prisma 级联能力。
- 上传失败清理、删除资料时同步删除磁盘文件，都由 service 负责。
- 删除路径必须限制在 `uploads/materials/` 内。

## 学习项目与计划

### StudyProject

`StudyProject` 是长期学习项目，也是当前 Plan API 的核心持久化模型。

关键字段：

- `title`：计划标题。
- `subject`：学科或主题。
- `goal`：学习目标。
- `targetScore`、`startDate`、`deadline`、`dailyMinutes`：后续计划能力字段。
- `status`：`planning/active/completed/archived`。

Plan API 映射：

- `PlanItem` 是 `StudyProject` 的 API 视图。
- `PlanItem.status = draft` 映射到 `ProjectStatus.planning`。
- `PlanItem.materialIds` 通过 `ProjectMaterial` 表达。
- `PlanDay` 和 `PlanTask` 主要由 `StudyTask.day`、`StudyTask.type`、`StudyTask.status` 组成。

旧 Plan API 仍将 `StudyProject` 和 `StudyTask.day` 作为按天计划视图。新的阶段计划与每日学习单暂不接入该 API，后续通过独立 service 和接口逐步替换。

### StudyPlanVersion / PlanPhase

`StudyPlanVersion` 保存项目整体计划的版本历史。同一项目通过递增的 `version` 区分版本，状态为 `draft/confirmed/superseded`。

`PlanPhase` 表示计划中的阶段，保存阶段目标、说明、完成标准和顺序，不精确排期到具体日期。`PlanPhaseKnowledgeNode` 将阶段关联到现有 `KnowledgeNode`：

- 整体计划和技能树共用同一套知识点，不复制知识点内容。
- 同一知识点可以出现在多个阶段。
- `@@id([planPhaseId, knowledgeNodeId])` 禁止同一阶段重复引用同一知识点。
- `@@unique([planVersionId, order])` 保证同一计划版本内阶段顺序唯一。

### DailyTaskSheet

`DailyTaskSheet` 表示一个项目某一天生成并持久化的学习单。

- `localDate` 使用 `YYYY-MM-DD` 字符串，`timezone` 固定默认为 `Asia/Shanghai`。
- `@@unique([projectId, localDate])` 保证同项目同一天只存在一张学习单，页面刷新只能读取已有记录。
- 可选关联生成时使用的计划版本和当前阶段。
- `availableMinutes` 保存当天时间预算；`inputSnapshot` 保存生成依据快照。
- 状态为 `generating/active/awaiting_confirmation/completed/forced_closed/generation_failed`。
- `closesAt` 保存计划关闭时间，`endedAt` 和 `closeReason` 保存实际结束结果。

### ProjectMaterial

`ProjectMaterial` 是 `StudyProject` 与 `Material` 的多对多关系表。

约束：

- `@@id([projectId, materialId])` 防止同一项目重复引用同一资料。
- 删除项目会级联删除项目资料关联。
- 删除资料会级联删除项目资料关联。

### StudyTask

`StudyTask` 表示项目中的学习任务。

关键关系：

- 必须属于一个 `StudyProject`。
- 可选关联一个 `KnowledgeNode`。
- 可选关联一个 `Material`。
- 可选关联一个 `DailyTaskSheet` 和 `PlanPhase`。
- `carriedFromTaskId` 可追溯任务候选来源，但未完成任务是否续排由后续规则决定。
- `estimatedMinutes`、`sourceType`、`selectionReason` 和 `generationBatch` 保存每日编排结果。
- 可被 `Quiz`、`StudySession`、`SummarySuggestion` 引用。

API 映射：

- `PlanTask.materialId -> StudyTask.materialId`
- `PlanTask.skillId -> StudyTask.knowledgeNodeId`
- `PlanTask.type -> StudyTask.type`
- `PlanTask.status -> StudyTask.status`
- `PlanDay.day -> StudyTask.day`

兼容边界：现有任务不回填 `dailyTaskSheetId`，`day` 继续保留且可空。每日任务被重新生成替换时可标记为 `cancelled`，不删除历史记录。

删除 `Material` 或 `KnowledgeNode` 时，任务上的对应引用会置空，保留任务历史。

## 技能与知识点

### KnowledgeNode

`KnowledgeNode` 是项目内知识点，对应 Skills API 的 `SkillItem`。技能树真实属于 `StudyProject`，底层依赖结构是允许多个前置节点的 DAG；展示层级由 `parentId/order` 单独表达，不能替代业务依赖。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `projectId` | 所属项目 |
| `parentId` | 展示父节点，可空，只用于树形布局 |
| `title` | 知识点标题 |
| `description` | 描述 |
| `learningState` | 用户学习状态：`not_started`、`learning`、`mastered` |
| `isUnlocked` | 解锁资格；由系统控制，一旦取得不自动收回 |
| `unlockedAt` | 取得解锁资格的时间 |
| `archivedAt` | 非空表示节点已归档下线，默认 tree 查询不返回 |
| `selfMastery` | 用户自评信号 |
| `systemMastery` | 系统判断信号 |
| `confidence` | 系统判断置信度 |
| `mastery` | 确认后的对外掌握度 |
| `order` | 排序 |

状态与解锁规则：

- `learningState` 和 `isUnlocked` 是两个独立事实。
- `PATCH /api/skills/:id` 只允许改 `learningState`。
- 当一个节点实际变成 `mastered` 后，后端检查它的直接后续节点；若某个后续节点的所有直接前置都已 `mastered`，则写入 `isUnlocked=true` 和 `unlockedAt`。
- 上游节点从 `mastered` 回退成 `learning` 时，不回收后续节点的 `isUnlocked`。
- 前置风险不持久化到表中，由 `GET /api/skills/tree` 根据当前可见 DAG 实时派生。
- `selfMastery`、`systemMastery`、`confidence` 只是信号，不是当前 Skills PATCH 的权威状态。

### KnowledgeNodePrerequisite

`KnowledgeNodePrerequisite` 表示知识点前置依赖。`nodeId` 是被依赖约束的节点，`prerequisiteId` 是它的直接前置节点。

约束：

- `@@id([nodeId, prerequisiteId])` 防止重复依赖。
- service 必须禁止自依赖。
- service 必须确保依赖双方属于同一项目。
- `GET /api/skills/tree` 会对本次可见依赖图做环检测；发现环时返回 409，避免整链风险检查无法可靠结束。
- 归档节点是否参与依赖返回和风险计算，取决于 tree 查询的 `includeArchived` 参数。

## 测验与错题

### Quiz

`Quiz` 表示一次测验。

关键关系：

- 必须关联一个 `KnowledgeNode`。
- 可选关联 `StudySession`。
- 可选关联 `StudyTask`。
- 包含多个 `QuizQuestion`。

API 映射：

- `QuizItem.skillId -> Quiz.knowledgeNodeId`
- `QuizItem.studyTaskId -> Quiz.studyTaskId`
- `QuizItem.difficulty -> Quiz.difficulty`
- `QuizItem.materialId` 不是 Quiz 自身字段，而是从关联任务的 `materialId` 派生。

当前 Quiz 题目生成仍是 mock 规则，但 Quiz、Question、Option、Attempt 已可持久化。

### QuizQuestion / QuizOption / QuizAttempt

`QuizQuestion` 保存题干、答案、解析和题型。

- `single_choice` 题目的选项拆到 `QuizOption`。
- `short_answer` 不需要选项。
- `QuizAttempt` 保存用户答案、是否正确和答题时间。

提交测验时：

- 每道题写入 `QuizAttempt`。
- 答错题可创建或更新 `WrongbookItem`。
- 当前实现不会自动修改 `KnowledgeNode.mastery` 或 `learningState`。

### WrongbookItem

`WrongbookItem` 表示错题快照。

关键字段：

- `userId`：所属用户。
- `projectId`、`knowledgeNodeId`：可选学习上下文。
- `quizQuestionId`、`quizAttemptId`：可选测验来源。
- `questionType`、`questionPrompt`、`correctAnswer`、`explanation`：题目快照。
- `wrongAnswer`：错误答案。
- `subject`、`category`：当前作为字符串分类字段。
- `status`：`uncorrected/corrected`。
- `deletedAt`：手动软删除标记。

规则：

- 普通错题列表默认不返回 `deletedAt != null` 的记录。
- 同一用户对同一 `QuizQuestion` 重复答错时，应更新现有未删除错题，不新增重复错题。
- taxonomy 当前来自服务端常量，不是独立 Prisma 模型。

## 对话、学习会话与每日总结

### Conversation / Message

`Conversation` 保存自由答疑、建项对话和项目学习对话。

- 必须属于一个 `User`。
- 可选关联 `StudyProject`。
- `Message` 必须属于一个 `Conversation`。
- 删除 `Conversation` 会级联删除 `Message`。

当前 `POST /api/ai/chat` 的 chat context 仍主要来自 demo mock，不等于完整 Conversation 持久化链路已经接入。

### StudySession

`StudySession` 表示一次项目学习过程。

- 必须属于一个 `StudyProject`。
- 可选关联 `KnowledgeNode`、`StudyTask`、`Conversation`。
- 可关联多个 `Quiz`。
- 最多关联一个 `DailySummary`。

### DailySummary / SummarySuggestion

`DailySummary` 保存每日总结草稿和用户确认后的内容。

`SummarySuggestion` 保存 AI 提出的状态、薄弱点或复习建议，等待用户接受、修改或拒绝。

- 新总结可唯一关联一张 `DailyTaskSheet`；旧记录继续允许只关联 `StudySession`。
- 总结状态增加 `awaiting_confirmation`，表示存在尚未决策的建议。
- `confirmationSource` 区分用户确认、系统确认和零点强制确认。
- `SummarySuggestion.decisionSource` 区分用户决策与系统强制决策。

### WeakPoint / KnowledgeStateEvent

`WeakPoint` 是项目内已确认薄弱点，必须关联一个 `KnowledgeNode`。它保存严重度、状态、证据快照及确认来源；零点强制产生的记录使用 `system_forced`。

`KnowledgeStateEvent` 是知识点状态和掌握度变化的不可变审计记录，可关联每日学习单和总结建议。它只定义数据基础，本阶段不会自动写入事件。

当前 Memory API 仍使用内存 mock；`DailySummary` 和 `SummarySuggestion` 是后续真实长期记忆和学习闭环的数据基础。

## API 到 Prisma 映射

| API | Prisma |
| --- | --- |
| `MaterialItem.type` | `Material.category` |
| `MaterialItem.source` | `Material.origin` |
| `MaterialItem.status` | `Material.status` |
| `MaterialItem.folderId` | `Material.folderId` |
| `MaterialItem.sourceType` | `Material.sourceType` |
| `MaterialItem.originalFileName` | `Material.originalFileName` |
| `MaterialItem.storedFileName` | `Material.storedFileName` |
| `MaterialItem.storagePath` | `Material.storagePath` |
| `MaterialFolderItem` | `MaterialFolder` |
| `PlanItem` | `StudyProject` API view |
| `PlanItem.materialIds` | `ProjectMaterial` |
| `PlanTask` | `StudyTask` |
| 阶段计划 | `StudyPlanVersion` + `PlanPhase` + `PlanPhaseKnowledgeNode` |
| 每日学习单 | `DailyTaskSheet` + `StudyTask` |
| `SkillItem` | `KnowledgeNode` |
| `SkillItem.learningState` | `KnowledgeNode.learningState` |
| `SkillItem.isUnlocked` | `KnowledgeNode.isUnlocked` |
| `SkillItem.unlockedAt` | `KnowledgeNode.unlockedAt` |
| `SkillItem.archivedAt` | `KnowledgeNode.archivedAt` |
| `SkillItem.prerequisites` | `KnowledgeNodePrerequisite` |
| `SkillTreeResponse.dependencyEdges` | `KnowledgeNodePrerequisite` |
| `SkillTreeItem.prerequisiteRisk` | 由可见依赖图实时派生，不落库 |
| `SkillTreeItem.riskPrerequisiteIds` | 由可见依赖图实时派生，不落库 |
| `QuizItem` | `Quiz` |
| `QuizQuestion` | `QuizQuestion` + `QuizOption` |
| `SubmitQuizInput` | `QuizAttempt` |
| `WrongbookItem` | `WrongbookItem` |
| `MemoryItem` | 当前不落 Prisma，仍是内存 mock |

时间字段在 Prisma 中是 `DateTime`，返回 API 前统一转为 ISO 字符串。

## Service 必须校验的规则

Prisma 可以保证基础外键，但以下业务规则必须由 service 或 repository 查询辅助完成：

- 文件夹、资料、计划、技能、测验、错题必须校验 Demo 用户或 Demo project 归属。
- 跨用户文件夹不能被 Material 使用。
- 非空文件夹不能删除。
- `Material.folderId` 为字符串时，文件夹必须存在且属于当前用户。
- `ProjectMaterial.projectId` 对应项目的 `userId` 必须与 `Material.userId` 一致。
- `StudyTask.knowledgeNodeId` 如果存在，节点必须属于同一项目。
- `PlanPhaseKnowledgeNode` 两端必须经 service 校验属于同一项目。
- `DailyTaskSheet.planVersionId/currentPhaseId` 如果存在，必须属于同一项目且阶段属于该计划版本。
- `StudyTask.dailyTaskSheetId/planPhaseId` 如果存在，必须与任务所属项目一致。
- `WeakPoint` 和 `KnowledgeStateEvent` 的知识点必须属于记录对应项目。
- `KnowledgeNode.parentId` 只用于展示布局，不能代替 `KnowledgeNodePrerequisite` 业务依赖。
- `KnowledgeNodePrerequisite` 两端必须属于同一项目，且不能自依赖。
- `PATCH /api/skills/:id` 只能修改 `learningState`，不能由客户端直接修改解锁、布局、依赖或风险字段。
- `GET /api/skills/tree` 必须在本次可见依赖图上检测环，发现环时拒绝返回 tree。
- `Quiz.studyTaskId` 如果存在，任务必须属于同一项目并能确定知识点。
- `WrongbookItem` 的项目、知识点、题目、答题记录如果同时存在，必须指向同一学习链路。
- 上传文件的删除路径只能来自数据库记录，且必须限制在 `uploads/materials/`。
- `KnowledgeNode.selfMastery`、`systemMastery`、`mastery`、`confidence` 的数值范围应由 service 校验。
- AI 建议不能直接覆盖用户确认后的知识点状态和掌握度。

## 删除策略

Prisma schema 中的主要删除规则：

- 删除 `User` 会级联删除其 `MaterialFolder`、`Material`、`StudyProject`、`Conversation`、`WrongbookItem`、`DailySummary`。
- 删除 `MaterialFolder` 时，如果仍有 `Material` 指向它，`onDelete: Restrict` 会阻止删除。
- 删除 `StudyProject` 会级联删除 `ProjectMaterial`、`KnowledgeNode`、`StudyPlanVersion`、`DailyTaskSheet`、`StudyTask`、`StudySession`、`WeakPoint` 和 `KnowledgeStateEvent`。
- 删除计划版本会级联删除阶段和阶段知识点关联；每日学习单上的计划版本引用置空。
- 删除每日学习单时，历史任务、总结、薄弱点和状态事件上的引用置空。
- 已被阶段计划、薄弱点或状态事件引用的知识点不能硬删除，应通过 `archivedAt` 归档，避免破坏计划版本和审计历史。
- 删除 `StudyProject` 时，历史型 `Conversation`、`WrongbookItem`、`DailySummary` 的项目引用置空。
- 删除 `KnowledgeNode` 或 `StudyTask` 时，相关历史引用置空，保留学习历史。
- 删除 `Conversation` 会级联删除 `Message`。
- 删除 `Quiz` 会级联删除 `QuizQuestion`、`QuizOption`、`QuizAttempt`。
- 删除 `DailySummary` 会级联删除 `SummarySuggestion`。

文件删除规则：

- Prisma 不删除磁盘文件。
- 删除上传资料时，service 必须先删除磁盘文件，再删除数据库记录。
- 磁盘文件已经不存在时，可以继续删除数据库记录。
- 磁盘删除发生其他错误时，必须保留数据库记录。
- 文本、链接或旧资料没有文件元数据时，只删除数据库记录。
