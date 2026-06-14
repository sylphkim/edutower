# EduTower · AI 学习助手

EduTower 是一个**个人 AI 学习助手**:你给它一个学习目标,它帮你把目标拆成计划和技能树、每天生成学习任务、按难度出题、自动整理错题、跟踪薄弱点,并且**记住你**——在一个项目里学会的知识点,换个项目也会自动点亮。

## 它能帮你做什么

- **🗣️ 自由答疑** —— 随时提问,AI 结合你的学习上下文回答;聊到的重点会被记进"记忆"。
- **🎯 项目模式** —— 填上目标、截止日期、目标分、每天可学时长,生成阶段计划 + 技能树。
- **📅 每日学习单** —— 每天自动给出今日任务(新知识点 / 复习 / 错题 / 薄弱点),做完即结。
- **📝 出题 & 错题本** —— 按知识点和难度出题,交卷自动判分,做错的题自动进错题本。
- **📊 今日战况** —— 每天结束生成学习总结,确认后回写技能树掌握度、薄弱点和记忆。
- **🌳 跨项目点亮** —— 在别处学会的概念,新项目里自动标记为已掌握并解锁后续节点。

## 快速开始

> EduTower 目前本地运行,需要同时启动 **Express(主服务)** 和 **FastAPI(AI 引擎)**,并配置一个你自己的大模型 API Key(OpenAI 兼容即可)。

**1. 装依赖**(需要 Node.js 与 Python 3)

```powershell
npm install                       # 主服务

cd AI-Agent                       # AI 引擎
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

**2. 配置**——复制示例配置;LLM 的 Key/模型也可以启动后在页面「设置」里填(会写进 `.env` 给 AI 引擎读取)。

```powershell
Copy-Item .env.example .env
```

**3. 初始化数据库**

```powershell
npx prisma migrate dev
```

**4. 启动**(两个终端)

```powershell
cd AI-Agent; python main.py       # 终端 1:AI 引擎(:8000)
npm run dev                        # 终端 2:主服务(:3000)
```

打开 **http://localhost:3000** 开始使用。

## 技术栈

- **前端**:原生 JS / HTML(`static/`)
- **主服务**:Express + TypeScript + Prisma(SQLite)
- **AI 引擎**:FastAPI + 你配置的 LLM
- **架构**:前端 → Express(产品逻辑与数据)→ FastAPI(Agent / LLM)。Express 不直接调大模型,所有 AI 能力都经 AI 引擎。

---

> 给 AI agent / 贡献者:接口契约见 [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md);数据模型以 `prisma/schema.prisma` 为准。
