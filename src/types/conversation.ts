export type ConversationType = "free_qa" | "project_setup" | "project_study";
export type MessageRole = "user" | "assistant";

export interface MessageItem {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  projectId: string | null;
  type: ConversationType;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail extends ConversationItem {
  messages: MessageItem[];
}

export interface CreateConversationInput {
  projectId?: string;
  type?: ConversationType;
  title?: string;
}
