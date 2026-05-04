import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";

const FinanceShell = lazy(() => import("./routes/FinanceShell"));

const DashboardLayout = lazy(() =>
  import("./components/DashboardLayout").then((m) => ({ default: m.DashboardLayout }))
);

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const LancamentosPage = lazy(() =>
  import("./pages/LancamentosPage").then((m) => ({ default: m.LancamentosPage }))
);
const MetasPage = lazy(() => import("./pages/MetasPage").then((m) => ({ default: m.MetasPage })));
const GastosRecorrentesPage = lazy(() => import("./pages/GastosRecorrentesPage"));
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const ValoresAReceberPage = lazy(() =>
  import("./pages/ValoresAReceberPage").then((m) => ({ default: m.ValoresAReceberPage }))
);
const PontosPage = lazy(() => import("./pages/PontosPage").then((m) => ({ default: m.PontosPage })));
const CreditCardDetailPage = lazy(() =>
  import("./pages/CreditCardDetailPage").then((m) => ({ default: m.CreditCardDetailPage }))
);
const CreditCardStatementMonthPage = lazy(() =>
  import("./pages/CreditCardStatementMonthPage").then((m) => ({ default: m.CreditCardStatementMonthPage }))
);
const AiAssistantPage = lazy(() =>
  import("./pages/AiAssistantPage").then((m) => ({ default: m.AiAssistantPage }))
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-body text-on-surface-variant dark:bg-slate-950 dark:text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm font-medium">Carregando…</span>
      </div>
    </div>
  );
}

function RequireAuth() {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return <RouteFallback />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route
          element={
            <Suspense fallback={<RouteFallback />}>
              <FinanceShell />
            </Suspense>
          }
        >
        <Route
          element={
            <Suspense fallback={<RouteFallback />}>
              <DashboardLayout />
            </Suspense>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/metas" element={<MetasPage />} />
          <Route path="/gastos-recorrentes" element={<GastosRecorrentesPage />} />
          <Route path="/analytics" element={<Navigate to="/gastos-recorrentes" replace />} />
          <Route path="/lancamentos" element={<LancamentosPage />} />
          <Route path="/cartao/:cardId" element={<CreditCardDetailPage />} />
          <Route path="/cartao/:cardId/fatura/:referenceMonth" element={<CreditCardStatementMonthPage />} />
          <Route path="/valores-a-receber" element={<ValoresAReceberPage />} />
          <Route path="/pontos" element={<PontosPage />} />
          <Route path="/payments" element={<LancamentosPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/assistente" element={<AiAssistantPage />} />
        </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
