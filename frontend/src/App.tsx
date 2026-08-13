import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import { authApi } from "./api/auth";
import { isPlatformStaff } from "./lib/roles";
import Login from "./pages/Login";

// Route-level code splitting: the initial bundle no longer carries the whole
// cockpit + admin. The public /sign page (opened by customers on phones from a
// WhatsApp link) and the staff-only admin area load only when visited.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SignDocument = lazy(() => import("./pages/SignDocument"));
const Questionnaire = lazy(() => import("./pages/Questionnaire"));
const WebsiteBrief = lazy(() => import("./pages/WebsiteBrief"));
const AgentDocumentsPage = lazy(() => import("./pages/AgentDocumentsPage"));
const AgentIdeasPage = lazy(() => import("./pages/AgentIdeasPage"));
const AgentMainPage = lazy(() => import("./pages/AgentMainPage"));
const AgentDesignerPage = lazy(() => import("./pages/AgentDesignerPage"));
const AgentRemindersPage = lazy(() => import("./pages/AgentRemindersPage"));
const BusinessLayout = lazy(() => import("./pages/business/BusinessLayout"));
const Home = lazy(() => import("./pages/business/Home"));
const Inbox = lazy(() => import("./pages/business/Inbox"));
const Files = lazy(() => import("./pages/business/Files"));
const Filing = lazy(() => import("./pages/business/Filing"));
const Calendar = lazy(() => import("./pages/business/Calendar"));
const ContactDetail = lazy(() => import("./pages/business/ContactDetail"));
const Customers = lazy(() => import("./pages/business/Customers"));
const CustomerDetail = lazy(() => import("./pages/business/CustomerDetail"));
const BriefDetail = lazy(() => import("./pages/business/BriefDetail"));
const StrategyDetail = lazy(() => import("./pages/business/StrategyDetail"));
const PlanDetail = lazy(() => import("./pages/business/PlanDetail"));
const CampaignDetail = lazy(() => import("./pages/business/CampaignDetail"));
const QuoteDetail = lazy(() => import("./pages/business/QuoteDetail"));
const ObjectiveDetail = lazy(
  () => import("./pages/business/ObjectiveDetail"),
);
const Automations = lazy(() => import("./pages/business/Automations"));
const Growth = lazy(() => import("./pages/business/Growth"));
const AgentStudio = lazy(() => import("./pages/business/AgentStudio"));
const AgentWorkspace = lazy(() => import("./pages/business/AgentWorkspace"));
const Integrations = lazy(() => import("./pages/business/Integrations"));
const Money = lazy(() => import("./pages/business/Money"));
const Subscription = lazy(() => import("./pages/business/Subscription"));
const NotificationSettings = lazy(
  () => import("./pages/business/NotificationSettings"),
);
const PreferencesHub = lazy(
  () => import("./pages/business/preferences/PreferencesHub"),
);
const ContactsSettings = lazy(
  () => import("./pages/business/preferences/ContactsSettings"),
);
const BusinessInfoSettings = lazy(
  () => import("./pages/business/preferences/BusinessInfoSettings"),
);
const Members = lazy(() => import("./pages/business/Members"));
const Settings = lazy(() => import("./pages/business/Settings"));
const WhatsappSettings = lazy(() => import("./pages/business/WhatsappSettings"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminBusinesses = lazy(() => import("./pages/admin/AdminBusinesses"));
const AdminBusinessDetail = lazy(
  () => import("./pages/admin/AdminBusinessDetail"),
);
const AdminCreateClient = lazy(() => import("./pages/admin/AdminCreateClient"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
// Guarding the lazy() call itself (not just the <Route>) is what lets Vite fold
// the branch away in production — otherwise the chunk is still emitted.
const IconGallery = import.meta.env.DEV
  ? lazy(() => import("./pages/dev/IconGallery"))
  : null;

/**
 * The old contacts LIST (contacts/:status) is folded into the unified אנשי קשר
 * screen. Redirect it to customers?stage=<status> (lead→lead, customer→customer)
 * so nav links and bookmarks still resolve. The contact DETAIL page stays live.
 */
function ContactsListRedirect() {
  const { businessId, status } = useParams<{
    businessId: string;
    status: string;
  }>();
  const stage = status === "customer" ? "customer" : "lead";
  return (
    <Navigate
      to={`/app/businesses/${businessId}/customers?stage=${stage}`}
      replace
    />
  );
}

function RouteFallback() {
  return (
    <div className="min-h-dvh grid place-items-center bg-cream-50">
      <div
        className="size-8 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin"
        role="status"
        aria-label="טוען"
      />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireStaff({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  if (!token) return <Navigate to="/login" replace />;
  if (!isPlatformStaff(user?.role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);

  // Refresh the cached user from the server whenever a session exists. Without
  // this the store keeps whatever the *last login* returned, so a server-side
  // change (e.g. a role promotion to super_admin) never reaches a client that
  // stays logged in — the admin area and staff-only controls would stay hidden
  // until a manual re-login. On auth failure the axios interceptor logs out.
  useEffect(() => {
    if (!token) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => undefined);
  }, [token, setUser]);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Design-system contact sheet. Dev builds only — the lazy import is
            inside the guard so it never enters the production bundle. */}
        {IconGallery && (
          <Route path="/dev/icons" element={<IconGallery />} />
        )}
        <Route path="/login" element={<Login />} />
        <Route path="/sign/:token" element={<SignDocument />} />
        <Route path="/strategy" element={<Questionnaire />} />
        <Route path="/website-brief" element={<WebsiteBrief />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/app/agents/documents"
          element={
            <RequireAuth>
              <AgentDocumentsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/app/agents/ideas"
          element={
            <RequireAuth>
              <AgentIdeasPage />
            </RequireAuth>
          }
        />
        <Route
          path="/app/agents/main"
          element={
            <RequireAuth>
              <AgentMainPage />
            </RequireAuth>
          }
        />
        <Route
          path="/app/agents/designer"
          element={
            <RequireAuth>
              <AgentDesignerPage />
            </RequireAuth>
          }
        />
        <Route
          path="/app/agents/reminders"
          element={
            <RequireAuth>
              <AgentRemindersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/app/admin"
          element={
            <RequireStaff>
              <AdminLayout />
            </RequireStaff>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverview />} />
          <Route path="businesses" element={<AdminBusinesses />} />
          <Route path="clients/new" element={<AdminCreateClient />} />
          <Route
            path="businesses/:businessId"
            element={<AdminBusinessDetail />}
          />
          <Route path="users" element={<AdminUsers />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>
        <Route
          path="/app/businesses/:businessId"
          element={
            <RequireAuth>
              <BusinessLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="files" element={<Files />} />
          <Route path="filing" element={<Filing />} />
          <Route path="calendar" element={<Calendar />} />
          {/* Legacy routes kept alive as redirects so notification links and
              bookmarks still resolve; the unified יומן reads ?view=. */}
          <Route
            path="appointments"
            element={<Navigate to="../calendar?view=appointments" replace />}
          />
          {/* Legacy people surfaces folded into the unified אנשי קשר screen. */}
          <Route
            path="leads"
            element={<Navigate to="../customers?stage=lead" replace />}
          />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:customerId" element={<CustomerDetail />} />
          <Route path="contacts/:status" element={<ContactsListRedirect />} />
          <Route
            path="contacts/:status/:contactId"
            element={<ContactDetail />}
          />
          <Route path="briefs/:briefId" element={<BriefDetail />} />
          <Route
            path="strategies/:strategyId"
            element={<StrategyDetail />}
          />
          <Route path="plans/:planId" element={<PlanDetail />} />
          <Route path="campaigns/:campaignId" element={<CampaignDetail />} />
          <Route path="quotes/:quoteId" element={<QuoteDetail />} />
          <Route
            path="objectives/:objectiveId"
            element={<ObjectiveDetail />}
          />
          <Route
            path="tasks"
            element={<Navigate to="../calendar?view=tasks" replace />}
          />
          <Route path="agents" element={<AgentStudio />} />
          <Route path="agents/:agentKey" element={<AgentWorkspace />} />
          <Route path="automations" element={<Automations />} />
          <Route path="growth" element={<Growth />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="money" element={<Money />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="notifications" element={<NotificationSettings />} />
          {/* Owner-facing settings hub (distinct from operator config above). */}
          <Route path="preferences" element={<PreferencesHub />} />
          <Route path="preferences/contacts" element={<ContactsSettings />} />
          <Route path="preferences/business" element={<BusinessInfoSettings />} />
          {/* The old money screens are consolidated into כסף (invoices) +
              המנוי שלי (subscription). Redirects keep bookmarks/CTAs alive. */}
          <Route path="billing" element={<Navigate to="../money" replace />} />
          <Route
            path="expenses"
            element={<Navigate to="../money?view=expenses" replace />}
          />
          {/* Operator-only business config. Guard the ROUTES, not just the
              sidebar — otherwise a direct URL or a stray link (e.g. the old
              money→accountant "settings" link) let a non-staff owner reach
              operator config. RequireStaff redirects clients to /app. */}
          <Route
            path="members"
            element={
              <RequireStaff>
                <Members />
              </RequireStaff>
            }
          />
          <Route
            path="settings"
            element={
              <RequireStaff>
                <Settings />
              </RequireStaff>
            }
          />
          <Route
            path="channels/whatsapp"
            element={
              <RequireStaff>
                <WhatsappSettings />
              </RequireStaff>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Suspense>
  );
}
