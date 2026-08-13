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
  Textarea,
} from "../../../components/ui";
import { Icon } from "../../../components/icons";
import { useAuthStore } from "../../../store/auth";
import { isPlatformStaff } from "../../../lib/roles";

/** The business's own description — the fields that feed the agents' context.
 *  Only platform staff (the operator) may edit these; the owner sees them
 *  read-only. Ongoing business knowledge belongs in the documents folder, not
 *  in fields the owner keeps changing under the agents' feet. */
export default function BusinessInfoSettings() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const staff = isPlatformStaff(useAuthStore((s) => s.user)?.role);
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
        title="פרטי העסק"
        subtitle={
          staff
            ? "המידע הזה מזין את הסוכנים — ככל שהוא מדויק, כך הם עובדים טוב יותר."
            : "כך רשום העסק שלך במערכת. לעדכון הפרטים פנה למנהל המערכת."
        }
      />
      {biz.isLoading || !biz.data ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : staff ? (
        <InfoForm key={businessId} businessId={businessId} initial={biz.data} />
      ) : (
        <InfoReadOnly business={biz.data} />
      )}
    </div>
  );
}

/** The five business-description fields, in display order. */
const FIELDS: { label: string; get: (b: Business) => string | undefined }[] = [
  { label: "שם העסק", get: (b) => b.name },
  { label: "תחום / ענף", get: (b) => b.onboarding?.industry },
  { label: "קהל היעד", get: (b) => b.onboarding?.audience },
  { label: "שירותים / מוצרים", get: (b) => b.onboarding?.offerings },
  { label: "טון / סגנון דיבור", get: (b) => b.onboarding?.tone },
];

/** Owner-facing read-only view of the business profile. */
function InfoReadOnly({ business }: { business: Business }) {
  return (
    <Card className="divide-y divide-navy-100 p-0">
      {FIELDS.map(({ label, get }) => {
        const value = get(business)?.trim();
        return (
          <div key={label} className="px-5 py-4">
            <div className="text-xs font-medium text-navy-400">{label}</div>
            {value ? (
              <div className="mt-1 whitespace-pre-line text-navy-900">
                {value}
              </div>
            ) : (
              <div className="mt-1 text-navy-300">לא הוגדר עדיין</div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

function InfoForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: Business;
}) {
  const qc = useQueryClient();
  const ob = initial.onboarding ?? {};
  const [name, setName] = useState(initial.name);
  const [industry, setIndustry] = useState(ob.industry ?? "");
  const [audience, setAudience] = useState(ob.audience ?? "");
  const [offerings, setOfferings] = useState(ob.offerings ?? "");
  const [tone, setTone] = useState(ob.tone ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      businessesApi.update(businessId, {
        name,
        // Backend merges onboarding, so these partial fields don't wipe others.
        onboarding: { industry, audience, offerings, tone },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business", businessId] });
      qc.invalidateQueries({ queryKey: ["businesses"] });
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
      <Card className="space-y-4 p-5">
        <div>
          <Label htmlFor="biz-name">שם העסק</Label>
          <Input
            id="biz-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="biz-industry">תחום / ענף</Label>
          <Input
            id="biz-industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="למשל: עיצוב פנים, קליניקה, מסעדה"
          />
        </div>
        <div>
          <Label htmlFor="biz-audience">קהל היעד</Label>
          <Textarea
            id="biz-audience"
            rows={2}
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="מי הלקוחות שלך?"
          />
        </div>
        <div>
          <Label htmlFor="biz-offerings">שירותים / מוצרים</Label>
          <Textarea
            id="biz-offerings"
            rows={3}
            value={offerings}
            onChange={(e) => setOfferings(e.target.value)}
            placeholder="מה אתה מציע?"
          />
        </div>
        <div>
          <Label htmlFor="biz-tone">טון / סגנון דיבור</Label>
          <Input
            id="biz-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="למשל: חם ואישי, מקצועי ורשמי"
          />
        </div>
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
