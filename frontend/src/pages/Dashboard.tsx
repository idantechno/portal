import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { businessesApi } from "../api/businesses";
import { authApi } from "../api/auth";
import { agentsApi } from "../api/agents";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/auth";
import { isPlatformStaff } from "../lib/roles";
import {
  Button,
  Card,
  FormError,
  Input,
  Label,
  Spinner,
} from "../components/ui";

// Maps an entitled agent to the page that opens it. Agents without a tool page
// (e.g. the always-on chat agent) simply don't appear in the dashboard tools.
const AGENT_ROUTES: Record<string, string | undefined> = {
  documents: "/app/agents/documents",
};

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

  const myAgents = useQuery({
    queryKey: ["me", "agents"],
    queryFn: agentsApi.mine,
  });
  const tools = (myAgents.data ?? []).filter((a) => AGENT_ROUTES[a.key]);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const staff = isPlatformStaff(user?.role);

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
              onClick={() => setShowPw(true)}
            >
              {t("account.changePassword")}
            </button>
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
        {staff && (
          <Link to="/app/admin" className="block mb-8">
            <Card className="p-6 bg-neutral-900 text-white hover:bg-neutral-800 transition-colors flex items-center gap-5">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl shrink-0">
                🛡️
              </div>
              <div className="flex-1">
                <div className="font-semibold text-base mb-0.5">
                  {t("admin.title")}
                </div>
                <div className="text-sm text-neutral-300">
                  {t("admin.dashboardHint")}
                </div>
              </div>
              <div className="text-sm font-medium shrink-0">→</div>
            </Card>
          </Link>
        )}

        {tools.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
              כלים
            </h2>
            <div className="space-y-3">
              {tools.map((a) => (
                <Link key={a.key} to={AGENT_ROUTES[a.key]!} className="block">
                  <Card className="p-6 hover:border-brand-300 hover:shadow-md transition-all flex items-center gap-5">
                    <div className="h-12 w-12 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center text-2xl shrink-0">
                      {a.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-base mb-0.5">
                        {a.name}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {a.description}
                      </div>
                    </div>
                    <div className="text-brand-700 text-sm font-medium shrink-0">
                      {t("dashboard.open")} →
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

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
      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      authApi.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => {
      setDone(true);
      setCurrent("");
      setNext("");
    },
    onError: (err) => setError(apiErrorMessage(err, t("account.changeFailed"))),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mut.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {t("account.changePassword")}
          </h2>
          <button
            className="text-neutral-400 hover:text-neutral-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {done ? (
          <div className="space-y-4">
            <div className="text-sm text-green-700">{t("account.changed")}</div>
            <Button variant="secondary" onClick={onClose}>
              {t("common.back")}
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="cur-pw">{t("account.currentPassword")}</Label>
              <Input
                id="cur-pw"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="new-pw">{t("account.newPassword")}</Label>
              <Input
                id="new-pw"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={8}
                dir="ltr"
              />
            </div>
            <FormError message={error} />
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? <Spinner /> : t("account.change")}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
