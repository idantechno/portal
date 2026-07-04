import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { businessesApi } from "../../api/businesses";
import { useAuthStore } from "../../store/auth";
import { NotificationBell } from "../../components/NotificationBell";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  show: boolean;
  /** Absolute link (outside the business layout) instead of relative. */
  absolute?: boolean;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

export default function BusinessLayout() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId!;
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
  });

  const viaStaff = biz.data?.viaPlatformStaff ?? false;

  // Sidebar = business "departments". Individual agents do NOT live here — they
  // are all reached from the single "סוכנים" hub (the agents page) so there is
  // one place for every agent.
  const groups: NavGroup[] = [
    {
      title: "מוקד",
      items: [
        { to: "home", label: "בית", icon: "🏠", show: true },
        { to: "inbox", label: "שיחות", icon: "💬", show: true },
        { to: "leads", label: "לידים", icon: "🤝", show: true },
      ],
    },
    {
      title: "עבודה",
      items: [
        { to: "agents", label: "סוכנים", icon: "🤖", show: true },
        { to: "calendar", label: "יומן", icon: "📅", show: true },
        { to: "tasks", label: "משימות", icon: "✅", show: true },
      ],
    },
    {
      title: "מידע ומסמכים",
      items: [
        { to: "filing", label: "מסמכים", icon: "🗂️", show: true },
        { to: "files", label: "קבצי הקשר", icon: "📁", show: true },
      ],
    },
    {
      title: "כספים",
      items: [{ to: "billing", label: "חיוב", icon: "🧾", show: true }],
    },
    {
      title: "צמיחה",
      items: [
        { to: "automations", label: "אוטומציות", icon: "⚡", show: true },
        { to: "integrations", label: "אינטגרציות", icon: "🔗", show: true },
      ],
    },
    {
      // Operator-only. Clients never see config/settings — the operator manages
      // everything by entering the business from the admin console (viaStaff).
      title: "ניהול",
      items: [
        { to: "members", label: "צוות", icon: "👥", show: viaStaff },
        {
          to: "channels/whatsapp",
          label: "WhatsApp",
          icon: "📱",
          show: viaStaff,
        },
        { to: "settings", label: "הגדרות", icon: "⚙️", show: viaStaff },
      ],
    },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
      isActive
        ? "bg-brand-50 text-brand-700 font-medium"
        : "text-navy-600 hover:bg-cream-50 hover:text-navy-900"
    }`;

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
        <div className="p-4 flex-1">
          <div className="rounded-2xl bg-cream-50 border border-navy-100 p-3.5 mb-5">
            <div className="text-sm font-semibold text-navy-900 truncate">
              {biz.data?.name ?? "—"}
            </div>
            <div className="text-xs text-navy-400 truncate" dir="ltr">
              /{biz.data?.slug ?? ""}
            </div>
          </div>
          <nav className="space-y-5">
            {groups.map((group) => {
              const visible = group.items.filter((it) => it.show);
              if (visible.length === 0) return null;
              return (
                <div key={group.title}>
                  <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy-300">
                    {group.title}
                  </div>
                  <div className="space-y-0.5">
                    {visible.map((it) =>
                      it.absolute ? (
                        <NavLink key={it.to} to={it.to} className={linkClass}>
                          <span className="text-base">{it.icon}</span>
                          {it.label}
                        </NavLink>
                      ) : (
                        <NavLink key={it.to} to={it.to} className={linkClass} end>
                          <span className="text-base">{it.icon}</span>
                          {it.label}
                        </NavLink>
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
        <div className="px-4 pb-4 pt-4 border-t border-navy-100 text-sm">
          <div className="px-3 py-1.5 text-navy-700 font-medium truncate">
            {user?.name}
          </div>
          <button
            className="w-full text-start rounded-xl px-3 py-1.5 text-navy-400 hover:bg-cream-50 transition-colors"
            onClick={() =>
              i18n.changeLanguage(i18n.language === "he" ? "en" : "he")
            }
          >
            {i18n.language === "he" ? "English" : "עברית"}
          </button>
          <button
            className="w-full text-start rounded-xl px-3 py-1.5 text-navy-400 hover:bg-coral-50 hover:text-coral-600 transition-colors"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            התנתקות
          </button>
        </div>
      </aside>
      <main className="overflow-auto min-h-0 flex flex-col">
        <div className="h-14 px-6 flex items-center justify-end gap-3 border-b border-navy-100 bg-white/70 backdrop-blur sticky top-0 z-20">
          <NotificationBell businessId={businessId} />
        </div>
        {viaStaff && (
          <div className="bg-coral-400 text-white text-sm px-4 py-2.5 flex items-center justify-between">
            <span>⚠️ אתה צופה בעסק זה כצוות פלטפורמה — כל פעולה מתועדת.</span>
            <Link
              to="/app/admin/businesses"
              className="underline font-medium hover:text-cream-100"
            >
              ניהול
            </Link>
          </div>
        )}
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
