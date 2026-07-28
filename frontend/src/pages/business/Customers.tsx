import { useParams } from "react-router-dom";
import CustomersPanel from "../../components/CustomersPanel";

export default function Customers() {
  const { businessId = "" } = useParams<{ businessId: string }>();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <h1 className="mb-1 text-2xl font-bold">לקוחות</h1>
        <p className="text-sm text-neutral-600">
          הלקוחות שאתה עובד איתם. מכאן כל סוכן עובד על מה שרלוונטי לו — בריפים,
          אסטרטגיות ועוד.
        </p>
      </header>

      <CustomersPanel businessId={businessId} />
    </div>
  );
}
