# 导入 FastAPI 核心类，用于创建 Web 服务器
from fastapi import FastAPI
# 导入跨域中间件，解决前端同学在本机开发时无法访问你接口的报错问题
from fastapi.middleware.cors import CORSMiddleware 
# 导入静态文件托管模块，用于让浏览器能访问到 static 文件夹里的图片、CSS 和 JS
from fastapi.staticfiles import StaticFiles       
# 导入文件响应类，用于将 index.html 这个网页文件直接返回给浏览器
from fastapi.responses import FileResponse
# 导入 Pydantic 模型基类，用于规范和校验前端传过来的 JSON 数据格式
from pydantic import BaseModel                    

# 从协作同学 B 写的 agent.py 中导入编排好的智能体类
from agent import ChatAgent


app = FastAPI() 
# 实例化 Agent，它会自动通过 api_manager 调取共享的 DeepSeek V4 Pro API
agent = ChatAgent() 

# --- 2. 跨域补丁--- 
# 给你的服务器添加“通行证”配置
app.add_middleware( 
    CORSMiddleware, 
    # 允许所有来源的请求访问（期末演示和本地开发最省心的设置）
    allow_origins=["*"], 
    # 允许所有类型的 HTTP 方法（GET, POST 等）
    allow_methods=["*"], 
    # 允许所有的请求头（Header）
    allow_headers=["*"], 
) 

# --- 3. 数据契约：定义前后端沟通的“暗号” --- 
# 定义一个聊天请求的结构，前端必须按这个格式发数据，否则 FastAPI 会自动报错拦截
class ChatRequest(BaseModel): 
    # 要求必须包含 session_id（字符串类型），用于区分不同用户的对话
    session_id: str
    # 要求必须包含 message（字符串类型），这就是用户输入的提问内容
    message: str

# --- 4. 路由逻辑：处理真正的聊天请求 ---
# 定义一个 POST 类型的接口，路径是 /chat
@app.post("/chat") 
def chat(request: ChatRequest): 
    # 调用 agent 实例的 process 方法，把前端传来的 ID 和消息丢给它处理
    # 这一步会触发 DeepSeek 的 API 请求并返回结果
    reply = agent.process(request.session_id, request.message) 
    # 将 AI 的回复封装成 JSON 格式返回给前端显示
    return {"reply": reply} 
 
# 将本地的 "static" 目录映射到链接的 "/static" 路径下
app.mount("/static", StaticFiles(directory="static"), name="static") 

# 当用户直接访问网址根路径（比如 127.0.0.1:8000）时执行的操作
@app.get("/") 
def index(): 
    # 返回 static 文件夹内的 index.html 文件给用户查看
    return FileResponse("static/index.html") 

# --- 运行脚本 ---
if __name__ == "__main__": 
    import uvicorn
    # 在本地 8000 端口启动程序，这就是你的后台运行地址
    uvicorn.run(app, host="127.0.0.1", port=8000)