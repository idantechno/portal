import { api } from "./client";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RemindersChatResult {
  reply: string;
  changed: boolean;
}

export const remindersApi = {
  chat: (businessId: string, history: ChatTurn[]) =>
    api
      .post<RemindersChatResult>(
        `/businesses/${businessId}/agents/reminders/chat`,
        { history },
      )
      .then((r) => r.data),
};
