import { useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { formatYearMonthShortPt, isPaidThisMonth, recentMonthKeys } from "../domain/recurring";
import type { RecurringExpense } from "../domain/types";

type Props = {
  open: boolean;
  recurring: RecurringExpense | null;
  onClose: () => void;
};

/**
 * Permite marcar meses anteriores como pagos (histórico). O cartão só é ajustado ao marcar/desmarcar o **mês atual**.
 */
export function RecurringPaidHistoryModal({ open, recurring, onClose }: Props) {
  const { toggleRecurringPaid } = useFinance();
  const months = useMemo(() => recentMonthKeys(36), []);

  if (!open || !recurring) return null;

  return (
    <div className="fixed inset-0 z-[105] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="rec-paid-hist-title"
      >
        <h2 id="rec-paid-hist-title" className="mb-1 font-headline text-xl font-bold text-primary">
          Histórico de pagamentos
        </h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          <span className="font-semibold text-primary">{recurring.name}</span> — marque os meses em que já pagou.
          Meses passados não alteram a fatura aberta do cartão; só o mês corrente entra na fatura quando houver cartão
          vinculado.
        </p>
        <ul className="max-h-[min(24rem,55vh)] space-y-1 overflow-y-auto rounded-lg border border-outline-variant/15 bg-surface-container-high/30 p-2">
          {months.map((ym) => {
            const on = isPaidThisMonth(recurring, ym);
            return (
              <li
                key={ym}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface-container-high/60"
              >
                <span className="font-medium text-on-surface">{formatYearMonthShortPt(ym)}</span>
                <button
                  type="button"
                  onClick={() => toggleRecurringPaid(recurring.id, ym)}
                  className={`shrink-0 rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                    on
                      ? "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/90"
                      : "border border-outline-variant/40 bg-surface-container-lowest text-primary hover:border-primary/40"
                  }`}
                >
                  {on ? "Pago" : "Marcar pago"}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
