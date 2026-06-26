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
    <div className="h-screen overflow-hidden bg-neutral-50 grid grid-cols-[260px_1fr]">
      <aside className="border-e border-neutral-200 bg-white overflow-y-auto flex flex-col">
        <div className="h-14 px-5 flex items-center border-b border-neutral-100">
          <Link to="/app" className="font-semibold text-brand-700 hover:underline">
            {t("appName")}
          </Link>
        </div>
        <div className="p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
            {t("nav.businesses")}
          </div>
          <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-3 mb-4">
            <div className="text-sm font-semibold truncate">
              {biz.data?.name ?? "—"}
            </div>
            <div className="text-xs text-neutral-500 truncate" dir="ltr">
              /{biz.data?.slug ?? ""}
            </div>
          </div>
          <nav className="space-y-1">
            {navItems.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm ${
                    isActive
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-neutral-700 hover:bg-neutral-50"
                  }`
                }
              >
                {it.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="px-4 mt-auto pt-6 border-t border-neutral-100 text-sm text-neutral-600">
          <div className="px-3 py-2">{user?.name}</div>
          <button
            className="w-full text-start rounded-md px-3 py-2 text-neutral-500 hover:bg-neutral-50"
            onClick={() =>
              i18n.changeLanguage(i18n.language === "he" ? "en" : "he")
            }
          >
            {t("common.language")}:{" "}
            {i18n.language === "he" ? "עברית" : "English"}
          </button>
          <button
            className="w-full text-start rounded-md px-3 py-2 text-neutral-500 hover:bg-red-50 hover:text-red-700"
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
          <div className="bg-amber-500 text-amber-950 text-sm px-4 py-2 flex items-center justify-between">
            <span>⚠️ {t("admin.viewingAsStaff")}</span>
            <Link to="/app/admin/businesses" className="underline font-medium">
              {t("admin.title")}
            </Link>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
