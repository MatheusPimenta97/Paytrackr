import { Outlet } from "react-router-dom";
import { FinanceProvider } from "../context/FinanceContext";

/** Provider pesado só entra no bundle depois do login (dynamic import via React.lazy em App). */
export default function FinanceShell() {
  return (
    <FinanceProvider>
      <Outlet />
    </FinanceProvider>
  );
}
