import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  contactsApi,
  type ContactAgentMode,
  type ContactStatus,
  type CustomerContact,
} from "../../api/conversations";
import { apiErrorMessage } from "../../api/client";
import { Button, Spinner } from "../../components/ui";
import { Icon } from "../../components/icons";

/** Wait-window choices for delayed mode — must mirror the backend's
 *  CONTACT_AGENT_DELAY_CHOICES. */
const DELAY_OPTIONS: { value: number; label: string }[] = [
  { value: 2, label: "2 דקות" },
  { value: 3, label: "3 דקות" },
  { value: 5, label: "5 דקות" },
  { value: 10, label: "10 דקות" },
  { value: 15, label: "15 דקות" },
  { value: 30, label: "30 דקות" },
  { value: 45, label: "45 דקות" },
  { value: 60, label: "שעה" },
  { value: 120, label: "שעתיים" },
  { value: 180, label: "3 שעות" },
  { value: 300, label: "5 שעות" },
];

function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-e3 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Edits the *number's* profile (relationship status + private notes + name),
 * not a single conversation. What the operator sets here is what the agent
 * reads to recognise the customer on their next message.
 */
export default function ContactPanel({
  businessId,
  contact,
  phoneFallback,
  onClose,
}: {
  businessId: string;
  contact: CustomerContact;
  phoneFallback: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [displayName, setDisplayName] = useState(contact.displayName ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [agentMode, setAgentMode] = useState<ContactAgentMode>(
    contact.agentMode ?? "active",
  );
  const [delayMinutes, setDelayMinutes] = useState<number>(
    contact.agentDelayMinutes ?? 10,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      contactsApi.update(businessId, contact.id, {
        status,
        displayName: displayName.trim() || null,
        notes: notes.trim() || null,
        agentMode,
        agentDelayMinutes: agentMode === "delayed" ? delayMinutes : null,
      }),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["conversations", businessId] });
      setTimeout(onClose, 500);
    },
    onError: (err) => setError(apiErrorMessage(err, "Save failed")),
  });

  const statuses: Array<{ value: ContactStatus; label: string }> = [
    { value: "lead", label: t("inbox.contactLead") },
    { value: "customer", label: t("inbox.contactCustomer") },
  ];

  return (
    <Modal onClose={onClose}>
      <div className="px-6 py-5 border-b border-neutral-100 flex items-center gap-3">
        <div className="rounded-xl bg-brand-50 text-brand-700 p-2">
          <Icon name="user" size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg leading-tight">
            {t("inbox.contactCardTitle")}
          </h2>
          <div className="text-xs text-neutral-500 truncate" dir="ltr">
            {phoneFallback}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ms-auto rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
          aria-label={t("common.close", "Close")}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Relationship status */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-2">
            {t("inbox.contactStatus")}
          </label>
          <div className="flex gap-2">
            {statuses.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  status === s.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Agent behaviour for THIS contact */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-2">
            סוכן עבור איש קשר זה
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "active", label: "פעיל", hint: "עונה מיד" },
                { value: "off", label: "כבוי", hint: "לא עונה" },
                { value: "delayed", label: "השהיה", hint: "אתה קודם" },
              ] as { value: ContactAgentMode; label: string; hint: string }[]
            ).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setAgentMode(m.value)}
                className={`rounded-xl border px-2 py-2 text-center transition ${
                  agentMode === m.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <div className="text-sm font-medium">{m.label}</div>
                <div className="mt-0.5 text-[10px] text-neutral-400">
                  {m.hint}
                </div>
              </button>
            ))}
          </div>

          {agentMode === "delayed" && (
            <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
              <label className="mb-1.5 block text-xs font-medium text-neutral-600">
                כמה זמן לחכות לך לפני שהסוכן נכנס?
              </label>
              <select
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                {DELAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-neutral-400">
                כשלקוח כותב, הסוכן ממתין. ענית בזמן — הוא שותק. לא ענית — הוא נכנס
                בעדינות ומציע ללקוח להיעזר בו או להמתין לך.
              </p>
            </div>
          )}
        </div>

        {/* Display name */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-2">
            {t("inbox.contactName")}
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("inbox.contactNamePlaceholder")}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        {/* Private notes */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-2">
            {t("inbox.contactNotes")}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("inbox.contactNotesPlaceholder")}
            rows={4}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none resize-none"
          />
          <p className="text-[11px] text-neutral-400 mt-1">
            {t("inbox.contactNotesHint")}
          </p>
        </div>

        {error && <div className="text-xs text-red-700">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || saved}
          >
            {save.isPending ? (
              <>
                <Spinner /> {t("inbox.contactSave")}
              </>
            ) : saved ? (
              t("inbox.contactSaved")
            ) : (
              t("inbox.contactSave")
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
