import { api } from "./client";

export type Channel = "web" | "whatsapp" | "instagram";
export type ConversationStatus = "bot" | "human" | "closed";
export type MessageRole = "customer" | "bot" | "agent" | "system" | "tool";

export interface Conversation {
  id: string;
  businessId: string;
  channel: Channel;
  externalThreadId: string;
  customerContactId: string;
  status: ConversationStatus;
  assignedAgentUserId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  businessId: string;
  role: MessageRole;
  content: string;
  contentJson: Record<string, unknown> | null;
  agentUserId: string | null;
  externalMessageId: string | null;
  createdAt: string;
}

export const conversationsApi = {
  list: (
    businessId: string,
    opts: { status?: ConversationStatus; limit?: number; offset?: number } = {},
  ) =>
    api
      .get<Conversation[]>(`/businesses/${businessId}/conversations`, {
        params: opts,
      })
      .then((r) => r.data),

  get: (businessId: string, conversationId: string) =>
    api
      .get<Conversation>(
        `/businesses/${businessId}/conversations/${conversationId}`,
      )
      .then((r) => r.data),

  messages: (businessId: string, conversationId: string) =>
    api
      .get<Message[]>(
        `/businesses/${businessId}/conversations/${conversationId}/messages`,
      )
      .then((r) => r.data),

  sendReply: (businessId: string, conversationId: string, content: string) =>
    api
      .post<Message>(
        `/businesses/${businessId}/conversations/${conversationId}/messages`,
        { content },
      )
      .then((r) => r.data),

  takeover: (businessId: string, conversationId: string) =>
    api
      .post<Conversation>(
        `/businesses/${businessId}/conversations/${conversationId}/takeover`,
      )
      .then((r) => r.data),

  returnToBot: (businessId: string, conversationId: string) =>
    api
      .post<Conversation>(
        `/businesses/${businessId}/conversations/${conversationId}/return-to-bot`,
      )
      .then((r) => r.data),

  close: (businessId: string, conversationId: string) =>
    api
      .post<Conversation>(
        `/businesses/${businessId}/conversations/${conversationId}/close`,
      )
      .then((r) => r.data),
};
