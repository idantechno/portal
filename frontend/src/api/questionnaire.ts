import { api } from "./client";
import type { QuestionnairePayload } from "../questionnaire/schema";

export const questionnaireApi = {
  // Public — no auth. The client interceptor only attaches a token if one
  // exists, so this works for anonymous prospects.
  submit: (payload: QuestionnairePayload) =>
    api.post<{ ok: true }>("/questionnaire", payload).then((r) => r.data),
};
