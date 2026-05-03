import { useEffect, useMemo, useState } from "react";
import { formatBRL, useFinance } from "../context/FinanceContext";
import { CATEGORY_OPTIONS } from "../domain/categories";
import { formatStatementInvoiceCyclePt, statementInvoiceCycleIsoRange } from "../domain/money";
import type { StatementAiSuggestedTxn } from "../services/statementAi";

function iconForCategory(category: string): string {
  switch (category) {
    case "Eletrônicos":
      return "shopping_cart";
    case "Investimentos":
      return "savings";
    case "Lazer":
      return "restaurant";
    case "Viagem":
      return "flight";
    case "Alimentação":
      return "restaurant";
    case "Moradia":
      return "apartment";
    case "Transporte":
      return "directions_car";
    case "Saúde":
      return "local_hospital";
    default:
      return "shopping_bag";
  }
}

type RowState = StatementAiSuggestedTxn & { selected: boolean; entryKind: "expense" | "credit" };

type Props = {
  open: boolean;
  creditCardId: string;
  /** Mês YYYY-MM escolhido antes de extrair a fatura (define o período do ciclo). */
  statementReferenceMonth: string;
  invoiceClosingDay: number;
  markdown: string;
  statementTotalGuess: number | null;
  suggestedTransactions: StatementAiSuggestedTxn[];
  onClose: () => void;
};

