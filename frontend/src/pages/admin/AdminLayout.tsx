import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth";

export default function AdminLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const navItems = [
    { to: "overview", label: t("admin.overview") },
    { to: "businesses", label: t("admin.businesses") },
    { to: "users", label: t("admin.users") },
    { to: "audit", label: t("admin.audit") },
  ];

  return (
    <div className="h-dvh overflow-hidden bg-cream-50 grid grid-cols-[268px_1fr]">
      <aside className="bg-navy-900 text-navy-100 overflow-y-auto flex flex-col">
        <div className="px-6 pt-6 pb-5">
          <div className="font-display text-2xl text-cream-100 leading-none">
            Portal Studio
          </div>
          <div className="text-xs text-brand-300 mt-1.5 tracking-wide">
            {t("admin.title")}
          </div>
        </div>
        <div className="px-4 flex-1">
          <nav className="space-y-1">
            {navItems.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  `block rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-white/10 text-white font-medium"
                      : "text-navy-200 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                {it.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="px-4 pb-4 border-t border-white/10 pt-4 text-sm">
          <Link
            to="/app"
            className="block rounded-xl px-3.5 py-2.5 text-navy-200 hover:bg-white/5 hover:text-white transition-colors"
          >
            ← {t("admin.backToApp")}
          </Link>
          <div className="px-3.5 py-2 text-navy-300 truncate">{user?.name}</div>
          <button
            className="w-full text-start rounded-xl px-3.5 py-2 text-navy-300 hover:bg-white/5 transition-colors"
            onClick={() =>
              i18n.changeLanguage(i18n.language === "he" ? "en" : "he")
            }
          >
            {t("common.language")}: {i18n.language === "he" ? "עברית" : "English"}
          </button>
          <button
            className="w-full text-start rounded-xl px-3.5 py-2 text-coral-300 hover:bg-coral-500/15 transition-colors"
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
        <Outlet />
      </main>
    </div>
  );
}
