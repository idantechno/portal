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
    <div className="h-screen overflow-hidden bg-neutral-50 grid grid-cols-[260px_1fr]">
      <aside className="border-e border-neutral-200 bg-neutral-900 text-neutral-100 overflow-y-auto flex flex-col">
        <div className="h-14 px-5 flex items-center border-b border-white/10">
          <span className="font-semibold">{t("admin.title")}</span>
        </div>
        <div className="p-4 flex-1">
          <nav className="space-y-1">
            {navItems.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm ${
                    isActive
                      ? "bg-white/10 text-white font-medium"
                      : "text-neutral-300 hover:bg-white/5"
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
            className="block rounded-md px-3 py-2 text-neutral-300 hover:bg-white/5"
          >
            ← {t("admin.backToApp")}
          </Link>
          <div className="px-3 py-2 text-neutral-400 truncate">
            {user?.name}
          </div>
          <button
            className="w-full text-start rounded-md px-3 py-2 text-neutral-400 hover:bg-white/5"
            onClick={() =>
              i18n.changeLanguage(i18n.language === "he" ? "en" : "he")
            }
          >
            {t("common.language")}: {i18n.language === "he" ? "עברית" : "English"}
          </button>
          <button
            className="w-full text-start rounded-md px-3 py-2 text-red-300 hover:bg-red-500/10"
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
