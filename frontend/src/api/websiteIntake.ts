import { api } from "./client";
import type { IntakePayload } from "../website-intake/schema";

export interface IntakeAsset {
  name: string;
  path: string;
  mime: string;
  size: number;
}

export interface WebsiteIntake {
  id: string;
  businessId: string;
  customerId: string;
  contactName: string;
  businessName: string | null;
  phone: string | null;
  email: string | null;
  sections: { title: string; items: { id?: string; label: string; value: string }[] }[];
  logo: IntakeAsset | null;
  images: IntakeAsset[];
  createdAt: string;
}

export const websiteIntakeApi = {
  /** Public — no auth. Sends the JSON payload plus logo + up to 5 image files
   *  as multipart. Returns a `pdfToken` for the client's PDF download link. */
  submit: (payload: IntakePayload, logo: File | null, images: File[]) => {
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    if (logo) form.append("logo", logo);
    for (const img of images) form.append("images", img);
    return api
      .post<{ ok: true; pdfToken?: string }>("/website-intake", form)
      .then((r) => r.data);
  },

  /** Public, token-authenticated PDF link — the client's "הורד PDF" button. */
  publicPdfUrl: (token: string) =>
    `${api.defaults.baseURL}/website-intake/p/${token}/pdf`,

  /** Operator PDF (business-scoped) — fetched with auth as a blob for download. */
  operatorPdfBlobUrl: async (
    businessId: string,
    intakeId: string,
  ): Promise<string> => {
    const res = await api.get<Blob>(
      `/businesses/${businessId}/website-intakes/${intakeId}/pdf`,
      { responseType: "blob" },
    );
    return URL.createObjectURL(res.data);
  },

  /** Operator side — the intakes filed for one customer. */
  listForCustomer: (businessId: string, customerId: string) =>
    api
      .get<WebsiteIntake[]>(`/businesses/${businessId}/website-intakes`, {
        params: { customerId },
      })
      .then((r) => r.data),

  /** Fetches a stored asset (with the auth header) and returns an object URL
   *  usable as an <img src>. The endpoint is JWT-guarded, so a plain <img src>
   *  to it would 401 — go through axios instead. Caller revokes the URL. */
  assetObjectUrl: async (
    businessId: string,
    intakeId: string,
    kind: "logo" | "image",
    index = 0,
  ): Promise<string> => {
    const res = await api.get<Blob>(
      `/businesses/${businessId}/website-intakes/${intakeId}/assets/${kind}/${index}`,
      { responseType: "blob" },
    );
    return URL.createObjectURL(res.data);
  },
};
