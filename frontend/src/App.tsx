import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import { isPlatformStaff } from "./lib/roles";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SignDocument from "./pages/SignDocument";
import AgentDocumentsPage from "./pages/AgentDocumentsPage";
import BusinessLayout from "./pages/business/BusinessLayout";
import Inbox from "./pages/business/Inbox";
import Files from "./pages/business/Files";
import Leads from "./pages/business/Leads";
import Members from "./pages/business/Members";
import Settings from "./pages/business/Settings";
import WhatsappSettings from "./pages/business/WhatsappSettings";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminBusinesses from "./pages/admin/AdminBusinesses";
import AdminBusinessDetail from "./pages/admin/AdminBusinessDetail";
import AdminCreateClient from "./pages/admin/AdminCreateClient";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAudit from "./pages/admin/AdminAudit";

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
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/sign/:token" element={<SignDocument />} />
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
        <Route path="businesses/:businessId" element={<AdminBusinessDetail />} />
        <Route path="users" element={<AdminUsers />} />
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
        <Route index element={<Navigate to="inbox" replace />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="files" element={<Files />} />
        <Route path="leads" element={<Leads />} />
        <Route path="members" element={<Members />} />
        <Route path="settings" element={<Settings />} />
        <Route path="channels/whatsapp" element={<WhatsappSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
