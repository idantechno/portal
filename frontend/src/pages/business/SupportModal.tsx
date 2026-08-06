import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { supportApi } from "../../api/support";
import { apiErrorMessage } from "../../api/client";
import { Banner, Button, Input, Spinner, Textarea } from "../../components/ui";
import { Icon } from "../../components/icons";

/**
 * Client help/support entry. Files a request into the operator's cross-tenant
 * support inbox (same one platform staff watch under "פניות מערכת"). Reachable
 * from the sidebar footer for every business member.
 */
export default function SupportModal({
  businessId,
  onClose,
}: {
  businessId: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const send = useMutation({
    mutationFn: () =>
      supportApi.create(businessId, {
        message: message.trim(),
        subject: subject.trim() || undefined,
      }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (message.trim()) send.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-e3 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center gap-3">
          <div className="rounded-xl bg-brand-50 text-brand-700 p-2">
            <Icon name="chat" size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg leading-tight">עזרה ותמיכה</h2>
            <div className="text-xs text-neutral-500">
              נחזור אליך בהקדם האפשרי
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ms-auto rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
            aria-label="סגור"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          {send.isSuccess ? (
            <Banner tone="success">
              קיבלנו את הפנייה — נחזור אליך בהקדם.
              <div className="mt-3">
                <Button variant="ghost" onClick={onClose}>
                  סגור
                </Button>
              </div>
            </Banner>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-neutral-600 leading-relaxed">
                צריך עזרה או נתקלת בתקלה? כתוב לנו ונחזור אליך.
              </p>

              <div>
                <label className="block text-sm font-medium text-navy-800 mb-1.5">
                  נושא (אופציונלי)
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="לדוגמה: בעיה בשליחת הודעות"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-navy-800 mb-1.5">
                  במה נוכל לעזור?
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="תאר במילים שלך מה קרה או במה אתה צריך עזרה."
                  rows={5}
                />
              </div>

              {send.isError && (
                <Banner tone="danger">
                  {apiErrorMessage(send.error, "משהו השתבש בשליחה. נסה שוב בעוד רגע.")}
                </Banner>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  icon="send"
                  disabled={!message.trim() || send.isPending}
                >
                  {send.isPending ? <Spinner /> : "שלח פנייה"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
