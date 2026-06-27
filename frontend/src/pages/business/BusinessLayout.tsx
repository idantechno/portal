import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { businessesApi } from "../../api/businesses";
import { useAuthStore } from "../../store/auth";
import { canManageBusiness } from "../../lib/roles";

export default function BusinessLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId!;
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
  });

  const canManage = canManageBusiness(biz.data?.myRole, user?.role);
  const viaStaff = biz.data?.viaPlatformStaff ?? false;

  const navItems = [
    { to: "inbox", label: t("nav.inbox"), show: true },
    { to: "leads", label: t("nav.leads"), show: true },
    { to: "files", label: t("nav.files"), show: true },
    { to: "members", label: t("nav.team"), show: canManage },
    { to: "channels/whatsapp", label: t("nav.whatsapp"), show: canManage },
    { to: "settings", label: t("nav.settings"), show: canManage },
  ].filter((it) => it.show);

  return (
    <div className="h-dvh overflow-hidden bg-cream-50 grid grid-cols-[268px_1fr]">
      <aside className="border-e border-navy-100 bg-white overflow-y-auto flex flex-col">
        <div className="h-16 px-5 flex items-center border-b border-navy-100">
          <Link
            to="/app"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <img src="/icon.png" alt="" className="h-7 w-7" />
            <span className="font-display text-xl text-navy-900">
              Portal Studio
            </span>
          </Link>
        </div>
        <div className="p-4">
          <div className="rounded-2xl bg-cream-50 border border-navy-100 p-3.5 mb-5">
            <div className="text-sm font-semibold text-navy-900 truncate">
              {biz.data?.name ?? "—"}
            </div>
            <div className="text-xs text-navy-400 truncate" dir="ltr">
              /{biz.data?.slug ?? ""}
            </div>
          </div>
          <nav className="space-y-1">
            {navItems.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  `block rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-navy-600 hover:bg-cream-50 hover:text-navy-900"
                  }`
                }
              >
                {it.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="px-4 mt-auto pt-6 border-t border-navy-100 text-sm">
          <div className="px-3.5 py-2 text-navy-700 font-medium">{user?.name}</div>
          <button
            className="w-full text-start rounded-xl px-3.5 py-2 text-navy-400 hover:bg-cream-50 transition-colors"
            onClick={() =>
              i18n.changeLanguage(i18n.language === "he" ? "en" : "he")
            }
          >
            {t("common.language")}:{" "}
            {i18n.language === "he" ? "עברית" : "English"}
          </button>
          <button
            className="w-full text-start rounded-xl px-3.5 py-2 text-navy-400 hover:bg-coral-50 hover:text-coral-600 transition-colors"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            {t("auth.logout")}
          </button>
        </div>
      </aside>
      <main className="overflow-auto min-h-0">
        {viaStaff && (
          <div className="bg-coral-400 text-white text-sm px-4 py-2.5 flex items-center justify-between">
            <span>⚠️ {t("admin.viewingAsStaff")}</span>
            <Link
              to="/app/admin/businesses"
              className="underline font-medium hover:text-cream-100"
            >
              {t("admin.title")}
            </Link>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
