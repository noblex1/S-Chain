import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import NotificationHost from './components/NotificationHost.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ShipmentsPage from './pages/ShipmentsPage.jsx';
import ShipmentDetailPage from './pages/ShipmentDetailPage.jsx';
import BootstrapAdminPage from './pages/BootstrapAdminPage.jsx';
import AdminUsersPage from './pages/AdminUsersPage.jsx';
import AdminAuditPage from './pages/AdminAuditPage.jsx';
import AdminMonitoringPage from './pages/AdminMonitoringPage.jsx';

function PrivateRoute({ children }) {
  const { token, ready } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="h-10 w-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <NotificationHost />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/bootstrap-admin" element={<BootstrapAdminPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="shipments" element={<ShipmentsPage />} />
          <Route path="shipments/:id" element={<ShipmentDetailPage />} />
          <Route path="admin/monitor" element={<AdminMonitoringPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/audit" element={<AdminAuditPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
