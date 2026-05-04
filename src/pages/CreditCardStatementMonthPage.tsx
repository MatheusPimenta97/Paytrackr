import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { AttachmentPreviewModal } from "../components/AttachmentPreviewModal";
import { CreditCardStatementModal } from "../components/CreditCardStatementModal";
import { TransactionFormModal } from "../components/TransactionFormModal";
import { formatBRL, useFinance } from "../context/FinanceContext";
import {
  chartReferenceMonthForCardTransaction,
  formatDateShort,
  formatStatementInvoiceCyclePt,
  statementInvoiceCycleIsoRange,
} from "../domain/money";
import type { CreditCardStatement, Transaction } from "../domain/types";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function categoryMaterialIcon(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("aliment")) return "restaurant";
  if (c.includes("material de constru")) return "construction";
  if (c.includes("mobilidade")) return "electric_scooter";
  if (c.includes("transport")) return "local_gas_station";
  if (c.includes("saúde") || c.includes("saude")) return "medical_services";
  if (c.includes("lazer")) return "confirmation_number";
  return "shopping_bag";
}

export function CreditCardStatementMonthPage() {
  const { cardId, referenceMonth } = useParams<{ cardId: string; referenceMonth: string }>();
  const { state, addCreditCardStatement, updateCreditCardStatement, deleteCreditCardStatement } = useFinance();

  const [statementOpen, setStatementOpen] = useState(false);
  const [statementEditing, setStatementEditing] = useState<CreditCardStatement | null>(null);
  const [statementPrefill, setStatementPrefill] = useState<{
    referenceMonth: string;
    amount: number;
  } | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<{ dataUrl: string; name: string } | null>(null);
  const [invoiceTxnFormOpen, setInvoiceTxnFormOpen] = useState(false);
  const [invoiceEditingTxn, setInvoiceEditingTxn] = useState<Transaction | null>(null);

  const ymOk = referenceMonth && /^\d{4}-\d{2}$/.test(referenceMonth);
  const card = cardId ? state.creditCards.find((c) => c.id === cardId) : undefined;

  const statements = useMemo(() => {
    if (!cardId) return [];
    return [...state.creditCardStatements]
      .filter((s) => s.creditCardId === cardId)
      .sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth));
  }, [state.creditCardStatements, cardId]);

  const cardTxns = useMemo(() => {
    if (!cardId) return [];
    return [...state.transactions]
      .filter((t) => t.creditCardId === cardId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [state.transactions, cardId]);

  const rawAmountSumByReferenceMonth = useMemo(() => {
    const map = new Map<string, number>();
    if (!card || card.kind !== "credito") return map;
    const closing = card.closingDay;
    for (const t of cardTxns) {
      const ref = chartReferenceMonthForCardTransaction(t, closing);
      if (!ref) continue;
      map.set(ref, (map.get(ref) ?? 0) + t.amount);
    }
    return map;
  }, [card, cardTxns]);

  const refYm = ymOk ? referenceMonth! : "";

  const cycleRange = useMemo(() => {
    if (!card || card.kind !== "credito" || !ymOk) return null;
    return statementInvoiceCycleIsoRange(refYm, card.closingDay);
  }, [card, refYm, ymOk]);

  const statementForMonth = useMemo(() => {
    if (!ymOk) return undefined;
    return statements.find((s) => s.referenceMonth === refYm);
  }, [statements, refYm, ymOk]);

  const cycleRawSum = useMemo(() => {
    if (!ymOk) return 0;
    return rawAmountSumByReferenceMonth.get(refYm) ?? 0;
  }, [rawAmountSumByReferenceMonth, refYm, ymOk]);

  const netFromTxns = useMemo(() => Math.max(0, -cycleRawSum), [cycleRawSum]);

  const totalShown = useMemo(
    () => (statementForMonth != null ? statementForMonth.amount : netFromTxns),
    [statementForMonth, netFromTxns],
  );

  const cycleTxns = useMemo(() => {
    if (!card || card.kind !== "credito" || !ymOk) return [];
    return cardTxns
      .filter((t) => chartReferenceMonthForCardTransaction(t, card.closingDay) === refYm)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [cardTxns, card, ymOk, refYm]);

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of cycleTxns) {
      if (t.amount >= 0) continue;
      const k = t.category.trim() || "Outros";
      map.set(k, (map.get(k) ?? 0) + Math.abs(t.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [cycleTxns]);

  const cycleIsPast = useMemo(() => {
    if (!cycleRange) return true;
    return cycleRange.endIso < new Date().toISOString().slice(0, 10);
  }, [cycleRange]);

  if (!cardId || !card) {
    return <Navigate to="/" replace />;
  }
  if (card.kind !== "credito" || !ymOk) {
    return <Navigate to={`/cartao/${cardId}`} replace />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 pb-24 md:px-6 md:pb-8">
      <CreditCardStatementModal
        open={statementOpen}
        creditCardId={card.id}
        enableStatementAi
        editing={statementEditing}
        prefill={statementEditing ? null : statementPrefill}
        invoiceClosingDay={card.closingDay}
        onClose={() => {
          setStatementOpen(false);
          setStatementEditing(null);
          setStatementPrefill(null);
        }}
        onSave={(data) => {
          if (statementEditing) {
            updateCreditCardStatement(statementEditing.id, data);
          } else {
            addCreditCardStatement({ creditCardId: card.id, ...data });
          }
        }}
      />
      <AttachmentPreviewModal
        open={attachmentPreview !== null}
        onClose={() => setAttachmentPreview(null)}
        dataUrl={attachmentPreview?.dataUrl ?? null}
        fileName={attachmentPreview?.name ?? null}
      />
      <TransactionFormModal
        open={invoiceTxnFormOpen}
        editingTransaction={invoiceEditingTxn}
        stackOnTop
        onClose={() => {
          setInvoiceTxnFormOpen(false);
          setInvoiceEditingTxn(null);
        }}
      />

      <div className="-mb-1 flex flex-wrap items-center gap-2">
        <Link
          to={`/cartao/${cardId}`}
          className="inline-flex items-center gap-1 rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Voltar ao cartão"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <Link
          to={`/cartao/${cardId}`}
          className="text-xs font-semibold text-[#002855] underline-offset-2 hover:underline dark:text-blue-200"
        >
          {card.name}
        </Link>
        <span className="text-xs text-slate-400">/</span>
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Fatura {refYm}</span>
      </div>

      <header className="rounded-xl border border-surface-container bg-white p-4 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
        <h1 className="font-headline text-xl font-bold text-primary md:text-2xl dark:text-slate-100">
          {monthLabel(refYm)}
        </h1>
        {cycleRange ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Período do ciclo: <strong className="text-primary dark:text-slate-200">{formatStatementInvoiceCyclePt(cycleRange)}</strong>
          </p>
        ) : null}
        <p className="mt-3 text-base font-semibold text-primary dark:text-slate-100">
          Total (gráfico): {formatBRL(totalShown)}
          {statementForMonth ? (
            <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-400">· fatura salva</span>
          ) : (
            <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-400">· líquido dos lançamentos</span>
          )}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {statementForMonth ? (
          <>
            {statementForMonth.attachmentDataUrl ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-container/30 px-3 py-2 text-xs font-semibold text-primary shadow-sm transition-colors hover:bg-primary-container/50 dark:border-blue-600/50 dark:bg-blue-950/50 dark:text-blue-100"
                onClick={() =>
                  setAttachmentPreview({
                    dataUrl: statementForMonth.attachmentDataUrl!,
                    name: statementForMonth.attachmentName ?? "fatura",
                  })
                }
              >
                <span className="material-symbols-outlined text-[18px]">description</span>
                Ver fatura
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-outline-variant/50 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
              onClick={() => {
                setStatementPrefill(null);
                setStatementEditing(statementForMonth);
                setStatementOpen(true);
              }}
            >
              Editar fatura
            </button>
            <button
              type="button"
              className="rounded-lg border border-error/40 px-3 py-2 text-xs font-semibold text-error hover:bg-error/10"
              onClick={() => {
                if (confirm("Remover este registro de fatura?")) deleteCreditCardStatement(statementForMonth.id);
              }}
            >
              Excluir registro
            </button>
          </>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 dark:bg-blue-950/30"
            onClick={() => {
              setStatementEditing(null);
              setStatementPrefill({
                referenceMonth: refYm,
                amount: netFromTxns,
              });
              setStatementOpen(true);
            }}
          >
            Registrar esta fatura
          </button>
        )}
        <Link
          to={`/lancamentos?novo=1&cartao=${card.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-2 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">add_card</span>
          Novo lançamento
        </Link>
      </div>

      {categoryTotals.length > 0 ? (
        <section className="rounded-xl border border-surface-container bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-2 font-headline text-sm font-semibold text-primary">Gastos neste ciclo (por categoria)</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
            {categoryTotals.map(([name, v]) => (
              <li key={name} className="tabular-nums">
                <span className="font-medium text-primary dark:text-slate-200">{name}</span>: {formatBRL(v)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-surface-container bg-white shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-surface-container px-4 py-3 dark:border-slate-700">
          <h2 className="font-headline text-base font-semibold text-primary">Lançamentos do período</h2>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Datas <strong className="text-slate-700 dark:text-slate-300">fora</strong> do ciclo ou fatura já encerrada
            aparecem como <strong className="text-slate-700 dark:text-slate-300">só histórico</strong> (não somam na
            fatura aberta).
          </p>
        </div>
        {cycleTxns.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum lançamento neste período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 font-label text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/80 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Descrição</th>
                  <th className="px-4 py-2">Categoria</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="w-12 px-2 py-2 text-center" aria-label="Ações" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cycleTxns.map((t) => {
                  const d = t.date.slice(0, 10);
                  const inC = !!(cycleRange && d >= cycleRange.startIso && d <= cycleRange.endIso);
                  const willSkip = !inC || cycleIsPast;
                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${t.skipCardInvoiceDelta ? "opacity-[0.72]" : ""}`}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 dark:text-slate-400">
                        {formatDateShort(t.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-start gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-primary dark:bg-slate-700 dark:text-blue-200">
                            <span className="material-symbols-outlined text-[18px]">{categoryMaterialIcon(t.category)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-primary dark:text-slate-100">{t.description}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {willSkip ? (
                                <span className="text-amber-800 dark:text-amber-300">Só histórico</span>
                              ) : (
                                <span className="text-secondary dark:text-emerald-300">Fatura atual</span>
                              )}
                              {t.skipCardInvoiceDelta ? " · importação/histórico" : ""}
                            </div>
                            {t.justification?.trim() ? (
                              <p className="mt-1 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-500">{t.justification.trim()}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400">{t.category}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-primary dark:text-slate-100">
                        {formatBRL(t.amount)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800 dark:hover:text-blue-300"
                          aria-label="Editar lançamento"
                          onClick={() => {
                            setInvoiceEditingTxn(t);
                            setInvoiceTxnFormOpen(true);
                          }}
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
