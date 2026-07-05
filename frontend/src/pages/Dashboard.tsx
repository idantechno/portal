import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { HomeBriefing } from "../components/HomeBriefing";

// Resolves the page an entitled agent opens. The chat agent opens the
// business's inbox (where the owner watches the bot); documents opens its tool.
function agentLink(
  key: string,
  businessId: string | undefined,
): string | undefined {
  if (key === "main") return "/app/agents/main";
  if (key === "documents") return "/app/agents/documents";
  if (key === "ideas") return "/app/agents/ideas";
  if (key === "designer") return "/app/agents/designer";
  if (key === "reminders") return "/app/agents/reminders";
  if (key === "chat")
    return businessId ? `/app/businesses/${businessId}/inbox` : undefined;
  // Every other (generative) agent opens the agent studio inside the business.
  return businessId ? `/app/businesses/${businessId}/agents` : undefined;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const staff = isPlatformStaff(user?.role);

  const businesses = useQuery({
    queryKey: ["businesses"],
    queryFn: businessesApi.list,
  });

  const myAgents = useQuery({
    queryKey: ["me", "agents"],
    queryFn: agentsApi.mine,
  });

  // Clients have one implicit business; use it to route the chat agent.
  const firstBizId = businesses.data?.[0]?.id;
  const agentCards = (myAgents.data ?? [])
    .map((a) => ({ ...a, to: agentLink(a.key, firstBizId) }))
    .filter((a): a is typeof a & { to: string } => Boolean(a.to));

  // The calm home briefing is the client owner's view: it needs a single
  // business and the chat agent (it summarizes conversations + leads).
  const hasChat = (myAgents.data ?? []).some((a) => a.key === "chat");
  const showBriefing = !!firstBizId && hasChat;

  const [showPw, setShowPw] = useState(false);

  // Platform staff have no account-level dashboard of their own — their
  // "my businesses" list is always empty (they aren't members of any tenant).
  // Skip the redundant landing hop and open the admin cockpit directly.
  if (staff) {
    return <Navigate to="/app/admin" replace />;
  }

  // One home, not two: a client lands on (and the logo returns to) their
  // business cockpit.
  if (businesses.isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-navy-400 text-sm">
        {t("common.loading")}
      </div>
    );
  }
  if (firstBizId) {
    return <Navigate to={`/app/businesses/${firstBizId}/home`} replace />;
  }

  return (
    <div className="min-h-dvh bg-cream-50">
      <header className="bg-navy-900 sticky top-0 z-10 shadow-[0_8px_24px_-16px_rgba(1,20,39,0.6)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/icon.png" alt="" className="h-8 w-8" />
            <span className="font-display text-2xl text-cream-100">
              Portal Studio
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-sm shrink-0">
            <span className="text-brand-200 font-medium hidden sm:inline">{user?.name}</span>
            <button
              className="text-navy-200 hover:text-white transition-colors"
              onClick={() => setShowPw(true)}
            >
              {t("account.changePassword")}
            </button>
            <button
              className="text-navy-200 hover:text-coral-300 transition-colors"
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {showBriefing && firstBizId && (
          <HomeBriefing businessId={firstBizId} name={user?.name} />
        )}

        {agentCards.length > 0 && (
          <section className="mb-10">
            {showBriefing ? (
              <h2 className="text-sm font-semibold text-brand-600 mb-4">
                {t("dashboard.yourAgents")}
              </h2>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-brand-600 mb-1">
                  {t("dashboard.yourAgents")}
                </h2>
                <p className="text-2xl font-semibold text-navy-900 mb-5">
                  {t("dashboard.whatToday")}
                </p>
              </>
            )}
            <div className="grid gap-3.5">
              {agentCards.map((a) => {
                const tone =
                  a.key === "documents"
                    ? "bg-teal-100 text-teal-700"
                    : a.key === "chat"
                      ? "bg-brand-100 text-brand-700"
                      : "bg-coral-100 text-coral-700";
                return (
                  <Link key={a.key} to={a.to} className="block group">
                    <Card className="p-5 flex items-center gap-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_40px_-22px_rgba(1,20,39,0.4)]">
                      <div
                        className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${tone}`}
                      >
                        {a.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-base text-navy-900 mb-0.5">
                          {a.name}
                        </div>
                        <div className="text-sm text-navy-400">
                          {a.description}
                        </div>
                      </div>
                      <div className="text-brand-500 text-xl shrink-0 transition-transform group-hover:-translate-x-1 rtl:rotate-180">
                        →
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {agentCards.length === 0 && !myAgents.isLoading && (
          <Card className="p-12 text-center text-navy-400">
            {t("dashboard.noAgents")}
          </Card>
        )}
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={t("account.changePassword")}
        className="p-6 w-full max-w-md mx-4"
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
