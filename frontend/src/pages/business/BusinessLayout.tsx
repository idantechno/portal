import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { businessesApi } from "../../api/businesses";
import { useAuthStore } from "../../store/auth";
import { isPlatformStaff } from "../../lib/roles";
import { NotificationBell } from "../../components/NotificationBell";
import { Icon } from "../../components/icons";
import type { IconName } from "../../components/icons";
import { businessThemeVars } from "../../lib/theme";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
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
  const location = useLocation();
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId!;
  const homePath = `/app/businesses/${businessId}/home`;
  const onHome = location.pathname === homePath;
  // Back goes to the previous in-app screen. When there's no history to pop
  // (deep link / fresh app launch), fall back to the business home so the
  // control never strands the user or leaves the app.
  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate(homePath);
  };
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
  const staff = isPlatformStaff(user?.role);
  const branding = biz.data?.branding ?? null;
  const themeVars = businessThemeVars(branding);

  // Sidebar = business "departments". Individual agents do NOT live here — they
  // are all reached from the single "סוכנים" hub (the agents page) so there is
  // one place for every agent.
  const groups: NavGroup[] = [
    {
      title: "מוקד",
      items: [
        { to: "home", label: "בית", icon: "home", show: true },
        { to: "inbox", label: "שיחות", icon: "chat", show: true },
        { to: "contacts/lead", label: "לידים", icon: "leads", show: true },
        { to: "contacts/customer", label: "לקוחות", icon: "user", show: true },
      ],
    },
    {
      title: "עבודה",
      items: [
        { to: "agents", label: "סוכנים", icon: "agents", show: true },
        { to: "calendar", label: "יומן", icon: "calendar", show: true },
        { to: "appointments", label: "תורים", icon: "clock", show: true },
        { to: "tasks", label: "משימות", icon: "tasks", show: true },
      ],
    },
    {
      title: "מידע ומסמכים",
      items: [
        { to: "filing", label: "מסמכים", icon: "doc", show: true },
        { to: "files", label: "מידע העסק", icon: "folder", show: true },
      ],
    },
    {
      title: "כספים",
      items: [
        { to: "billing", label: "חיוב", icon: "receipt", show: true },
        { to: "expenses", label: "מעקב הוצאות", icon: "wallet", show: true },
      ],
    },
    {
      title: "צמיחה",
      items: [
        { to: "growth", label: "סטטוס וצמיחה", icon: "growth", show: true },
        { to: "automations", label: "אוטומציות", icon: "bolt", show: true },
        { to: "integrations", label: "אינטגרציות", icon: "link", show: true },
      ],
    },
    {
      // Operator-only. Clients never see config/settings — the operator manages
      // everything by entering the business from the admin console (viaStaff).
      title: "ניהול",
      items: [
        { to: "members", label: "צוות", icon: "users", show: viaStaff },
        {
          to: "channels/whatsapp",
          label: "WhatsApp",
          icon: "whatsapp",
          show: viaStaff,
        },
        { to: "settings", label: "הגדרות", icon: "settings", show: viaStaff },
      ],
    },
  ];

  // The active row is a filled accent pill; inactive rows are text-only until
  // hovered. Icons inherit the row's colour, so the whole nav shifts as one.
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-[background-color,color] duration-150 ease-[var(--ease-out-brand)] ${
      isActive
        ? "bg-[var(--brand-accent)] text-[var(--brand-accent-contrast)] font-medium shadow-[0_2px_10px_-4px_rgba(0,0,0,0.5)]"
        : "text-white/65 hover:bg-white/[0.08] hover:text-white"
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
          className="lg:hidden shrink-0 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Icon name="close" size={20} />
        </button>
      </div>
      {/* Platform staff are viewing a tenant from the outside — give them a
          persistent way back to the admin console (system / businesses /
          users / audit). Clients never see this. */}
      {staff && (
        <div className="px-4 pt-4">
          <Link
            to="/app/admin"
            onClick={() => setNavOpen(false)}
            className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium text-white ring-1 ring-white/10 transition-colors hover:bg-white/[0.16]"
          >
            <Icon name="shield" size={18} className="opacity-90" />
            אזור ניהול
            <Icon name="arrow-end" size={16} className="ms-auto opacity-70" />
          </Link>
        </div>
      )}
      <div className="p-4 flex-1">
        <nav className="space-y-5" onClick={() => setNavOpen(false)}>
          {groups.map((group) => {
            const visible = group.items.filter((it) => it.show);
            if (visible.length === 0) return null;
            return (
              <div key={group.title}>
                <div className="eyebrow px-3 mb-1.5 text-white/35">
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
                      <Icon name={it.icon} size={19} className="opacity-90" />
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
        <div className="flex items-center gap-3 px-3 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70">
            <Icon name="user" size={17} />
          </span>
          <span className="min-w-0 truncate font-medium text-white/80">
            {user?.name}
          </span>
        </div>
        <button
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-white/50 transition-colors hover:bg-coral-500/20 hover:text-coral-200"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <Icon name="logout" size={17} className="ms-1.5" />
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
            className="lg:hidden -ms-1 rounded-lg p-2 text-navy-600 hover:bg-navy-100 transition-colors"
          >
            <Icon name="menu" size={22} />
          </button>
          {/* Back — mobile only, hidden on the home screen. Gives every inner
              page a way back without opening the drawer. */}
          {!onHome && (
            <button
              type="button"
              onClick={goBack}
              aria-label="חזור"
              className="lg:hidden rounded-lg p-2 text-navy-600 hover:bg-navy-100 transition-colors"
            >
              <Icon name="arrow-start" size={22} />
            </button>
          )}
          <Link
            to={homePath}
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
            <span className="flex min-w-0 items-center gap-2">
              <Icon name="warning" size={17} className="shrink-0" />
              <span className="min-w-0">
                אתה צופה בעסק זה כצוות פלטפורמה — כל פעולה מתועדת.
              </span>
            </span>
            <Link
              to="/app/admin/businesses"
              className="underline font-medium hover:text-cream-100 shrink-0"
            >
              ניהול
            </Link>
          </div>
        )}
        <div className="app-canvas flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
