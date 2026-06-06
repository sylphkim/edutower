# EduTower Data Model

本文记录 Prisma 数据模型的第一版边界，用于迁移前和后续 service 接入数据库时对齐语义。

## 核心模型关系

- `User` 拥有 `Material`、`StudyProject`、`Conversation`、`WrongbookItem` 和 `DailySummary`。
- `StudyProject` 是长期学习项目，一个项目拥有资料关联、知识树、学习任务、学习会话、错题和每日总结。
- `ProjectMaterial` 是 `StudyProject` 与 `Material` 的多对多关联表。同一项目不能重复引用同一资料。
- `KnowledgeNode` 是项目内知识点，必须属于一个项目，并通过 `parentId` 形成父子树。
- `StudyTask` 是项目内学习任务，必须属于项目，可选关联当前知识点。
- `Conversation` 保存自由答疑、建项对话和项目学习对话；自由答疑可以没有项目。
- `Message` 必须属于一个 `Conversation`，只保存 `user` 和 `assistant` 两类消息。
- `StudySession` 表示一次项目学习过程，必须属于项目，可选关联知识点、任务和对话。
- `Quiz` 必须关联一个 `KnowledgeNode`，一次 quiz 只针对当前知识点；多轮通过 `Quiz.round` 表示。
- `QuizQuestion` 只支持 `single_choice` 和 `short_answer`。选择题选项用 `QuizOption` 拆表保存，避免 JSON 大字段。
- `QuizAttempt` 保存用户答案、是否答对和作答时间，不再重复保存 round。
- `WrongbookItem` 保存错题快照。订正状态由 `status` 表示，手动软删除由 `deletedAt` 表示。
- `DailySummary` 保存 AI 草稿和用户确认后的今日内容。一个 `StudySession` 最多对应一份 `DailySummary`。
- `SummarySuggestion` 保存 AI 提出的状态、薄弱点和复习建议，等待用户逐项接受、修改或拒绝。

## 用户确认优先

- AI 可以写入 `SummarySuggestion`，提出 `proposedStatus`、`proposedMastery` 或文本建议。
- AI 建议不是正式状态更新。只有用户接受或修改后，service 才能更新 `KnowledgeNode.status`、`KnowledgeNode.mastery` 或相关任务状态。
- `KnowledgeNode.mastery` 是确认后的对外进度值，兼容现有 skills API 的 `mastery`。
- `KnowledgeNode.status` 是确认后的离散状态，兼容现有 skills API 的 `status`。
- `KnowledgeNode.selfMastery` 是用户自评信号，不是权威值。
- `KnowledgeNode.systemMastery` 是系统判断信号，不是权威值。
- `KnowledgeNode.confidence` 只表示系统判断的置信度，不单独决定状态。

## Service 必须校验的规则

Prisma 关系能保证基本外键，但以下跨项目、跨用户规则必须由 service 或 repository 校验：

- `ProjectMaterial.projectId` 对应项目的 `userId` 必须与 `Material.userId` 一致。
- `StudyTask.knowledgeNodeId` 如果存在，节点必须属于同一个 `StudyProject`。
- `StudySession.knowledgeNodeId` 和 `StudySession.studyTaskId` 如果存在，必须都属于该 session 的项目。
- `Conversation.projectId` 如果存在，项目必须属于同一个用户。
- `StudySession.conversationId` 如果存在，对话必须属于同一个用户，并且项目语义一致。
- `Quiz.studySessionId` 如果存在，session 项目必须与 quiz 的 `KnowledgeNode.projectId` 一致。
- `WrongbookItem.projectId`、`knowledgeNodeId`、`quizQuestionId`、`quizAttemptId` 同时存在时，必须指向同一学习链路。
- `DailySummary.userId`、`projectId`、`studySessionId` 同时存在时，必须属于同一个用户和项目。
- `SummarySuggestion.knowledgeNodeId` 或 `studyTaskId` 如果存在，必须与所属 `DailySummary` 的项目一致。
- `KnowledgeNode.selfMastery`、`systemMastery`、`mastery`、`confidence` 的数值范围应由 service 校验。
- `WrongbookItem.deletedAt != null` 的记录默认不应出现在普通错题列表中。

