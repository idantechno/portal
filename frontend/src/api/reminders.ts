import { api } from "./client";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RemindersChatResult {
  reply: string;
  changed: boolean;
}

export interface RemindersEntitlement {
  paid: boolean;
  onTrial: boolean;
  locked: boolean;
  trialEndsAt: string;
  daysLeft: number;
  staffBypass: boolean;
}

export const remindersApi = {
  chat: (businessId: string, history: ChatTurn[]) =>
    api
      .post<RemindersChatResult>(
        `/businesses/${businessId}/agents/reminders/chat`,
        { history },
      )
      .then((r) => r.data),

  entitlement: (businessId: string) =>
    api
      .get<RemindersEntitlement>(
        `/businesses/${businessId}/agents/reminders/entitlement`,
      )
      .then((r) => r.data),
};
