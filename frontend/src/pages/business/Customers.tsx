import { useParams, useSearchParams } from "react-router-dom";
import CustomersPanel from "../../components/CustomersPanel";
import { PageHeader } from "../../components/ui";
import { Icon, type IconName } from "../../components/icons";
import type { CustomerStage } from "../../api/customers";

const TABS: { key: CustomerStage; label: string; icon: IconName }[] = [
  { key: "lead", label: "לידים", icon: "leads" },
  { key: "customer", label: "לקוחות", icon: "users" },
];

/**
 * The single אנשי קשר screen — one person, one place. The לידים/לקוחות tabs are
 * driven entirely by `?stage=` in the URL (default `customer`, preserving what
 * the old "לקוחות" nav item showed), so the לידים nav entry can deep-link
 * straight into the leads tab. Each tab reuses {@link CustomersPanel}, filtered
 * to that lifecycle stage.
 */
export default function Customers() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const [params, setParams] = useSearchParams();
  const stage: CustomerStage =
    params.get("stage") === "lead" ? "lead" : "customer";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="אנשי קשר"
        subtitle="הלידים והלקוחות שלך במקום אחד. כל סוכן עובד מכאן על מה שרלוונטי לו."
      />

      {/* Tabs — synced to ?stage= so nav deep-links and back/forward just work. */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-navy-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setParams({ stage: t.key }, { replace: true })}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
              stage === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Remount per stage so the panel's sort/state re-seed cleanly. */}
      <CustomersPanel key={stage} businessId={businessId} stage={stage} />
    </div>
  );
}
