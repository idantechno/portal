import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { businessesApi } from "../api/businesses";
import { Button, Card, Spinner } from "../components/ui";
import { useAuthStore } from "../store/auth";
import DocumentsAgent from "./business/DocumentsAgent";

export default function AgentDocumentsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const businesses = useQuery({
    queryKey: ["businesses"],
    queryFn: businessesApi.list,
  });

  const list = useMemo(() => businesses.data ?? [], [businesses.data]);
  const activeId = selectedId ?? list[0]?.id ?? null;
  const activeBusiness = list.find((b) => b.id === activeId) ?? null;

  return (
    <div className="h-screen flex flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white shrink-0">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/app" className="font-semibold text-brand-700">
              {t("appName")}
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-sm font-medium">סוכן מסמכים</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {list.length > 1 && activeBusiness && (
              <select
                value={activeBusiness.id}
                onChange={(e) => setSelectedId(e.target.value)}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
              >
                {list.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <span className="text-neutral-600">{user?.name}</span>
            <button
              className="text-neutral-500 hover:text-neutral-800"
              onClick={() =>
                i18n.changeLanguage(i18n.language === "he" ? "en" : "he")
              }
            >
              {i18n.language === "he" ? "EN" : "עב"}
            </button>
            <button
              className="text-neutral-500 hover:text-red-600"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              {t("auth.logout")}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        {businesses.isLoading && (
          <div className="h-full flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {!businesses.isLoading && list.length === 0 && (
          <div className="h-full flex items-center justify-center px-4">
            <Card className="p-8 max-w-md text-center space-y-4">
              <h2 className="text-lg font-semibold">צריך עסק כדי להתחיל</h2>
              <p className="text-neutral-600 text-sm">
                סוכן המסמכים פועל עבור עסק שלך — שם העסק, הלוגו, וההגדרות שלו
                מתווספים אוטומטית לכל מסמך. צור עסק כדי להתחיל להפיק מסמכים.
              </p>
              <Button onClick={() => navigate("/app")}>חזרה לדשבורד</Button>
            </Card>
          </div>
        )}

        {activeId && <DocumentsAgent businessId={activeId} />}
      </main>
    </div>
  );
}
