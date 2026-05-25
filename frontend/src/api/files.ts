import { api } from "./client";
import type { ContextFile, ContextFileTree } from "./types";

export const filesApi = {
  list: (businessId: string) =>
    api
      .get<ContextFile[]>(`/businesses/${businessId}/files`)
      .then((r) => r.data),

  tree: (businessId: string) =>
    api
      .get<ContextFileTree>(`/businesses/${businessId}/files/tree`)
      .then((r) => r.data),

  upload: (
    businessId: string,
    file: File,
    opts: { hidden?: boolean; folder?: string } = {},
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    const params = new URLSearchParams();
    if (opts.hidden) params.set("hidden", "true");
    if (opts.folder) params.set("folder", opts.folder);
    const q = params.toString() ? `?${params}` : "";
    return api
      .post<ContextFile>(`/businesses/${businessId}/files${q}`, fd)
      .then((r) => r.data);
  },

  createFolder: (
    businessId: string,
    path: string,
    opts: { hidden?: boolean } = {},
  ) =>
    api
      .post<{ path: string; hidden: boolean }>(
        `/businesses/${businessId}/files/folders`,
        { path, hidden: opts.hidden ?? false },
      )
      .then((r) => r.data),

  createTextFile: (
    businessId: string,
    input: { path: string; content: string; hidden?: boolean; mimeType?: string },
  ) =>
    api
      .post<ContextFile>(`/businesses/${businessId}/files/create`, input)
      .then((r) => r.data),

  getContent: (businessId: string, fileId: string) =>
    api
      .get<{ file: ContextFile; content: string }>(
        `/businesses/${businessId}/files/${fileId}/content`,
      )
      .then((r) => r.data),

  updateContent: (businessId: string, fileId: string, content: string) =>
    api
      .put<ContextFile>(
        `/businesses/${businessId}/files/${fileId}/content`,
        { content },
      )
      .then((r) => r.data),

  move: (businessId: string, fileId: string, newPath: string) =>
    api
      .patch<ContextFile>(
        `/businesses/${businessId}/files/${fileId}/path`,
        { newPath },
      )
      .then((r) => r.data),

  delete: (businessId: string, fileId: string) =>
    api
      .delete<{ ok: boolean }>(`/businesses/${businessId}/files/${fileId}`)
      .then((r) => r.data),

  downloadBlob: (businessId: string, fileId: string) =>
    api
      .get<Blob>(`/businesses/${businessId}/files/${fileId}`, {
        responseType: "blob",
      })
      .then((r) => r.data),
};
