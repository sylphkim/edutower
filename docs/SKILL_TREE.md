# 技能树后端对接说明

本文档说明 Express 后端当前已经落地的技能树能力。前端和 FastAPI AI Engine 不直接读写技能树数据库，统一通过 Express API 对接。

## 当前能力

- 技能树属于学习项目，当前接口支持 `projectId` query；不传时使用 demo project。
- 节点持久化在 `KnowledgeNode`，依赖边持久化在 `KnowledgeNodePrerequisite`。
- 真实依赖是 DAG，一个节点可以有多个直接前置节点。
- `parentId/order` 只用于展示布局，不代表业务依赖。
- 学习状态和解锁资格分离：
  - `learningState`: `not_started | learning | mastered`
  - `isUnlocked`: 系统控制，一旦取得不会因为上游回退而自动收回
- 节点实际变成 `mastered` 后，后端检查它的直接后续节点；如果某个后续节点的所有直接前置都已 `mastered`，后端自动写入 `isUnlocked=true` 和 `unlockedAt`。
- 上游从 `mastered` 回退到 `learning` 后，后续节点不重新锁定；`GET /api/skills/tree` 会沿整条可见上游依赖链派生前置风险。
- tree 查询会检测本次可见依赖图是否存在环；发现环时返回 409。

## 本地准备

应用 Prisma migration 并生成 client：

```powershell
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd prisma migrate dev
```

写入可测试的 demo 技能树：

```powershell
npm.cmd run seed:skills
```

seed 会在 `demo-project` 下写入 10 个“高中数学二次函数”节点和 12 条前置依赖边。重复执行会覆盖固定 seed 节点和这些节点作为 `nodeId` 的前置边，不会改非 seed 节点。

## API 对接

### 查询技能树

```text
GET /api/skills/tree?projectId=demo-project
GET /api/skills/tree?projectId=demo-project&includeArchived=true
```

响应结构：

```json
{
  "ok": true,
  "data": {
    "items": [],
    "dependencyEdges": []
  }
}
```

`items` 是展示树。每个节点包含：

```json
{
  "id": "skill-id",
  "title": "技能名称",
  "description": "可选描述",
  "parentId": "parent-skill-id",
  "prerequisites": ["direct-prerequisite-id"],
  "learningState": "not_started",
  "isUnlocked": false,
  "mastery": 0,
  "order": 1,
  "createdAt": "2026-06-10T00:00:00.000Z",
  "updatedAt": "2026-06-10T00:00:00.000Z",
  "prerequisiteRisk": false,
  "riskPrerequisiteIds": [],
  "children": []
}
```

`dependencyEdges` 是真实依赖边：

```json
{
  "sourceId": "prerequisite-skill-id",
  "targetId": "dependent-skill-id"
}
```

注意：

- `sourceId` 是前置节点 id，`targetId` 是依赖该前置的节点 id。
- `description`、`parentId`、`unlockedAt`、`archivedAt` 无值时可能不出现在 JSON 中。
- 默认隐藏 `archivedAt != null` 的归档节点。
- `includeArchived=true` 时归档节点进入本次可见集合，依赖边和风险计算也会包含它们。
- 如果活跃节点的 `parentId` 指向被隐藏的归档节点，展示树中会把它提升为根，但节点自身 `parentId` 原值不改。
- 依赖图存在环时返回：

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Skill dependency graph contains a cycle."
  }
}
```

HTTP status 为 409。

### 修改学习状态

```text
PATCH /api/skills/:id?projectId=demo-project
```

请求体只能包含一个字段：

```json
{
  "learningState": "learning"
}
```

允许值：

```text
not_started | learning | mastered
```

规则：

- 客户端不能直接修改 `isUnlocked`、`unlockedAt`、`prerequisites`、`parentId`、`mastery`、`order`、`prerequisiteRisk` 或 `riskPrerequisiteIds`。
- 非法字段返回 400。
- 节点不存在或不属于该 `projectId` 返回 404。
- 归档节点返回 409。
- 锁定节点只能提交当前状态作为幂等 no-op；改成其他状态返回 409。
- 解锁节点允许三态互转，包括 `mastered -> learning`。
- 成功响应仍是单个 `SkillItem`，不会额外返回自动解锁列表。

自动解锁发生在同一个业务操作中：

```text
PATCH 前置节点为 mastered
-> 后端检查它的直接后续节点
-> 所有直接前置都 mastered 的活跃后续节点自动解锁
-> 下次 GET tree 立即读到新 isUnlocked/unlockedAt
```

## 风险提示

风险只在 `GET /api/skills/tree` 中派生，不持久化。

- 只给 `isUnlocked=true` 的可见节点计算风险。
- 沿整条可见上游依赖链检查。
- 任一可见上游祖先 `learningState !== "mastered"` 时，当前节点返回 `prerequisiteRisk=true`。
- `riskPrerequisiteIds` 返回所有未 `mastered` 的可见上游祖先 id，稳定排序。
- 上游重新全部 `mastered` 后，风险自然消失。

## 当前边界

- `GET /api/skills`、`GET /api/skills/:id`、`POST /api/skills`、`DELETE /api/skills/:id` 仍主要面向 demo project，结构管理还不是完整产品化接口。
- `DELETE /api/skills/:id` 当前仍是硬删除；后续需要改成“有历史学习记录则归档”。
- 手动解锁的单独接口尚未实现。
- AI Engine 不参与技能树规则判断；后续如需 AI 使用技能树上下文，应由 Express 从 SQLite 读取并组装上下文。

## 快速验收

```powershell
npm.cmd run build
npm.cmd run seed:skills
```

建议验证：

- `GET /api/skills/tree?projectId=demo-project` 默认返回 9 个活跃 seed 节点，不包含归档节点。
- `GET /api/skills/tree?projectId=demo-project&includeArchived=true` 返回 10 个 seed 节点。
- PATCH `seed-skill-quadratic-standard-form` 为 `mastered` 后，`seed-skill-quadratic-vertex-form` 自动解锁。
- 再 PATCH `seed-skill-quadratic-graph-opening` 为 `mastered` 后，`seed-skill-quadratic-roots` 自动解锁。
- 将上游从 `mastered` 回退为 `learning` 后，后续节点保持解锁，tree 返回前置风险。
