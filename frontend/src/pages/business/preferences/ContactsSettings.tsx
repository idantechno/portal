import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../../../api/businesses";
import { apiErrorMessage } from "../../../api/client";
import type { Business } from "../../../api/types";
import {
  Button,
  Card,
  FormError,
  Input,
  Label,
  PageHeader,
  Spinner,
} from "../../../components/ui";
import { Icon } from "../../../components/icons";

/** Contact details the AGENTS use — the owner's own number (for the WhatsApp
 *  concierge) and the accountant's inbox/number (for sending financial docs). */
export default function ContactsSettings() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
    enabled: Boolean(businessId),
  });

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-2xl mx-auto">
      <Link
        to=".."
        className="mb-3 inline-flex items-center gap-1 text-sm text-navy-400 hover:text-navy-700"
      >
        <Icon name="chevron-start" size={16} className="rtl:-scale-x-100" />
        הגדרות
      </Link>
      <PageHeader
        eyebrow="הגדרות"
        title="אנשי קשר לסוכנים"
        subtitle="הפרטים שהסוכנים משתמשים בהם. הם נשמרים לעסק ומשמשים את הפעולות האוטומטיות."
      />
      {biz.isLoading || !biz.data ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <ContactsForm key={businessId} businessId={businessId} initial={biz.data} />
      )}
    </div>
  );
}

function ContactsForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: Business;
}) {
  const qc = useQueryClient();
  const [ownerPhone, setOwnerPhone] = useState(initial.ownerPhone ?? "");
  const [accEmail, setAccEmail] = useState(initial.accountantEmail ?? "");
  const [accPhone, setAccPhone] = useState(initial.accountantPhone ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      businessesApi.update(businessId, {
        ownerPhone,
        accountantEmail: accEmail,
        accountantPhone: accPhone,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business", businessId] });
      setSaved(true);
      setError(null);
      window.setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(apiErrorMessage(err, "השמירה נכשלה, נסה שוב")),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card className="p-5">
        <h2 className="mb-1 font-semibold text-navy-900">בעל העסק</h2>
        <p className="mb-3 text-sm text-navy-400">
          המספר הפרטי שממנו אפשר לתת הוראות לסוכן דרך הוואטסאפ של העסק ("תזכיר
          לי…", שליחת קבלה לרישום כהוצאה). הודעות ממנו מטופלות כפקודות בעלים.
        </p>
        <Label htmlFor="owner-phone">טלפון (וואטסאפ)</Label>
        <Input
          id="owner-phone"
          type="tel"
          value={ownerPhone}
          onChange={(e) => setOwnerPhone(e.target.value)}
          placeholder="050-0000000"
          dir="ltr"
        />
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-semibold text-navy-900">רואה חשבון</h2>
        <p className="mb-3 text-sm text-navy-400">
          הנמען הקבוע לשליחת מסמכים כספיים. שליחה "לרו״ח" (כפתור/סוכן/חודשי) תמיד
          הולכת רק לכאן.
        </p>
        <Label htmlFor="acc-email">מייל</Label>
        <Input
          id="acc-email"
          type="email"
          value={accEmail}
          onChange={(e) => setAccEmail(e.target.value)}
          placeholder="accountant@example.com"
          dir="ltr"
        />
        <Label htmlFor="acc-phone" className="mt-3">
          טלפון (וואטסאפ)
        </Label>
        <Input
          id="acc-phone"
          type="tel"
          value={accPhone}
          onChange={(e) => setAccPhone(e.target.value)}
          placeholder="050-0000000"
          dir="ltr"
        />
      </Card>

      <FormError message={error} />

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1 text-sm text-teal-600">
            <Icon name="check" size={16} />
            נשמר
          </span>
        )}
        <Button type="submit" icon="check" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : "שמור"}
        </Button>
      </div>
    </form>
  );
}
