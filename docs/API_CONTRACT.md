# EduTower API 契约

给 agent / 前端 / FastAPI 同学的接口事实源。三层:**前端 → Express(唯一产品 API)→ FastAPI(AI 引擎)→ LLM**。前端只调 Express;Express 不直连 LLM,所有 AI 能力转发 FastAPI,FastAPI 不可用走确定性兜底。

统一响应:成功 `{ "ok": true, "data": ... }`;失败 `{ "ok": false, "error": { "code", "message" } }`(由 `AppError` 统一转换)。

## Express 端点(全部挂在 `src/app.ts`)

> 状态:✅ 真闭环 · 🟡 依赖 FastAPI,缺端点时兜底(mock/模板)· 🆕 近期新增

| 模块 | 端点 | 说明 |
|---|---|---|
| Health | `GET /api/health` | 健康检查 + DB 状态 |
| 聊天 | `POST /api/ai/chat` | 入 `{session_id, message, conversationId?}`;转发 FastAPI `/chat`,问答落 `Message` ✅ |
| 对话 | `POST /api/conversations` · `GET /api/conversations/:id` · `POST /api/conversations/:id/summarize` | 显式建子对话;结束可总结写记忆 🟡(总结走 FastAPI/模板) |
| 项目设置 | `GET /api/projects/current` · `PATCH /api/projects/current` | 读写 目标/目标分/DDL/开始日/每日时长 + 目标确认(`goalConfirmed`)🆕 |
| 计划 | `GET/POST/PATCH/DELETE /api/plan[/:id]` | 旧版 day-based 计划 CRUD(= 项目) |
| 计划版本 | `GET /api/plan/:projectId/versions[/current|/:versionId]` · `POST .../versions` · `PATCH .../:versionId` · `POST .../:versionId/confirm` · `POST .../:versionId/revise` | 版本化阶段计划 |
| 计划提案 | `POST /api/plan/:projectId/proposals/generate` 🆕🟡 · `POST .../proposals/apply` | generate=AI 起草草稿(转 FastAPI `/generate-plan`,过 normalize,**不落库**);apply=落库初始化技能树+版本1 |
| 技能树 | `GET /api/skills/tree` · `GET /api/skills[/:id]` · `POST /api/skills` · `PATCH /api/skills/:id` · `DELETE /api/skills/:id` | 见下「技能树规则」 |
| 每日 | `GET/POST /api/daily/:projectId/today` · `POST .../today/regenerate` · `POST .../today/close` · `GET /api/daily/:projectId/sheets` · `PATCH /api/daily/:projectId/tasks/:taskId` · `POST /api/daily/:projectId/summaries/:summaryId/decisions` | 今日学习单闭环;AI 排序/总结 🟡 |
| 测验 | `GET /api/quiz[/:id]` · `POST /api/quiz` · `POST /api/quiz/:id/submit` · `DELETE /api/quiz/:id` | 出题 🟡(FastAPI 缺 `/generate-quiz` → mock);交卷判分、错题入库 ✅;取测验不下发答案 |
| 错题本 | `GET /api/wrongbook[/:id]` · `POST/PATCH/DELETE /api/wrongbook[/:id]` · `POST/DELETE /api/wrongbook/subjects[/:id]` · `POST/DELETE /api/wrongbook/categories[/:id]` | 错题 + 学科/错因分类 ✅ |
| 记忆 | `GET /api/memory[/:id]` · `POST/PATCH/DELETE /api/memory[/:id]` · `POST /api/memory/daily-summary` · `POST /api/memory/summarize` | 记忆 CRUD + 同类去重摘要 ✅ |
| 概念图谱 | `GET /api/concepts` | 跨项目概念 + 掌握度(不进项目也可见)✅ |
| 资料 | `GET /api/materials[/:id]` · `POST /api/materials` · `POST /api/materials/upload` · `GET /api/materials/:id/download` · `PATCH/DELETE /api/materials/:id` · `GET/POST/PATCH/DELETE /api/material-folders[/:id]` | 资料库 + 文件夹 + 上传/下载 ✅ |
| 智能体面板 | `GET /api/agent/panel` | 基于项目真实数据的面板 |
| 设置 | `GET /api/settings/llm/status` · `POST /api/settings/llm` · `POST /api/settings/llm/test` | 配 LLM(写根 `.env` 供 FastAPI 读)+ 探活 ✅ |

## 技能树规则(消费方必须知道)

- `learningState`(`not_started|learning|mastered`)与 `isUnlocked`(系统控制,取得后不因上游回退收回)**分离**。
- `PATCH /api/skills/:id` **只接受** `{ learningState }`;客户端**不能**改 `isUnlocked / prerequisites / parentId / mastery / order / prerequisiteRisk / riskPrerequisiteIds`。锁定节点改状态返回 409。
- 节点转 `mastered` 后,后端**同一事务**自动解锁满足条件的直接后续节点,并同步跨项目概念账本(`recordNodeMastery`)。
- `GET /tree` 返回展示树 `items`(`parentId/order` 仅布局)+ 真实 DAG `dependencyEdges`;`prerequisiteRisk`/`riskPrerequisiteIds` **派生不持久化**;依赖图有环返回 409。

## 计划生成 → 应用流程

`POST /proposals/generate`(AI 起草草稿,未落库)→ 前端载入技能树编辑器预览/微调 → `POST /proposals/apply`(落库)。手搓 proposal 同样走 apply。两者共用 `normalizePlanProposal` 校验(节点 key 唯一、每节点至少进一个 phase、引用合法、无环、先修顺序)。

## FastAPI 契约(`AI-Agent/`)

Express 请求走 snake_case。**目前只有 `/chat` 实现了**,其余缺失时 Express 兜底(出题退 mock、总结退模板、生成计划返回 502「AI 暂不可用」)。

| 端点 | 状态 | 请求 | 响应 |
|---|---|---|---|
| `POST /chat` | ✅ 已实现 | `{ session_id, message, context? }` | `{ reply }` |
| `POST /generate-quiz` | ❌ 待补 | `{ knowledge_title, knowledge_description, difficulty, count }` | `{ questions: [{ prompt, options[], answer, explanation }] }` |
| `POST /generate-summary` | ❌ 待补 | `{ project:{title,subject,goal}, date, study_data, conversation_excerpts }` | `{ summary }` |
| `POST /generate-plan` | ❌ 待补 | `{ project:{title,subject,goal,target_score,deadline,daily_minutes}, materials:[{title,summary}], mastered_concepts:[{name,subject}] }` | **camelCase** `{ nodes:[{key,title,description?,parentKey?}], prerequisiteEdges:[{prerequisiteKey,nodeKey}], phases:[{title,goal,description?,completionCriteria?,nodeKeys:[]}] }`,须过 normalize |

`/chat` 的 `context`(Express 组装)形状:`{ subject:{name,learningGoal}, materials:[{title,summary}], knowledgePoints:[{title,mastery}], weakPoints:[{title,reason,suggestedAction}], sessionHistory, memories }`。
