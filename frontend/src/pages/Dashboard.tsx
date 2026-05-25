import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../api/businesses";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/auth";
import {
  Button,
  Card,
  FormError,
  Input,
  Label,
  Spinner,
} from "../components/ui";

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();

  const businesses = useQuery({
    queryKey: ["businesses"],
    queryFn: businessesApi.list,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () =>
      businessesApi.create({ name, slug: slug.trim() ? slug.trim() : undefined }),
    onSuccess: (biz) => {
      qc.invalidateQueries({ queryKey: ["businesses"] });
      navigate(`/app/businesses/${biz.id}/files`);
    },
    onError: (err) => setCreateError(apiErrorMessage(err, "Failed to create")),
  });

  function submitCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    createMut.mutate();
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="font-semibold text-brand-700">{t("appName")}</div>
          <div className="flex items-center gap-3 text-sm">
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

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t("dashboard.myBusinesses")}</h1>
          {!showCreate && (
            <Button onClick={() => setShowCreate(true)}>
              {t("dashboard.createBusiness")}
            </Button>
          )}
        </div>

        {showCreate && (
          <Card className="p-6 mb-6">
            <form onSubmit={submitCreate} className="space-y-4 max-w-md">
              <div>
                <Label htmlFor="biz-name">{t("dashboard.businessName")}</Label>
                <Input
                  id="biz-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="biz-slug">{t("dashboard.businessSlug")}</Label>
                <Input
                  id="biz-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="auto"
                  dir="ltr"
                />
              </div>
              <FormError message={createError} />
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending ? <Spinner /> : t("dashboard.createBusiness")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowCreate(false);
                    setName("");
                    setSlug("");
                    setCreateError(null);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {businesses.isLoading && (
          <div className="text-neutral-500 text-sm">{t("common.loading")}</div>
        )}
        {businesses.data && businesses.data.length === 0 && !showCreate && (
          <Card className="p-12 text-center text-neutral-500">
            {t("dashboard.noBusinesses")}
          </Card>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {businesses.data?.map((biz) => (
            <Link
              to={`/app/businesses/${biz.id}/files`}
              key={biz.id}
              className="block"
            >
              <Card className="p-5 hover:border-brand-300 hover:shadow-md transition-all">
                <div className="font-semibold mb-1">{biz.name}</div>
                <div className="text-xs text-neutral-500 mb-3" dir="ltr">
                  /{biz.slug}
                </div>
                <div className="text-brand-700 text-sm font-medium">
                  {t("dashboard.open")} →
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
