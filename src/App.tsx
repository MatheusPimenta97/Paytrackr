import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { DashboardLayout } from "./components/DashboardLayout";
import { useAuth } from "./context/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { LancamentosPage } from "./pages/LancamentosPage";
import { LoginPage } from "./pages/LoginPage";
import { MetasPage } from "./pages/MetasPage";
import GastosRecorrentesPage from "./pages/GastosRecorrentesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { ValoresAReceberPage } from "./pages/ValoresAReceberPage";
import { PontosPage } from "./pages/PontosPage";
import { CreditCardDetailPage } from "./pages/CreditCardDetailPage";

function RequireAuth() {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background font-body text-on-surface-variant dark:bg-slate-950 dark:text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm font-medium">Carregando…</span>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/metas" element={<MetasPage />} />
          <Route path="/gastos-recorrentes" element={<GastosRecorrentesPage />} />
          <Route path="/analytics" element={<Navigate to="/gastos-recorrentes" replace />} />
          <Route path="/lancamentos" element={<LancamentosPage />} />
          <Route path="/cartao/:cardId" element={<CreditCardDetailPage />} />
          <Route path="/valores-a-receber" element={<ValoresAReceberPage />} />
          <Route path="/pontos" element={<PontosPage />} />
          <Route path="/payments" element={<LancamentosPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