function formatRefMonthTitlePt(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function StatementAiPreviewModal({
  open,
  creditCardId,
  statementReferenceMonth,
  invoiceClosingDay,
  markdown,
  statementTotalGuess,
  suggestedTransactions,
  onClose,
}: Props) {
  const { addTransaction, state } = useFinance();
  const [rows, setRows] = useState<RowState[]>([]);

  const cycle = useMemo(
    () => statementInvoiceCycleIsoRange(statementReferenceMonth, invoiceClosingDay),
    [statementReferenceMonth, invoiceClosingDay],
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const cycleIsPast = cycle ? cycle.endIso < todayIso : true;

  useEffect(() => {
    if (!open) return;
    setRows(
      suggestedTransactions.map((t) => ({
        ...t,
        entryKind: t.entryKind === "credit" ? "credit" : "expense",
        selected: true,
      })),
    );
  }, [open, suggestedTransactions]);

  if (!open) return null;

  /** Despesas somam positivo; créditos na fatura (pagamentos) abatem. */
  const selectedNet = rows
    .filter((r) => r.selected)
    .reduce((s, r) => {
      const mag = Math.round(r.amount * 100) / 100;
      return s + (r.entryKind === "credit" ? -mag : mag);
    }, 0);

  function updateRow(i: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function importSelected() {
    const picked = rows.filter((r) => r.selected && r.amount > 0 && r.description.trim());
    for (const r of picked) {
      const cat = CATEGORY_OPTIONS.includes(r.category as (typeof CATEGORY_OPTIONS)[number])
        ? r.category
        : "Outros";
      const desc =
        r.installmentNote && !r.description.includes(r.installmentNote)
          ? `${r.description} (${r.installmentNote})`
          : r.description;
      const day = r.date.slice(0, 10);
      const inCycle = !!(cycle && day >= cycle.startIso && day <= cycle.endIso);
      const skipCardInvoiceDelta = !inCycle || cycleIsPast;
      const mag = Math.round(r.amount * 100) / 100;
      const signed = r.entryKind === "credit" ? mag : -mag;
      addTransaction({
        date: r.date,
        description: desc.trim().slice(0, 240),
        category: cat,
        amount: signed,
        status: "confirmado",
        icon: iconForCategory(cat),
        accountId: state.defaultAccountId,
        creditCardId,
        benefitBucket: null,
        paymentMethod: null,
        paymentAttachmentDataUrl: null,
        paymentAttachmentName: null,
        thirdPartyName: null,
        statementReferenceMonth: /^\d{4}-\d{2}$/.test(statementReferenceMonth)
          ? statementReferenceMonth
          : null,
        /**
         * Fora do período do mês escolhido, ou fatura já fechada (fim do ciclo antes de hoje) → só histórico.
         * Dentro do período do mês atual em aberto → entra na fatura aberta e no gráfico.
         */
        skipCardInvoiceDelta,
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-primary/50 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div
        className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-xl bg-surface-container-lowest shadow-2xl dark:bg-slate-900"
        role="dialog"
        aria-modal
        aria-labelledby="stmt-ai-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-outline-variant/20 px-5 py-4 dark:border-slate-700">
          <h2 id="stmt-ai-title" className="font-headline text-lg font-bold text-primary dark:text-slate-100">
            Revisar lançamentos da fatura (IA)
          </h2>
          <p className="mt-1 text-xs font-semibold text-primary dark:text-emerald-200">
            Mês da fatura: {formatRefMonthTitlePt(statementReferenceMonth)}
            {cycle ? (
              <span className="mt-0.5 block font-normal text-on-surface-variant dark:text-slate-400">
                Ciclo: {formatStatementInvoiceCyclePt(cycle)}
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-on-surface-variant dark:text-slate-400">
            Confira cada linha. Datas <strong className="text-on-surface dark:text-slate-200">dentro</strong> desse
            período e fatura ainda em aberto entram na <strong className="text-on-surface dark:text-slate-200">fatura
            atual</strong>. Fora do período, ou se o ciclo já terminou, ficam como{" "}
            <strong className="text-on-surface dark:text-slate-200">só histórico</strong> (no gráfico da fatura,
            tudo fica no mês que você escolheu para esta importação).
          </p>
        </div>

        <div className="max-h-[40vh] overflow-y-auto border-b border-outline-variant/15 px-5 py-3 dark:border-slate-700">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <pre className="whitespace-pre-wrap font-sans text-xs text-on-surface-variant dark:text-slate-300">
              {markdown}
            </pre>
          </div>
          {statementTotalGuess != null && statementTotalGuess > 0 && (
            <p className="mt-2 text-xs font-semibold text-primary dark:text-emerald-300">
              Total indicado na fatura (IA): {formatBRL(statementTotalGuess)} · Soma líquida das linhas selecionadas
              (despesas − créditos): {formatBRL(selectedNet)}
            </p>
          )}
        </div>

        <div className="max-h-[38vh] overflow-x-auto overflow-y-auto px-3 py-2">
          {rows.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-on-surface-variant">Nenhum lançamento retornado.</p>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/30 text-[10px] uppercase text-on-surface-variant dark:border-slate-600">
                  <th className="p-2">✓</th>
                  <th className="p-2">Data</th>
                  <th className="p-2">Período</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2">Valor</th>
                  <th className="p-2">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const d = r.date.slice(0, 10);
                  const inC = !!(cycle && d >= cycle.startIso && d <= cycle.endIso);
                  const willSkip = !inC || cycleIsPast;
                  return (
                  <tr key={`${i}-${r.date}-${r.description.slice(0, 24)}`} className="border-b border-outline-variant/15 dark:border-slate-700">
                    <td className="p-1 align-top">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        onChange={(e) => updateRow(i, { selected: e.target.checked })}
                        className="mt-2"
                      />
                    </td>
                    <td className="p-1 align-top">
                      <input
                        type="date"
                        value={r.date}
                        onChange={(e) => updateRow(i, { date: e.target.value })}
                        className="w-full rounded bg-surface-container-high px-1 py-1 dark:bg-slate-800"
                      />
                    </td>
                    <td className="p-1 align-top text-[10px] leading-tight text-on-surface-variant">
                      {willSkip ? (
                        <span className="text-amber-800 dark:text-amber-300">Histórico</span>
                      ) : (
                        <span className="text-secondary dark:text-emerald-300">Fatura atual</span>
                      )}
                    </td>
                    <td className="p-1 align-top">
                      <select
                        value={r.entryKind}
                        onChange={(e) =>
                          updateRow(i, {
                            entryKind: e.target.value === "credit" ? "credit" : "expense",
                          })
                        }
                        className="w-full max-w-[9.5rem] rounded bg-surface-container-high px-1 py-1 text-[10px] font-semibold dark:bg-slate-800"
                      >
                        <option value="expense">Despesa</option>
                        <option value="credit">Crédito (abate)</option>
                      </select>
                    </td>
                    <td className="p-1 align-top">
                      <input
                        value={r.description}
                        onChange={(e) => updateRow(i, { description: e.target.value })}
                        className="w-full rounded bg-surface-container-high px-2 py-1 dark:bg-slate-800"
                      />
                    </td>
                    <td className="p-1 align-top">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={String(r.amount).replace(".", ",")}
                        onChange={(e) => {
                          const v = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
                          const n = Number.parseFloat(v);
                          updateRow(i, { amount: Number.isFinite(n) ? Math.abs(n) : 0 });
                        }}
                        className="w-full rounded bg-surface-container-high px-2 py-1 dark:bg-slate-800"
                      />
                    </td>
                    <td className="p-1 align-top">
                      <select
                        value={
                          CATEGORY_OPTIONS.includes(r.category as (typeof CATEGORY_OPTIONS)[number])
                            ? r.category
                            : "Outros"
                        }
                        onChange={(e) => updateRow(i, { category: e.target.value })}
                        className="w-full rounded bg-surface-container-high px-1 py-1 dark:bg-slate-800"
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant/20 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high dark:text-slate-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={rows.filter((r) => r.selected).length === 0}
            onClick={() => importSelected()}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-40 dark:bg-emerald-700"
          >
            Importar selecionados ({rows.filter((r) => r.selected).length})
          </button>
        </div>
      </div>
    </div>
  );
}
