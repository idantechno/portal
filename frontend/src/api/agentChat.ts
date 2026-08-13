import { api } from "./client";

export interface StoredChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StoredChatMessage extends StoredChatTurn {
  id: string;
  createdAt: string;
}

/** Keep client payloads under the backend's per-turn cap. */
const MAX_CONTENT = 20000;

/**
 * Persistence for the owner↔agent workspace chats (kept 30 days server-side).
 * Writes are best-effort — a failed save must never break a chat turn — so
 * `append`/`clear` swallow errors. `history` is the one call that surfaces
 * failures to the caller (which just falls back to an empty conversation).
 */
export const agentChatApi = {
  history: (businessId: string, agentKey: string) =>
    api
      .get<StoredChatMessage[]>(
        `/businesses/${businessId}/agent-chat/${agentKey}`,
      )
      .then((r) => r.data),

  append: (businessId: string, agentKey: string, turns: StoredChatTurn[]) =>
    api
      .post(`/businesses/${businessId}/agent-chat/${agentKey}`, {
        turns: turns
          .filter((t) => t.content && t.content.trim())
          .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_CONTENT) })),
      })
      .catch(() => undefined),

  clear: (businessId: string, agentKey: string) =>
    api
      .delete(`/businesses/${businessId}/agent-chat/${agentKey}`)
      .catch(() => undefined),
};
