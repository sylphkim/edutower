export type LLMMessageRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMMessageRole;
  content: string;
}

export interface GenerateTextParams {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** 开启后要求服务商只返回合法 JSON 对象（response_format: json_object）。 */
  jsonMode?: boolean;
}

export interface ChatParams {
  messages: LLMMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LLMUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface LLMResult {
  text: string;
  model: string;
  provider: string;
  usage?: LLMUsage;
  raw?: unknown;
}
