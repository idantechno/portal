import { api } from "./client";

export interface BrandConfig {
  logoUrl?: string;
  primaryColor?: string;
  font?: string;
}

export type DocumentStatus = "draft" | "sent" | "signed" | "cancelled";

export interface SignDocumentView {
  status: DocumentStatus;
  businessName: string;
  brand: BrandConfig;
  boilerplate: Record<string, string>;
  variables: Record<string, unknown>;
  recipientFields: {
    signerFullName: string;
    signerId?: string;
  } | null;
  signedAt: string | null;
  pdfUrl: string | null;
}

export interface SubmitSigningInput {
  signerFullName: string;
  signerId?: string;
  signatureSvg: string;
}

export interface SubmitSigningResult {
  status: DocumentStatus;
  signedAt: string;
  pdfUrl: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface DocumentInstance {
  id: string;
  status: DocumentStatus;
  templateId: string;
  variables: Record<string, unknown>;
  publicToken: string | null;
  signedAt: string | null;
  createdAt: string;
}

export interface ChatResult {
  reply: string;
  created: DocumentInstance[];
}

export const documentsApi = {
  // Public — no auth, token-only
  getSignView: (token: string) =>
    api.get<SignDocumentView>(`/sign/${token}`).then((r) => r.data),

  submitSigning: (token: string, input: SubmitSigningInput) =>
    api
      .post<SubmitSigningResult>(`/sign/${token}/submit`, input)
      .then((r) => r.data),

  pdfUrl: (token: string) => `/api/sign/${token}/pdf`,

  // Authenticated — business scope
  chat: (businessId: string, history: ChatTurn[]) =>
    api
      .post<ChatResult>(`/businesses/${businessId}/agents/documents/chat`, {
        history,
      })
      .then((r) => r.data),

  listInstances: (businessId: string) =>
    api
      .get<DocumentInstance[]>(`/businesses/${businessId}/documents`)
      .then((r) => r.data),
};
