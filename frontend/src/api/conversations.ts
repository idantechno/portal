import { api } from "./client";

export type Channel = "web" | "whatsapp" | "instagram";
export type ConversationStatus = "bot" | "human" | "closed";
export type MessageRole = "customer" | "bot" | "agent" | "system" | "tool";
export type ContactStatus = "lead" | "customer";

export interface CustomerContact {
  id: string;
  businessId: string;
  channel: Channel;
  externalId: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  status: ContactStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  /** Resolved contact card, attached by the list/detail endpoints. */
  contact?: CustomerContact | null;
}

export interface ContactCard {
  contact: CustomerContact;
  conversations: Conversation[];
  stats: {
    messageCount: number;
    firstMessageAt: string | null;
    lastMessageAt: string | null;
  };
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

export interface ContactListItem extends CustomerContact {
  lastActivityAt: string | null;
}

export const contactsApi = {
  list: (businessId: string, status: ContactStatus) =>
    api
      .get<ContactListItem[]>(`/businesses/${businessId}/contacts`, {
        params: { status },
      })
      .then((r) => r.data),

  card: (businessId: string, contactId: string) =>
    api
      .get<ContactCard>(`/businesses/${businessId}/contacts/${contactId}`)
      .then((r) => r.data),

  update: (
    businessId: string,
    contactId: string,
    patch: Partial<Pick<CustomerContact, "status" | "notes" | "displayName">>,
  ) =>
    api
      .patch<CustomerContact>(
        `/businesses/${businessId}/contacts/${contactId}`,
        patch,
      )
      .then((r) => r.data),
};
