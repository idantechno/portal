import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../../api/businesses";
import { apiErrorMessage } from "../../api/client";
import type { Business } from "../../api/types";
import { Button, FormError, Input, Label, Spinner, Textarea } from "../../components/ui";
import { Icon } from "../../components/icons";
import { BUSINESS_VALUES } from "../../lib/businessValues";

interface Props {
  businessId: string;
  business: Business;
}

/**
 * One-time "welcome to Portal Studio" flow, shown only on the owner's very first
 * login (gated by onboarding.completed). Clean, minimal, iPhone-setup style: a
 * splash + a few short pages that capture the business's identity and values.
 * On finish it stamps completed:true so it never appears again — the same data
 * stays editable afterwards in Settings. Purely owner-facing: nothing here
 * configures agents (operator instructions live in hidden context documents).
 */
export default function WelcomeWizard({ businessId, business }: Props) {
  const qc = useQueryClient();
  const o = business.onboarding ?? {};
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [industry, setIndustry] = useState(o.industry ?? "");
  const [audience, setAudience] = useState(o.audience ?? "");
  const [offerings, setOfferings] = useState(o.offerings ?? "");
  const [differentiators, setDifferentiators] = useState(o.differentiators ?? "");
  const [tone, setTone] = useState(o.tone ?? "");
  const [values, setValues] = useState<string[]>(o.values ?? []);
  const [feeling, setFeeling] = useState(o.feeling ?? "");
  const [goals, setGoals] = useState(o.goals ?? "");
  const [city, setCity] = useState(o.city ?? "");

  const toggleValue = (v: string) =>
    setValues((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );

  const save = useMutation({
    mutationFn: () =>
      businessesApi.update(businessId, {
        onboarding: {
          completed: true,
          industry: industry.trim() || undefined,
          audience: audience.trim() || undefined,
          offerings: offerings.trim() || undefined,
          differentiators: differentiators.trim() || undefined,
          tone: tone.trim() || undefined,
          values: values.length ? values : undefined,
          feeling: feeling.trim() || undefined,
          goals: goals.trim() || undefined,
          city: city.trim() || undefined,
        },
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["business", businessId] }),
    onError: (e) => setError(apiErrorMessage(e, "השמירה נכשלה")),
  });

  // Splash + 3 content steps.
  const STEPS = 4;
  const next = () => setStep((s) => Math.min(s + 1, STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="fixed inset-0 z-50 app-canvas overflow-y-auto" dir="rtl">
      <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg">
          {/* Progress dots (hidden on the splash). */}
          {step > 0 && (
            <div className="flex justify-center gap-1.5 mb-6">
              {Array.from({ length: STEPS - 1 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i + 1 === step
                      ? "w-6 bg-brand-500"
                      : i + 1 < step
                        ? "w-1.5 bg-brand-400"
                        : "w-1.5 bg-navy-200"
                  }`}
                />
              ))}
            </div>
          )}

          <div className="rounded-3xl bg-white border border-navy-100 shadow-e2 p-6 sm:p-8">
            {step === 0 && (
              <div className="text-center py-6">
                <img
                  src={business.branding?.logoUrl || "/icon.png"}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-contain bg-cream-50 border border-navy-100 p-1.5 mx-auto mb-5"
                />
                <h1 className="font-display text-3xl text-navy-900">
                  ברוכים הבאים ל-Portal Studio
                </h1>
                <p className="text-navy-500 mt-3 leading-relaxed">
                  כמה שאלות קצרות כדי להכיר את העסק שלך — האופי, הערכים והמטרות.
                  זה יופיע פעם אחת בלבד, ותמיד אפשר לערוך אחר כך בהגדרות.
                </p>
                <Button className="mt-7" onClick={next}>
                  בוא נתחיל
                </Button>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <StepHead
                  title="מה העסק שלך עושה"
                  subtitle="בקצרה — במילים שלך."
                />
                <div>
                  <Label htmlFor="w-industry">תחום העסק</Label>
                  <Input
                    id="w-industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="לדוגמה: מסעדה איטלקית, סטודיו לצילום"
                  />
                </div>
                <div>
                  <Label htmlFor="w-audience">קהל היעד</Label>
                  <Input
                    id="w-audience"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="מי הלקוחות שלך?"
                  />
                </div>
                <div>
                  <Label htmlFor="w-offerings">המוצרים / השירותים העיקריים</Label>
                  <Textarea
                    id="w-offerings"
                    value={offerings}
                    onChange={(e) => setOfferings(e.target.value)}
                    rows={2}
                    placeholder="מה אתה מוכר או נותן?"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <StepHead
                  title="האופי והערכים"
                  subtitle="מה שמייחד אתכם, ואיך אתם מרגישים ללקוח."
                />
                <div>
                  <Label htmlFor="w-diff">מה מייחד אתכם</Label>
                  <Textarea
                    id="w-diff"
                    value={differentiators}
                    onChange={(e) => setDifferentiators(e.target.value)}
                    rows={2}
                    placeholder="למה לקוחות בוחרים בכם ולא במתחרים?"
                  />
                </div>
                <div>
                  <Label>הערכים שמייצגים אתכם</Label>
                  <p className="text-xs text-navy-400 mb-2">בחרו כמה שמתאים.</p>
                  <div className="flex flex-wrap gap-2">
                    {BUSINESS_VALUES.map((v) => {
                      const on = values.includes(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => toggleValue(v)}
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
                  <Label htmlFor="w-tone">טון הדיבור מול לקוחות</Label>
                  <Input
                    id="w-tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="לדוגמה: חם ואישי / מקצועי / צעיר וקליל"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <StepHead
                  title="התחושה והמטרה"
                  subtitle="מה שחשוב לכם שיישאר אצל הלקוח."
                />
                <div>
                  <Label htmlFor="w-feeling">
                    איזו תחושה תרצו שלקוח ייצא איתה מהמפגש?
                  </Label>
                  <Textarea
                    id="w-feeling"
                    value={feeling}
                    onChange={(e) => setFeeling(e.target.value)}
                    rows={2}
                    placeholder="לדוגמה: שקיבלו יחס אישי ומרגישים בטוחים בבחירה"
                  />
                </div>
                <div>
                  <Label htmlFor="w-goals">מטרות לתקופה הקרובה</Label>
                  <Textarea
                    id="w-goals"
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    rows={2}
                    placeholder="מה חשוב לך להשיג?"
                  />
                </div>
                <div>
                  <Label htmlFor="w-city">עיר (לתחזית מזג האוויר בדף הבית)</Label>
                  <Input
                    id="w-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="לדוגמה: תל אביב"
                  />
                </div>
              </div>
            )}

            <FormError message={error} />

            {step > 0 && (
              <div className="flex items-center justify-between gap-3 mt-7">
                <button
                  type="button"
                  onClick={back}
                  className="text-sm text-navy-500 hover:text-navy-800 inline-flex items-center gap-1"
                >
                  <Icon name="arrow-end" size={16} className="rtl:-scale-x-100" />
                  חזרה
                </button>
                {step < STEPS - 1 ? (
                  <Button onClick={next}>הבא</Button>
                ) : (
                  <Button onClick={() => save.mutate()} disabled={save.isPending}>
                    {save.isPending ? <Spinner /> : "סיום והתחלה"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-1">
      <h2 className="font-display text-2xl text-navy-900">{title}</h2>
      <p className="text-sm text-navy-500 mt-1">{subtitle}</p>
    </div>
  );
}
