# AI Learning Assistant Backend

AI 学习助手后端第一阶段项目：提供 Node.js + TypeScript + Express 的基础后端结构，并完成通用 LLM Provider 接入层。

当前大模型接入层支持 OpenAI-compatible API 服务。虽然项目使用 `openai` 这个 npm 包，但它只是 SDK 客户端；通过 `LLM_BASE_URL` 可以调用 OpenAI、DeepSeek、OpenRouter、硅基流动等兼容 Chat Completions API 的服务。

## 当前阶段范围

- 基础 Express 服务
- 通用 LLM Provider 环境变量配置
- 通用 LLM 调用服务
- Chat Completions API 调用封装
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

不要提交 `.env`，只提交 `.env.example`。

### DeepSeek 示例

```env
PORT=3000

LLM_PROVIDER=deepseek
LLM_API_KEY=你的 DeepSeek API Key
LLM_MODEL=deepseek-v4-pro
LLM_BASE_URL=https://api.deepseek.com
LLM_TIMEOUT_MS=30000
LLM_MAX_OUTPUT_TOKENS=1000
```

### OpenAI 官方服务示例

```env
PORT=3000

LLM_PROVIDER=openai
LLM_API_KEY=你的 OpenAI API Key
LLM_MODEL=你的模型名
LLM_BASE_URL=
LLM_TIMEOUT_MS=30000
LLM_MAX_OUTPUT_TOKENS=1000
```

### 其他 OpenAI-compatible 服务

将 `LLM_PROVIDER` 写成服务标识，将 `LLM_BASE_URL` 配置成对应服务的 OpenAI-compatible API 地址，并填写对应的 `LLM_API_KEY` 和 `LLM_MODEL`。

旧配置仍可作为 fallback 使用：

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`

优先级为：`LLM_*` > `OPENAI_*` > 默认值。

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
  -d "{\"systemPrompt\":\"你是一个学习助手。\",\"userPrompt\":\"请解释导数。\",\"temperature\":0.7,\"maxOutputTokens\":1000}"
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
- `LLM_AUTH_FAILED`
- `LLM_MODEL_ERROR`
- `LLM_RATE_LIMITED`
- `LLM_TIMEOUT`
- `LLM_CONNECTION_ERROR`
- `LLM_REQUEST_FAILED`
- `INTERNAL_ERROR`

## 给后续协作者的说明

当前仓库只提供通用 LLM 调用底座。业务同学可以在此基础上新增资料上传、RAG、知识点结构化生成、测验、错题本、学习计划、长期记忆等模块，但这些业务结构不要耦合进 `LLMService`。

`LLMService` 应继续保持通用：接收 prompt 或 messages，返回模型文本、provider、model 和基础 usage。不在这里实现知识点、小测验、学习计划、记忆等业务 JSON 解析或校验。
