import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import { isPlatformStaff } from "./lib/roles";
import Login from "./pages/Login";

// Route-level code splitting: the initial bundle no longer carries the whole
// cockpit + admin. The public /sign page (opened by customers on phones from a
// WhatsApp link) and the staff-only admin area load only when visited.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SignDocument = lazy(() => import("./pages/SignDocument"));
const Questionnaire = lazy(() => import("./pages/Questionnaire"));
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
const Leads = lazy(() => import("./pages/business/Leads"));
const Tasks = lazy(() => import("./pages/business/Tasks"));
const Automations = lazy(() => import("./pages/business/Automations"));
const Growth = lazy(() => import("./pages/business/Growth"));
const AgentStudio = lazy(() => import("./pages/business/AgentStudio"));
const AgentWorkspace = lazy(() => import("./pages/business/AgentWorkspace"));
const Integrations = lazy(() => import("./pages/business/Integrations"));
const Billing = lazy(() => import("./pages/business/Billing"));
const Expenses = lazy(() => import("./pages/business/Expenses"));
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
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/sign/:token" element={<SignDocument />} />
        <Route path="/strategy" element={<Questionnaire />} />
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
          <Route path="leads" element={<Leads />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="agents" element={<AgentStudio />} />
          <Route path="agents/:agentKey" element={<AgentWorkspace />} />
          <Route path="automations" element={<Automations />} />
          <Route path="growth" element={<Growth />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="billing" element={<Billing />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="members" element={<Members />} />
          <Route path="settings" element={<Settings />} />
          <Route path="channels/whatsapp" element={<WhatsappSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Suspense>
  );
}
