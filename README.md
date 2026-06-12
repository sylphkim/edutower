# EduTower

EduTower 是一个 AI 学习助手后端项目。当前仓库主要包含两部分：

- Express 主后端：面向前端提供产品 API、统一响应、资料库数据读写、文件上传和 AI Engine bridge。
- FastAPI AI Engine：位于 `AI-Agent/`，负责接收 Express 转发的聊天请求，并调用 Agent/LLM 生成回复。

```text
Frontend / static
-> Express API
-> FastAPI AI Engine
-> LLM Provider
```

## 当前进度

已经完成到：

- Express + TypeScript 基础后端。
- Prisma + SQLite 本地数据库。
- Demo 用户自动创建。
- 资料库 Material 的 CRUD。
- 资料文件夹模块的 repository/service/controller/routes。
- 资料支持 `folderId`，可查询全部、指定文件夹、未分类。
- 单文件上传：支持 `.pdf`、`.doc`、`.docx`、`.jpg`、`.jpeg`、`.png`，最大 20 MB。
- 上传文件元数据写入数据库。
- 上传失败时自动清理已落盘文件。
- 删除上传资料时先删磁盘文件，再删数据库记录。
- 删除文本或链接资料时只删数据库记录。
- AI 聊天接口由 Express 转发到 FastAPI AI Engine。
- 技能树已接 SQLite：节点、DAG 前置依赖、学习状态、解锁资格和归档字段都持久化。
- `GET /api/skills/tree` 返回项目内稳定技能结构、依赖边、学习状态、解锁状态和前置风险。
- `PATCH /api/skills/:id` 已收窄为学习状态修改入口，后端负责自动解锁直接后续节点。
- 已提供二次函数 demo 技能树 seed，可用于本地联调和规则验证。
- 整体计划（阶段计划）已持久化：版本历史、草稿编辑、确认与修订，整体计划和技能树共用同一套知识点。
- `POST /api/plan/:projectId/proposals/apply` 可接收 AI Engine 的结构化提案，单事务初始化知识树和版本 1 计划。
- 每日学习单（`/api/daily`）闭环：进入项目幂等生成今日任务并持久化，刷新只读取；系统规则限定候选（续排/薄弱点/错题/进行中/当前阶段新知识点），AI 只在候选内排序取舍并解释，失败回退规则。
- 任务状态流转、用户重排未完成任务；任务全部完成、用户主动结束或 24:00 零点都会结束当天学习。
- 结束当天生成总结草稿与待确认建议；建议确认后回写技能树（复用自动解锁）、薄弱点和状态事件；零点由系统直接判定并保留判断依据。
- 测验（`/api/quiz`）AI 出题闭环：按知识点经 FastAPI AI Engine 出单选题（前端→Express→FastAPI→LLM），FastAPI 不可用时 Express 兜底内置 mock；交卷由服务端判分，错题写入 `WrongbookItem` 持久化；取测验响应不下发正确答案，避免交卷前泄题。

仍未完成或后续继续做：

- 登录鉴权与真实多用户隔离。
- 文件解析、OCR、RAG、向量数据库。
- 上传文件的静态访问或下载接口。
- 聊天对话持久化到 `Conversation`（当天学习记录的子对话目前为空）。
- Memory 仍是内存 mock；AI Engine 侧的整体计划提案生成链路。
- Quiz 出题暂基于知识点标题/说明（未接资料 chunks/RAG）；FastAPI 侧 `/generate-quiz` 端点待补，建好前 Express 出题走 mock 兜底。
- 技能节点删除策略还未切换为“有历史学习记录则归档”；数据模型已有 `archivedAt`，tree 查询默认隐藏归档节点。
- 完整自动化测试套件。

## 安装依赖

安装 Node.js 依赖：

```bash
npm install
```

Windows PowerShell 如果遇到执行策略问题，可以使用：

```powershell
npm.cmd install
```

安装 FastAPI AI Engine 依赖：

```bash
cd AI-Agent
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

macOS / Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

## 配置 `.env`

复制示例文件：

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

建议 `.env` 至少包含：

```env
PORT=3000

DATABASE_URL="file:./dev.db"

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

- `DATABASE_URL` 指向本地 SQLite 数据库。
- `AI_ENGINE_BASE_URL` 是 Express 调用 FastAPI AI Engine 的地址。
- `LLM_*` 用于 AI Engine 或底层 LLM 调试能力。
- 不要提交 `.env`。

## 启动 Express

开发模式：

```bash
npm run dev
```

Windows PowerShell:

```powershell
npm.cmd run dev
```

默认地址：

```text
http://localhost:3000
```

构建与生产启动：

```bash
npm run build
npm start
```

Windows PowerShell:

```powershell
npm.cmd run build
npm.cmd start
```

## 启动 FastAPI AI Engine

进入 AI Engine 目录并启动：

```bash
cd AI-Agent
python main.py
```

默认地址：

```text
http://127.0.0.1:8000
```

Express 会通过 `AI_ENGINE_BASE_URL` 调用 AI Engine 的 `/chat`。

## 初始化技能树 Seed

本地联调技能树前，先确保 Prisma migration 已应用并生成 client：

```powershell
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd prisma migrate dev
```

写入可测试的 demo 技能树：

```powershell
npm.cmd run seed:skills
```

