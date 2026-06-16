# EduTower · AI 学习助手

EduTower 是一个**个人 AI 学习助手**：你给它一个学习目标，它帮你把目标拆成计划和技能树、每天生成学习任务、按难度出题、自动整理错题、跟踪薄弱点，并且**记住你**——在一个项目里学会的知识点，换个项目也会自动点亮。

## 它能帮你做什么

- **🗣️ 自由答疑** —— 随时提问，AI 结合科目、技能、资料片段、错题与记忆回答；聊到的重点可写入「学习记忆」。
- **🎯 多方向学习** —— 可同时管理多个学习方向（如高数、线代）；每个方向独立目标、计划、技能树与今日任务。
- **🤖 AI 设计计划** —— 填写目标、截止日期、每日可学时长后，Agent 生成阶段计划、技能节点与先修关系，并安装到当前方向。
- **📅 每日学习单** —— 每天按当前阶段与薄弱点生成任务（新知识点 / 复习 / 错题 / 薄弱点），做完即结。
- **📂 资料库** —— 上传 PDF、Word、图片或录入笔记；电子版 PDF / Word 自动抽文本，**扫描版 PDF 与图片走本地 OCR**（Tesseract，中英离线识别），供对话检索。
- **🌳 技能图谱** —— 树形列表 + 力导向图谱；先修关系与主题弱关联串联，掌握度、解锁与前置风险可视化。
- **📝 出题 & 错题本** —— 按知识点和难度 AI 出题，交卷自动判分，错题自动收录并可自定义分类。
- **📊 今日战况** —— 每天结束生成学习总结，确认后回写技能掌握度、薄弱点与记忆。
- **🔗 跨项目点亮** —— 在别处学会的概念，新项目里自动标记为已掌握并解锁后续节点。

## 快速开始

> EduTower 目前本地运行，需要同时启动 **Express（主服务）** 和 **FastAPI（AI 引擎）**，并配置一个大模型 API Key（OpenAI 兼容即可）。

**1. 装依赖**（需要 Node.js 与 Python 3）

```powershell
npm install                       # 主服务（postinstall 会尝试下载 OCR 语言包）

cd AI-Agent                       # AI 引擎
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

若扫描版 PDF OCR 提示缺少语言包，手动执行：

```powershell
npm run tessdata:fetch            # 下载 chi_sim + eng 到 data/tessdata/
```

**2. 配置** —— 复制示例配置；LLM 的 Key / 模型也可在页面「设置」里填写（会写入 `.env` 供 AI 引擎读取）。

```powershell
Copy-Item .env.example .env
```

可选 OCR 相关环境变量（见 `.env.example`）：

| 变量 | 默认 | 说明 |
|------|------|------|
| `OCR_ENABLED` | `true` | 设为 `false` 关闭扫描件 OCR |
| `OCR_PDF_MAX_PAGES` | `30` | 单份 PDF 最多 OCR 页数 |
| `OCR_PDF_SCALE` | `2` | 页面渲染倍率，扫描模糊时可调高 |

**3. 初始化数据库**

```powershell
npx prisma migrate dev
```

**4. 启动**（两个终端）

```powershell
cd AI-Agent; python main.py       # 终端 1：AI 引擎 (:8000)
npm run dev                        # 终端 2：主服务 (:3000)
```

打开 **http://localhost:3000** 开始使用。

### 建议体验路径

1. **学习计划** → 新建方向 → 填写目标与 DDL →「保存并 AI 设计计划」→ 启用今日学习  
2. **资料库** → 上传讲义 PDF（扫描版亦可）→ 确认已提取文本  
3. **AI 对话** → 提问并与今日任务联动；右侧可查看 Agent 状态、学习锦囊与任务清单  
4. **技能图谱** → 查看掌握度与先修关系  
5. **练习测验** → 生成题目 → 交卷后检查错题本  

## 技术栈

- **前端**：原生 JS / HTML（`static/`）
- **主服务**：Express + TypeScript + Prisma（SQLite）
- **AI 引擎**：FastAPI + 你配置的 LLM
- **文档 OCR**：Tesseract.js + pdf-to-img（离线，无需云 OCR）
- **架构**：前端 → Express（产品逻辑与数据）→ FastAPI（Agent / LLM）。Express 不直接调大模型，所有 AI 能力经 AI 引擎转发。

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Express 开发服务 |
| `npm run build` | 编译 TypeScript |
| `npm run tessdata:fetch` | 下载离线 OCR 语言包 |
| `npm run seed:skills` | 写入演示技能树种子数据 |

---

> 给 AI agent / 贡献者：接口契约见 [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)；数据模型以 `prisma/schema.prisma` 为准。
