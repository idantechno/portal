import { api } from "./client";

export type FiledSource = "upload" | "agent";

export interface FiledDocument {
  id: string;
  folder: string;
  filename: string;
  mimeType: string;
  size: number;
  source: FiledSource;
  createdAt: string;
}

export const filingApi = {
  list: (businessId: string) =>
    api
      .get<FiledDocument[]>(`/businesses/${businessId}/filing`)
      .then((r) => r.data),

  folders: (businessId: string) =>
    api
      .get<string[]>(`/businesses/${businessId}/filing/folders`)
      .then((r) => r.data),

  upload: (businessId: string, file: File, folder: string) => {
    const fd = new FormData();
    fd.append("file", file);
    const q = folder ? `?folder=${encodeURIComponent(folder)}` : "";
    return api
      .post<FiledDocument>(`/businesses/${businessId}/filing${q}`, fd)
      .then((r) => r.data);
  },

  move: (businessId: string, id: string, folder: string) =>
    api
      .patch<FiledDocument>(`/businesses/${businessId}/filing/${id}`, { folder })
      .then((r) => r.data),

  remove: (businessId: string, id: string) =>
    api
      .delete<{ ok: boolean }>(`/businesses/${businessId}/filing/${id}`)
      .then((r) => r.data),

  downloadUrl: (businessId: string, id: string) =>
    `/api/businesses/${businessId}/filing/${id}/download`,
};
