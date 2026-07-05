import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { businessesApi } from "../../api/businesses";
import { useAuthStore } from "../../store/auth";
import { NotificationBell } from "../../components/NotificationBell";
import { businessThemeVars } from "../../lib/theme";

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
  const navigate = useNavigate();
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId!;
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // Drawer state for narrow viewports. On lg+ the sidebar is always visible and
  // this is ignored. Tapping any nav link closes it (handled on the <nav>).
  const [navOpen, setNavOpen] = useState(false);

  const biz = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessesApi.get(businessId),
  });

  const viaStaff = biz.data?.viaPlatformStaff ?? false;
  const branding = biz.data?.branding ?? null;
  const themeVars = businessThemeVars(branding);

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
      items: [
        { to: "billing", label: "חיוב", icon: "🧾", show: true },
        { to: "expenses", label: "מעקב הוצאות", icon: "💸", show: true },
      ],
    },
    {
      title: "צמיחה",
      items: [
        { to: "growth", label: "סטטוס וצמיחה", icon: "📈", show: true },
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
        ? "bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)] font-medium shadow-sm"
        : "text-white/70 hover:bg-white/10 hover:text-white"
    }`;

  const sidebar = (
    <aside
      className="text-white overflow-y-auto flex flex-col h-full w-[268px] max-w-[85vw]"
      style={{ backgroundColor: "var(--brand-sidebar)" }}
    >
      <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 min-h-16 gap-2">
        <Link
          to={`/app/businesses/${businessId}/home`}
          className="flex items-center gap-3 hover:opacity-90 transition-opacity min-w-0"
        >
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt=""
              className="h-9 w-9 rounded-xl object-contain bg-white/90 p-0.5 shrink-0"
            />
          ) : (
            <img src="/icon.png" alt="" className="h-8 w-8 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-display text-lg leading-tight truncate">
              {biz.data?.name ?? "Portal Studio"}
            </div>
            {branding?.slogan && (
              <div className="text-[11px] text-white/50 truncate">
                {branding.slogan}
              </div>
            )}
          </div>
        </Link>
        {/* Close button only shows inside the mobile drawer. */}
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          aria-label="סגור תפריט"
          className="lg:hidden shrink-0 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M6 6l8 8M14 6l-8 8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="p-4 flex-1">
        <nav className="space-y-5" onClick={() => setNavOpen(false)}>
          {groups.map((group) => {
            const visible = group.items.filter((it) => it.show);
            if (visible.length === 0) return null;
            return (
              <div key={group.title}>
                <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {visible.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      className={linkClass}
                      end={!it.absolute}
                    >
                      <span className="text-base" aria-hidden>
                        {it.icon}
                      </span>
                      {it.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
      <div className="px-4 pb-4 pt-4 border-t border-white/10 text-sm">
        <div className="px-3 py-1.5 text-white/80 font-medium truncate">
          {user?.name}
        </div>
        <button
          className="w-full text-start rounded-xl px-3 py-1.5 text-white/50 hover:bg-coral-500/20 hover:text-coral-200 transition-colors"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          התנתקות
        </button>
      </div>
    </aside>
  );

  return (
    <div
      className="h-dvh overflow-hidden bg-cream-50 grid grid-cols-1 lg:grid-cols-[268px_1fr]"
      style={themeVars}
    >
      {/* Desktop: sidebar is a static grid column. */}
      <div className="hidden lg:block h-full min-h-0">{sidebar}</div>

      {/* Mobile: sidebar is an off-canvas drawer. */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-navy-900/50"
            onClick={() => setNavOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 start-0 shadow-2xl animate-[slideIn_.15s_ease-out]">
            {sidebar}
          </div>
        </div>
      )}

      <main className="overflow-auto min-h-0 flex flex-col">
        <div className="h-14 px-4 sm:px-6 flex items-center gap-3 border-b border-navy-100 bg-white/70 backdrop-blur sticky top-0 z-20">
          {/* Hamburger — mobile only. */}
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="פתח תפריט"
            className="lg:hidden -ms-1 rounded-lg p-2 text-navy-600 hover:bg-navy-100"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              <path
                d="M4 6h14M4 11h14M4 16h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <Link
            to={`/app/businesses/${businessId}/home`}
            className="lg:hidden font-display text-navy-800 truncate"
          >
            {biz.data?.name ?? "Portal Studio"}
          </Link>
          <div className="ms-auto">
            <NotificationBell businessId={businessId} />
          </div>
        </div>
        {viaStaff && (
          <div className="bg-coral-400 text-white text-xs sm:text-sm px-4 py-2.5 flex items-center justify-between gap-2">
            <span className="min-w-0">
              ⚠️ אתה צופה בעסק זה כצוות פלטפורמה — כל פעולה מתועדת.
            </span>
            <Link
              to="/app/admin/businesses"
              className="underline font-medium hover:text-cream-100 shrink-0"
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