## 删除策略

- 删除 `User` 会级联删除该用户的项目、资料、对话、错题和每日总结。
- 删除 `StudyProject` 会级联删除项目内 `ProjectMaterial`、`KnowledgeNode`、`StudyTask` 和 `StudySession`。
- 删除 `StudyProject` 时，历史型 `Conversation`、`WrongbookItem`、`DailySummary` 的项目引用置空，保留历史内容。
- 删除 `KnowledgeNode` 或 `StudyTask` 时，`StudySession`、`WrongbookItem`、`SummarySuggestion` 的对应引用置空，保留学习历史。
- 删除 `Conversation` 会级联删除 `Message`。
- 删除 `Quiz` 会级联删除题目、选项和作答记录。
- 删除 `DailySummary` 会级联删除其 `SummarySuggestion`。

## 与现有 API 的主要映射

### Materials

- API `MaterialItem.type` 映射到 Prisma `Material.category`。
- API `MaterialItem.source` 映射到 Prisma `Material.origin`。
- API `MaterialItem.status` 映射到 Prisma `Material.status`。
- API `createdAt` 和 `updatedAt` 是字符串；Prisma 中是 `DateTime`，返回 API 前需要转 ISO 字符串。

### Plan

- API `PlanItem` 是学习计划视图，不等同于 `StudyProject`。
- API `PlanItem.status = draft` 可映射到 `ProjectStatus.planning`。
- API `PlanItem.materialIds` 映射到 `ProjectMaterial`。
- API `PlanDay.day` 映射到 `StudyTask.day`。
- API `PlanTask.type` 映射到 `StudyTask.type`。
- API `PlanTask.status` 映射到 `StudyTask.status`。
- API `PlanTask.skillId` 后续应映射到 `KnowledgeNode.id`。

### Skills

- API `SkillItem` 对应 Prisma `KnowledgeNode`。
- API `parentId` 映射到 `KnowledgeNode.parentId`。
- API `status` 映射到 `KnowledgeNode.status`。
- API `mastery` 映射到 `KnowledgeNode.mastery`。
- API `order` 映射到 `KnowledgeNode.order`。
- API `prerequisites` 当前 Prisma 未建模，后续如需要应增加单独关系表，不应塞入 JSON 字符串。

### Quiz

- API `QuizItem.difficulty` 映射到 `Quiz.difficulty`。
- API `QuizItem.skillId` 后续应映射到 `KnowledgeNode.id`。
- API `QuizQuestion.prompt`、`answer`、`explanation` 分别映射到 Prisma 同名字段。
- API `QuizQuestion.options` 映射到 `QuizOption` 多条记录。
- API submit 结果应写入 `QuizAttempt`，答错时可创建或更新 `WrongbookItem`。

### Wrongbook

- API `WrongbookItem.question` 映射到 Prisma 的题目快照字段。
- API `wrongAnswer` 映射到 `WrongbookItem.wrongAnswer`。
- API `reviewCount` 和 `lastReviewedAt` 映射到同名字段。
- 订正状态映射到 `WrongbookItem.status`。
- 手动删除映射到 `WrongbookItem.deletedAt`。
- API `subject` 和 `category` 当前是错题分类契约，Prisma 第一版尚未建分类表；接入数据库前需要决定是保留字符串字段还是建 taxonomy 模型。

### Memory 和 Daily Summary

- API `MemoryItem.type = daily_summary` 的记录可由 `DailySummary` 生成。
- API `DailySummaryInput.summary` 映射到 `DailySummary.aiDraft` 或用户确认后的 `confirmedContent`。
- API `weaknesses` 和 `nextSuggestions` 不应作为 JSON 大字段直接保存；需要进入 `DailySummary.weaknesses` 文本摘要或拆为 `SummarySuggestion`。
