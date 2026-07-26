import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { whatsappApi } from "../api/whatsapp";
import { Icon } from "./icons";

/**
 * Client-facing WhatsApp connection status — read-only reassurance, no controls.
 * The connect flow itself lives in the operator-only admin view; here the owner
 * just sees whether their number is live.
 */
export default function WhatsappStatusBanner() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const conn = useQuery({
    queryKey: ["whatsapp", businessId],
    queryFn: () => whatsappApi.get(businessId),
    enabled: Boolean(businessId),
  });

  if (conn.isLoading || conn.isError) return null;

  const connected = conn.data?.status === "active";

  return (
    <div
      className={`mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 ${
        connected
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <span
        className={`grid place-items-center rounded-xl p-1.5 ${
          connected ? "bg-green-100" : "bg-amber-100"
        }`}
      >
        <Icon name="whatsapp" size={18} />
      </span>
      <span className="text-sm font-medium">
        {connected
          ? "מספר הוואטסאפ מחובר"
          : "מספר הוואטסאפ עדיין לא מחובר"}
      </span>
      <span
        className={`ms-auto inline-block size-2.5 rounded-full ${
          connected ? "bg-green-500" : "bg-amber-400"
        }`}
      />
    </div>
  );
}
