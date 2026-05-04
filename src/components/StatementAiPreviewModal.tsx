import { useEffect, useMemo, useState } from "react";
import { formatBRL, useFinance } from "../context/FinanceContext";
import { CATEGORY_OPTIONS, iconForCategory } from "../domain/categories";
import { newId } from "../domain/id";
import {
  addCalendarMonthsToReferenceYm,
  coerceStatementReferenceMonthYm,
  formatStatementInvoiceCyclePt,
  isoDateInReferenceMonth,
  parseInstallmentFractionFromText,
  parseMoneyInput,
  statementInvoiceCycleIsoRange,
} from "../domain/money";
import type { StatementAiSuggestedTxn } from "../services/statementAi";

type RowState = StatementAiSuggestedTxn & {
  rowKey: string;
  selected: boolean;
  entryKind: "expense" | "credit";
  /** Linha criada pelo usuário (não veio da IA). */
  isManual?: boolean;
};

function stripTrailingInstallmentMarker(description: string): string {
  return description
    .replace(/\s*\(?\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)?\s*$/u, "")
    .trim();
}

function resolveInstallmentParts(r: StatementAiSuggestedTxn): { current: number; total: number } | null {
  const ic = r.installmentCurrent;
  const it = r.installmentTotal;
  if (typeof ic === "number" && typeof it === "number" && Number.isFinite(ic) && Number.isFinite(it)) {
    const cur = Math.floor(ic);
    const tot = Math.floor(it);
    if (cur >= 1 && tot >= 2 && cur <= tot && tot <= 48) return { current: cur, total: tot };
  }
  return parseInstallmentFractionFromText(r.installmentNote, r.description);
}

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
  const [projectFutureInstallments, setProjectFutureInstallments] = useState(false);

  const cycle = useMemo(
    () => statementInvoiceCycleIsoRange(statementReferenceMonth, invoiceClosingDay),
    [statementReferenceMonth, invoiceClosingDay],
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const cycleIsPast = cycle ? cycle.endIso < todayIso : true;

  useEffect(() => {
    if (!open) return;
    setProjectFutureInstallments(false);
    setRows(
      suggestedTransactions.map((t) => ({
        ...t,
        rowKey: newId(),
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

  function addManualRow() {
    const defaultDate = /^\d{4}-\d{2}$/.test(statementReferenceMonth)
      ? `${statementReferenceMonth}-15`
      : new Date().toISOString().slice(0, 10);
    setRows((prev) => [
      ...prev,
      {
        rowKey: newId(),
        date: defaultDate,
        description: "",
        amount: 0,
        category: "Outros",
        installmentNote: null,
        entryKind: "expense",
        selected: true,
        isManual: true,
      },
    ]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i));
  }

  const canImport = rows.some((r) => r.selected && r.amount > 0 && r.description.trim());
  const totalDiff =
    statementTotalGuess != null && statementTotalGuess > 0
      ? Math.round((statementTotalGuess - selectedNet) * 100) / 100
      : null;

  function importSelected() {
    const refYm = coerceStatementReferenceMonthYm(statementReferenceMonth);
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
      const inst = resolveInstallmentParts(r);
      const skipCardInvoiceDelta =
        r.entryKind === "credit"
          ? cycleIsPast || !inCycle
          : cycleIsPast || (!inCycle && !inst);
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
        ...(refYm ? { statementReferenceMonth: refYm } : {}),
        /**
         * Parcelas com data da compra original fora do ciclo ainda entram na fatura deste mês
         * (statementReferenceMonth). Fatura encerrada → só histórico. Créditos: fora do ciclo → histórico.
         */
        skipCardInvoiceDelta,
      });

      if (
        !projectFutureInstallments ||
        r.entryKind === "credit" ||
        !refYm ||
        !inst ||
        inst.current >= inst.total
      ) {
        continue;
      }
      const baseDesc = stripTrailingInstallmentMarker(r.description.trim()) || r.description.trim();
      const dayNum = parseInt(r.date.slice(8, 10), 10);
      const dow = Number.isFinite(dayNum) && dayNum >= 1 && dayNum <= 31 ? dayNum : 15;
      for (let k = inst.current + 1; k <= inst.total; k++) {
        const ahead = k - inst.current;
        const futureYm = addCalendarMonthsToReferenceYm(refYm, ahead);
        if (!futureYm) continue;
        const futureIso = isoDateInReferenceMonth(futureYm, dow) ?? `${futureYm}-15`;
        const futureDesc = `${baseDesc} (${k}/${inst.total})`.slice(0, 240);
        addTransaction({
          date: futureIso,
          description: futureDesc,
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
          statementReferenceMonth: futureYm,
          /** Projeção: não altera a fatura em aberto até o mês chegar; aparece no mês da fatura no app. */
          skipCardInvoiceDelta: true,
        });
      }
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
            Confira cada linha. Compras <strong className="text-on-surface dark:text-slate-200">parceladas</strong>{" "}
            podem trazer a <strong className="text-on-surface dark:text-slate-200">data original</strong> da compra
            (fora do ciclo desta fatura): elas continuam neste mês no app. Se o ciclo já terminou, tudo fica como{" "}
            <strong className="text-on-surface dark:text-slate-200">só histórico</strong> na fatura aberta do cartão.
          </p>
        </div>

        <div className="max-h-[40vh] overflow-y-auto border-b border-outline-variant/15 px-5 py-3 dark:border-slate-700">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <pre className="whitespace-pre-wrap font-sans text-xs text-on-surface-variant dark:text-slate-300">
              {markdown}
            </pre>
          </div>
          {statementTotalGuess != null && statementTotalGuess > 0 && (
            <div className="mt-2 space-y-1 text-xs">
              <p className="font-semibold text-primary dark:text-emerald-300">
                Total indicado na fatura (IA): {formatBRL(statementTotalGuess)} · Soma líquida das linhas selecionadas
                (despesas − créditos): {formatBRL(selectedNet)}
              </p>
              {totalDiff != null && Math.abs(totalDiff) >= 0.02 ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 font-medium text-amber-950 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-100">
                  Diferença em relação ao total da fatura:{" "}
                  <strong>{totalDiff > 0 ? `+${formatBRL(totalDiff)}` : formatBRL(totalDiff)}</strong>
                  {totalDiff > 0
                    ? " — a soma das linhas está abaixo do total (faltam lançamentos ou valores). Use “Incluir linha manual” abaixo."
                    : " — a soma está acima do total (revise valores, duplicatas ou marque créditos como “Crédito (abate)”)."}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/15 px-3 py-2 dark:border-slate-700">
          <button
            type="button"
            onClick={addManualRow}
            className="inline-flex items-center gap-1 rounded-lg border border-secondary/50 bg-secondary/10 px-3 py-1.5 text-xs font-bold text-secondary hover:bg-secondary/20 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Incluir linha manual
          </button>
          <span className="text-[10px] text-on-surface-variant dark:text-slate-500">
            Para o que a IA não leu, preencha data, descrição e valor (use vírgula nos centavos).
          </span>
        </div>

        <div className="max-h-[38vh] overflow-x-auto overflow-y-auto px-3 py-2">
          {rows.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-on-surface-variant">
              Nenhum lançamento retornado. Use o botão acima para incluir linhas manualmente.
            </p>
          ) : (
            <table className="w-full min-w-[680px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/30 text-[10px] uppercase text-on-surface-variant dark:border-slate-600">
                  <th className="p-2 w-8" aria-label="Remover" />
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
                  const instParts = resolveInstallmentParts(r);
                  const willSkip =
                    r.entryKind === "credit"
                      ? cycleIsPast || !inC
                      : cycleIsPast || (!inC && !instParts);
                  return (
                  <tr key={r.rowKey} className="border-b border-outline-variant/15 dark:border-slate-700">
                    <td className="p-1 align-top">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="mt-1.5 rounded p-0.5 text-on-surface-variant hover:bg-error/15 hover:text-error dark:hover:bg-red-950/50 dark:hover:text-red-300"
                        title="Remover linha"
                        aria-label="Remover linha"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </td>
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
                        placeholder="0,00"
                        value={r.amount === 0 ? "" : String(r.amount).replace(".", ",")}
                        onChange={(e) => {
                          const n = parseMoneyInput(e.target.value);
                          updateRow(i, { amount: n != null && n >= 0 ? n : 0 });
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

        <div className="space-y-3 border-t border-outline-variant/20 px-5 py-4 dark:border-slate-700">
          <label className="flex cursor-pointer items-start gap-2 text-left text-xs text-on-surface-variant dark:text-slate-400">
            <input
              type="checkbox"
              checked={projectFutureInstallments}
              onChange={(e) => setProjectFutureInstallments(e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <span>
              <strong className="text-on-surface dark:text-slate-200">Gerar parcelas futuras (estimativa)</strong> —
              para linhas com parcela N/M (ex.: 3/12), cria lançamentos iguais nos{" "}
              <strong className="text-on-surface dark:text-slate-200">meses de fatura seguintes</strong> até a última
              parcela. Valores iguais à parcela atual; revise quando a fatura real chegar. Não altera o saldo da fatura
              em aberto até você chegar nesses meses (marcados como projeção).
            </span>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canImport}
              onClick={() => importSelected()}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-40 dark:bg-emerald-700"
            >
              Importar selecionados ({rows.filter((r) => r.selected).length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
