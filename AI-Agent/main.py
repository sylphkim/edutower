# 导入 FastAPI 核心类，用于创建 Web 服务器
from fastapi import FastAPI, HTTPException
# 导入跨域中间件，解决前端同学在本机开发时无法访问你接口的报错问题
from fastapi.middleware.cors import CORSMiddleware 
# 导入静态文件托管模块，用于让浏览器能访问到 static 文件夹里的图片、CSS 和 JS
from fastapi.staticfiles import StaticFiles       
# 导入文件响应类，用于将 index.html 这个网页文件直接返回给浏览器
from fastapi.responses import FileResponse
# 导入 Pydantic 模型基类，用于规范和校验前端传过来的 JSON 数据格式
from pydantic import BaseModel                    

# 从 Module.module_agent 中导入编排好的智能体类
from Module.module_agent import ChatAgent
from Module.module_quiz_generator import generate_quiz
from Module.module_plan_generator import generate_plan_proposal
from Module.module_summary_generator import generate_summary


app = FastAPI()
# 实例化 Agent（当前使用模块内默认能力）
agent = ChatAgent()

# --- 2. 跨域补丁--- 
# 给你的服务器添加"通行证"配置
app.add_middleware( 
    CORSMiddleware, 
    # 允许所有来源的请求访问（期末演示和本地开发最省心的设置）
    allow_origins=["*"], 
    # 允许所有类型的 HTTP 方法（GET, POST 等）
    allow_methods=["*"], 
    # 允许所有的请求头（Header）
    allow_headers=["*"], 
) 

# --- 3. 数据契约：定义前后端沟通的"暗号" --- 
# 定义一个聊天请求的结构，前端必须按这个格式发数据，否则 FastAPI 会自动报错拦截
class ChatRequest(BaseModel):
    # 要求必须包含 session_id（字符串类型），用于区分不同用户的对话
    session_id: str
    # 要求必须包含 message（字符串类型），这就是用户输入的提问内容
    message: str
    # 可选：Express 后端传来的学习上下文（学生画像、知识图谱、错题等）
    context: dict | None = None

class GenerateQuizRequest(BaseModel):
    knowledge_title: str
    knowledge_description: str | None = None
    difficulty: str
    count: int

class GeneratePlanProposalRequest(BaseModel):
    goal: str | None = None
    skills: list[dict]
    dependency_edges: list[dict] | None = None

class GenerateSummaryProject(BaseModel):
    title: str
    subject: str
    goal: str

class GenerateSummaryRequest(BaseModel):
    project: GenerateSummaryProject
    date: str
    study_data: str
    conversation_excerpts: str | None = None

# --- 4. 路由逻辑：处理真正的聊天请求 ---
# 定义一个 POST 类型的接口，路径是 /chat
@app.post("/chat")
def chat(request: ChatRequest):
    try:
        reply = agent.run(request.session_id, request.message, context=request.context)
        return {"reply": reply}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

@app.post("/generate-quiz")
def generate_quiz_endpoint(request: GenerateQuizRequest):
    if request.difficulty not in ("pass", "high_score"):
        raise HTTPException(status_code=400, detail="difficulty must be pass or high_score")
    if request.count < 1 or request.count > 20:
        raise HTTPException(status_code=400, detail="count must be between 1 and 20")

    try:
        questions = generate_quiz(
            knowledge_title=request.knowledge_title,
            knowledge_description=request.knowledge_description,
            difficulty=request.difficulty,
            count=request.count,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"questions": questions}

@app.post("/generate-plan-proposal")
def generate_plan_proposal_endpoint(request: GeneratePlanProposalRequest):
    if not request.skills:
        raise HTTPException(status_code=400, detail="skills must be a non-empty array")

    try:
        proposal = generate_plan_proposal(
            goal=(request.goal or "").strip(),
            skills=request.skills,
            dependency_edges=request.dependency_edges or [],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"proposal": proposal}

@app.post("/generate-summary")
def generate_summary_endpoint(request: GenerateSummaryRequest):
    study_data = (request.study_data or "").strip()
    excerpts = (request.conversation_excerpts or "").strip()
    if not study_data and not excerpts:
        raise HTTPException(
            status_code=400,
            detail="study_data or conversation_excerpts is required",
        )

    try:
        summary = generate_summary(
            project={
                "title": request.project.title,
                "subject": request.project.subject,
                "goal": request.project.goal,
            },
            date=request.date,
            study_data=study_data,
            conversation_excerpts=excerpts or None,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"summary": summary}

# 将本地的 "static" 目录映射到链接的 "/static" 路径下
app.mount("/static", StaticFiles(directory="../static"), name="static") 

# 当用户直接访问网址根路径（比如 127.0.0.1:8000）时执行的操作
@app.get("/") 
def index(): 
    # 返回 static 文件夹内的 index.html 文件给用户查看
    return FileResponse("../static/index.html") 

# --- 运行脚本 ---
if __name__ == "__main__": 
    import uvicorn
    # 在本地 8000 端口启动程序，这就是你的后台运行地址
    uvicorn.run(app, host="127.0.0.1", port=8000)