seed 会在 `demo-project` 下写入 10 个“高中数学二次函数”技能节点和 12 条前置依赖边。它体现“展示为树、依赖为 DAG”的结构：`parentId/order` 只负责展示布局，真实业务依赖来自 `KnowledgeNodePrerequisite`。

## 主要接口

统一响应格式：

```json
{
  "ok": true,
  "data": {}
}
```

主要 Express 接口：

| 模块 | 接口 |
| --- | --- |
| Health | `GET /api/health` |
| AI Chat | `POST /api/ai/chat` |
| Legacy Chat | `POST /chat` |
| LLM Debug | `POST /api/llm/chat`, `POST /api/llm/generate` |
| Materials | `GET /api/materials`, `GET /api/materials/:id` |
| Materials | `POST /api/materials`, `PATCH /api/materials/:id`, `DELETE /api/materials/:id` |
| Upload | `POST /api/materials/upload` |
| Plan | `GET /api/plan`, `POST /api/plan`, `PATCH /api/plan/:id`, `DELETE /api/plan/:id` |
| Plan Versions | `GET/POST /api/plan/:projectId/versions`, `PATCH /api/plan/:projectId/versions/:versionId`, `POST .../confirm`, `POST .../revise`, `POST /api/plan/:projectId/proposals/apply` |
| Daily | `GET/POST /api/daily/:projectId/today`, `POST .../today/regenerate`, `POST .../today/close`, `GET /api/daily/:projectId/sheets`, `PATCH /api/daily/:projectId/tasks/:taskId`, `POST /api/daily/:projectId/summaries/:summaryId/decisions` |
| Skills | `GET /api/skills`, `GET /api/skills/tree`, `POST /api/skills`, `PATCH /api/skills/:id`, `DELETE /api/skills/:id` |
| Quiz | `GET /api/quiz`, `GET /api/quiz/:id`, `POST /api/quiz`, `POST /api/quiz/:id/submit`, `DELETE /api/quiz/:id` |
| Wrongbook | `GET /api/wrongbook`, `POST /api/wrongbook`, `PATCH /api/wrongbook/:id`, `DELETE /api/wrongbook/:id` |
| Memory | `GET /api/memory`, `POST /api/memory`, `POST /api/memory/daily-summary` |

技能树对接重点：

```text
GET /api/skills/tree?projectId=demo-project
GET /api/skills/tree?projectId=demo-project&includeArchived=true
PATCH /api/skills/:id?projectId=demo-project
```

- `GET /api/skills/tree` 返回 `items` 和 `dependencyEdges`。`items` 是展示树，`dependencyEdges` 是真实 DAG 依赖边。
- `PATCH /api/skills/:id` 请求体只允许 `{ "learningState": "not_started" | "learning" | "mastered" }`。
- 客户端不能直接修改 `isUnlocked`、`prerequisites`、`parentId`、`prerequisiteRisk` 或 `riskPrerequisiteIds`。
- 节点变成 `mastered` 后，后端会在同一业务操作中自动解锁满足条件的直接后续节点。
- 上游从 `mastered` 回退成 `learning` 后，后续节点不会重新锁定；`GET tree` 会通过 `prerequisiteRisk` 和 `riskPrerequisiteIds` 提示风险。
- 详细契约见 `docs/API_CONTRACT.md`，技能树专项说明见 `docs/SKILL_TREE.md`。

资料列表支持：

```text
GET /api/materials
GET /api/materials?folderId=<folderId>
GET /api/materials?folderId=unclassified
```

上传接口使用 `multipart/form-data`：

```text
POST /api/materials/upload
field: file
optional field: folderId
```

FastAPI AI Engine 接口：

| 接口 | 说明 |
| --- | --- |
| `POST /chat` | 接收 `session_id`、`message`、可选 `context`，返回 AI 回复 |
| `GET /` | 返回静态首页 |

## 当前最小验收目标

当前最小验收目标是保证两条主链路稳定：

```text
资料上传
-> 文件保存到 uploads/materials/
-> 数据库创建 Material 记录
-> 删除资料时磁盘文件和数据库记录成对删除
```

```text
前端或调试工具发送学习问题
-> POST /api/ai/chat
-> Express 组装 demo context
-> Express 调用 FastAPI /chat
-> 返回统一格式的 AI 回复
```

```text
进入项目
-> POST /api/daily/:projectId/today 幂等生成今日任务
-> PATCH 任务状态，全部完成自动结束（或 POST close / 零点强制结束）
-> 总结建议 accept/modify/reject
-> 技能树、薄弱点、状态事件回写
```

验收时至少确认：

- `npm.cmd run build` 通过。
- `GET /api/health` 返回正常。
- 上传成功后磁盘文件和数据库记录都存在。
- 上传失败后不留下孤立文件。
- 删除上传资料后磁盘文件和数据库记录都消失。
- 删除文本或链接资料不会误删文件。
- `POST /api/ai/chat` 能拿到 AI Engine 返回的回复，或在 AI Engine 不可用时走现有降级逻辑。
- 重复 `POST /api/daily/:projectId/today` 返回同一张学习单（200），不重新生成。
- 未配置 `LLM_API_KEY` 时每日任务仍可生成（规则排序兜底）。
- 最后一个任务 `done` 后响应 `autoClosed=true` 并附总结与建议。
- 建议确认后 `KnowledgeNode` 状态/掌握度更新，`KnowledgeStateEvent` 留有证据快照。
