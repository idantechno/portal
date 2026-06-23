import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import SignDocument from "./pages/SignDocument";
import AgentDocumentsPage from "./pages/AgentDocumentsPage";
import BusinessLayout from "./pages/business/BusinessLayout";
import Inbox from "./pages/business/Inbox";
import Files from "./pages/business/Files";
import Leads from "./pages/business/Leads";
import Settings from "./pages/business/Settings";
import WhatsappSettings from "./pages/business/WhatsappSettings";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
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
        <Route path="settings" element={<Settings />} />
        <Route path="channels/whatsapp" element={<WhatsappSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
