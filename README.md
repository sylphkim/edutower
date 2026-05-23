# AI Learning Assistant Backend

AI 学习助手后端项目第一阶段：提供 Node.js + TypeScript + Express 的基础后端结构，并完成通用大模型 API 接入底座。

## 当前阶段范围

- 基础 Express 服务
- 统一环境变量配置
- 通用 LLM 调用服务
- 健康检查接口
- 简单 LLM 连通性测试接口
- 通用文本生成接口
- 统一响应格式和错误处理

## 当前不包含

本阶段不实现资料上传、RAG、向量数据库、知识点生成、技能树、小测验、错题本、答案批改、学习计划、每日总结、长期记忆、业务 JSON Schema、复杂 prompt 模板管理、前端页面、用户登录和数据库。

## 安装依赖

```bash
npm install
```

## 配置环境变量

复制示例文件：

```bash
cp .env.example .env
```

然后填写：

```env
PORT=3000
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=
LLM_TIMEOUT_MS=30000
LLM_MAX_OUTPUT_TOKENS=1000
```

说明：

- `OPENAI_API_KEY` 必须从环境变量读取，不能写死在代码里。
- `OPENAI_MODEL` 不填写时默认使用 `gpt-4.1-mini`。
- `OPENAI_BASE_URL` 可选，用于兼容 OpenAI-compatible 服务。
- `LLM_TIMEOUT_MS` 默认 `30000`。
- `LLM_MAX_OUTPUT_TOKENS` 默认 `1000`。

未配置 `OPENAI_API_KEY` 时，服务可以启动，但调用 LLM 接口会返回明确错误。

## 启动开发服务器

```bash
npm run dev
```

默认地址：

```text
http://localhost:3000
```

## 构建和生产启动

```bash
npm run build
npm start
```

## 接口测试

### 健康检查

```bash
curl http://localhost:3000/api/health
```

示例返回：

```json
{
  "ok": true,
  "data": {
    "status": "ok"
  }
}
```

### 简单聊天测试

```bash
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"请解释导数的定义\"}"
```

### 通用生成

```bash
curl -X POST http://localhost:3000/api/llm/generate \
  -H "Content-Type: application/json" \
  -d "{\"systemPrompt\":\"你是一个学习助手。\",\"userPrompt\":\"请用简单语言解释导数。\",\"temperature\":0.7,\"maxOutputTokens\":1000}"
```

## 统一响应格式

成功：

```json
{
  "ok": true,
  "data": {}
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误说明"
  }
}
```

错误码包括：

- `MISSING_API_KEY`
- `INVALID_REQUEST`
- `LLM_REQUEST_FAILED`
- `LLM_TIMEOUT`
- `INTERNAL_ERROR`

## 给后续协作者的说明

当前仓库只提供 LLM 接入底座。业务同学可以在此基础上新增资料上传、RAG、知识点结构化生成、测验、错题本、学习计划、长期记忆等模块，但这些业务结构不要耦合进 `LLMService`。`LLMService` 应继续保持通用：接收 prompt 或 messages，返回模型文本和基础 usage。
