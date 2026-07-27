import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../api/businesses";
import { apiErrorMessage } from "../api/client";
import type { Business } from "../api/types";
import { Button, FormError, Input, Label, Spinner, Textarea } from "./ui";
import { BUSINESS_VALUES } from "../lib/businessValues";

interface Props {
  businessId: string;
  business: Business;
  /** Called after a successful save (e.g. to close a banner). */
  onSaved?: () => void;
}

/**
 * The owner-characterization questionnaire. What's captured here is injected
 * into every agent's context, so the whole system speaks in line with the
 * business. Used both in Settings and in the first-run Home banner.
 */
export default function BusinessProfileForm({
  businessId,
  business,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const o = business.onboarding ?? {};
  const [industry, setIndustry] = useState(o.industry ?? "");
  const [audience, setAudience] = useState(o.audience ?? "");
  const [offerings, setOfferings] = useState(o.offerings ?? "");
  const [tone, setTone] = useState(o.tone ?? "");
  const [values, setValues] = useState<string[]>(o.values ?? []);
  const [feeling, setFeeling] = useState(o.feeling ?? "");
  const [goals, setGoals] = useState(o.goals ?? "");
  const [differentiators, setDifferentiators] = useState(
    o.differentiators ?? "",
  );
  const [notes, setNotes] = useState(o.notes ?? "");
  const [city, setCity] = useState(o.city ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      businessesApi.update(businessId, {
        onboarding: {
          completed: true,
          industry: industry.trim() || undefined,
          audience: audience.trim() || undefined,
          offerings: offerings.trim() || undefined,
          tone: tone.trim() || undefined,
          values: values.length ? values : undefined,
          feeling: feeling.trim() || undefined,
          goals: goals.trim() || undefined,
          differentiators: differentiators.trim() || undefined,
          notes: notes.trim() || undefined,
          city: city.trim() || undefined,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["business", businessId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    },
    onError: (e) => setError(apiErrorMessage(e, "השמירה נכשלה")),
  });

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="ob-industry">תחום העסק / מה אתה עושה</Label>
          <Input
            id="ob-industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="לדוגמה: מסעדה איטלקית, סטודיו לצילום"
          />
        </div>
        <div>
          <Label htmlFor="ob-audience">קהל היעד</Label>
          <Input
            id="ob-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="מי הלקוחות שלך?"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="ob-offerings">המוצרים / השירותים העיקריים</Label>
        <Textarea
          id="ob-offerings"
          value={offerings}
          onChange={(e) => setOfferings(e.target.value)}
          rows={2}
          placeholder="מה אתה מוכר או נותן?"
        />
      </div>

      <div>
        <Label htmlFor="ob-tone">טון הדיבור מול לקוחות</Label>
        <Input
          id="ob-tone"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="לדוגמה: חם ואישי / מקצועי / צעיר וקליל"
        />
      </div>

      <div>
        <Label>הערכים שמייצגים את העסק</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {BUSINESS_VALUES.map((v) => {
            const on = values.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() =>
                  setValues((cur) =>
                    cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
                  )
                }
                className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                  on
                    ? "bg-brand-500 border-brand-500 text-white"
                    : "bg-white border-navy-200 text-navy-600 hover:border-brand-300"
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="ob-feeling">
          איזו תחושה שלקוח ייצא איתה מהמפגש
        </Label>
        <Textarea
          id="ob-feeling"
          value={feeling}
          onChange={(e) => setFeeling(e.target.value)}
          rows={2}
          placeholder="לדוגמה: שקיבלו יחס אישי ומרגישים בטוחים בבחירה"
        />
      </div>

      <div>
        <Label htmlFor="ob-goals">מטרות לתקופה הקרובה</Label>
        <Textarea
          id="ob-goals"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={2}
          placeholder="מה חשוב לך להשיג?"
        />
      </div>

      <div>
        <Label htmlFor="ob-diff">מה מייחד אותך</Label>
        <Textarea
          id="ob-diff"
          value={differentiators}
          onChange={(e) => setDifferentiators(e.target.value)}
          rows={2}
          placeholder="למה לקוחות בוחרים בך ולא במתחרים?"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="ob-notes">דגשים / מה לא לומר</Label>
          <Textarea
            id="ob-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="משהו שחשוב להדגיש, או דברים שעדיף להימנע מהם"
          />
        </div>
        <div>
          <Label htmlFor="ob-city">עיר (לתחזית מזג האוויר בדף הבית)</Label>
          <Input
            id="ob-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="לדוגמה: תל אביב"
          />
        </div>
      </div>

      <FormError message={error} />
      <div className="flex items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Spinner /> : "שמור אפיון"}
        </Button>
        {saved && <span className="text-sm text-green-700">נשמר ✓</span>}
      </div>
    </div>
  );
}
