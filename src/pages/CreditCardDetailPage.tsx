import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { AttachmentPreviewModal } from "../components/AttachmentPreviewModal";
import { CardBrandLogo } from "../components/CardBrandLogo";
import { CreditCardStatementModal } from "../components/CreditCardStatementModal";
import { CreditCardThirdPartyModal } from "../components/CreditCardThirdPartyModal";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { BENEFIT_BUCKET_LABEL } from "../domain/cardWallet";
import type { BenefitBucket } from "../domain/types";
import {
  creditCardDueStatus,
  daysUntilCreditCardClosing,
  daysUntilCreditCardDue,
  formatCardBillingDayLabel,
  formatDateShort,
  formatNextClosingShort,
  formatStatementInvoiceCyclePt,
  referenceMonthForCardTransaction,
  statementInvoiceCycleIsoRange,
} from "../domain/money";
import type { CreditCardStatement, Transaction } from "../domain/types";

const HERO_CARD_IMG =
  "https://lh3.googleusercontent.com/aida/ADBb0uhr8rBKS9A9DSpeE2Y9t1NzGHmHAyaudl9p1-SvB16C3_zijn_cqKeVokNfdAxWEdiUUoqhuYavySoTKwPGQh-zHadYLdB5e93Jc0bIQK_i8JUHALOPQPul37bmZy-vl_njHVWC4AXD4M_NMQgz8M9elLcmazeFKP-QiEmKMzbCXrLj2M8M2ev3SWygkJJgMPFOaRJ1E7MwCgs427w3l3_11l4LY-JiQhAtCAJUaGdKHq-MMN3g8sdetnEhYxgVj-lnee0ettZ0Kk0";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function categoryMaterialIcon(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("aliment")) return "restaurant";
  if (c.includes("transport")) return "local_gas_station";
  if (c.includes("saúde") || c.includes("saude")) return "medical_services";
  if (c.includes("lazer")) return "confirmation_number";
  if (c.includes("serv")) return "shopping_bag";
  return "shopping_bag";
}

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseYmFirstDay(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return new Date();
  return new Date(y, m - 1, 1);
}

/** Meses YYYY-MM consecutivos de startYm até endYm (inclusive), na ordem cronológica. */
function eachYmInclusiveFromTo(startYm: string, endYm: string): string[] {
  if (startYm > endYm) return [];
  const out: string[] = [];
  let d = parseYmFirstDay(startYm);
  const endT = parseYmFirstDay(endYm).getTime();
  while (d.getTime() <= endT) {
    out.push(ymKey(d));
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return out;
}

const INVOICE_HISTORY_MAX_MONTHS = 48;

type InvoiceHistoryHorizon = 4 | 8 | 12 | 24 | "all";

export function CreditCardDetailPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const {
    state,
    patchTransaction,
    addCreditCardStatement,
    updateCreditCardStatement,
    deleteCreditCardStatement,
    resetCreditCardActivity,
  } = useFinance();

  const card = cardId ? state.creditCards.find((c) => c.id === cardId) : undefined;
  const [thirdPartyTxn, setThirdPartyTxn] = useState<Transaction | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementEditing, setStatementEditing] = useState<CreditCardStatement | null>(null);
  const [statementPrefill, setStatementPrefill] = useState<{
    referenceMonth: string;
    amount: number;
  } | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<{ dataUrl: string; name: string } | null>(null);
  /** Mês YYYY-MM do ponto clicado — detalhe da fatura / ciclo */
  const [invoiceDetailYm, setInvoiceDetailYm] = useState<string | null>(null);
  const [invoiceHistoryHorizonStr, setInvoiceHistoryHorizonStr] = useState<string>("4");

  const cardTxns = useMemo(() => {
    if (!cardId) return [];
    return [...state.transactions]
      .filter((t) => t.creditCardId === cardId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [state.transactions, cardId]);

  const statements = useMemo(() => {
    if (!cardId) return [];
    return [...state.creditCardStatements]
      .filter((s) => s.creditCardId === cardId)
      .sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth));
  }, [state.creditCardStatements, cardId]);

  /**
   * Soma dos `amount` no cartão por mês de referência do ciclo (negativo = compra, positivo = estorno).
   * Inclui lançamentos com `skipCardInvoiceDelta` (usado no gráfico por ciclo).
   */
  const rawAmountSumByReferenceMonth = useMemo(() => {
    const map = new Map<string, number>();
    if (!card || card.kind !== "credito") return map;
    const closing = card.closingDay;
    for (const t of cardTxns) {
      const ref = referenceMonthForCardTransaction(t.date, closing);
      if (!ref) continue;
      map.set(ref, (map.get(ref) ?? 0) + t.amount);
    }
    return map;
  }, [card, cardTxns]);

  const invoiceHistoryHorizon: InvoiceHistoryHorizon =
    invoiceHistoryHorizonStr === "all"
      ? "all"
      : ([4, 8, 12, 24].includes(Number(invoiceHistoryHorizonStr))
          ? (Number(invoiceHistoryHorizonStr) as 4 | 8 | 12 | 24)
          : 4);

  const invoiceHistorySeries = useMemo(() => {
    if (!card || card.kind !== "credito") return [];
    const now = new Date();
    const nowYm = ymKey(now);

    let ymList: string[] = [];

    if (invoiceHistoryHorizon === "all") {
      const fromData = new Set<string>();
      for (const s of statements) {
        if (/^\d{4}-\d{2}$/.test(s.referenceMonth)) fromData.add(s.referenceMonth);
      }
      for (const ym of rawAmountSumByReferenceMonth.keys()) {
        if (/^\d{4}-\d{2}$/.test(ym)) fromData.add(ym);
      }
      fromData.add(nowYm);
      if (fromData.size <= 1) {
        for (let i = 3; i >= 0; i--) {
          ymList.push(ymKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
        }
      } else {
        const sorted = [...fromData].sort();
        const minYm = sorted[0]!;
        ymList = eachYmInclusiveFromTo(minYm, nowYm);
        if (ymList.length > INVOICE_HISTORY_MAX_MONTHS) {
          ymList = ymList.slice(-INVOICE_HISTORY_MAX_MONTHS);
        }
      }
    } else {
      const n = invoiceHistoryHorizon;
      for (let i = n - 1; i >= 0; i--) {
        ymList.push(ymKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
      }
    }

    return ymList.map((ym, idx, arr) => {
      const d = parseYmFirstDay(ym);
      const st = statements.find((s) => s.referenceMonth === ym);
      const rawSum = rawAmountSumByReferenceMonth.get(ym) ?? 0;
      const fromTxns = Math.max(0, -rawSum);
      const amount = st != null ? st.amount : fromTxns;
      const label = d
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(/\./g, "")
        .toUpperCase()
        .slice(0, 3);
      const isCurrent = idx === arr.length - 1;
      return { ym, label, amount, isCurrent };
    });
  }, [card, statements, rawAmountSumByReferenceMonth, invoiceHistoryHorizon]);

  const invoiceDetailCycleTxns = useMemo(() => {
    if (!invoiceDetailYm || !card || card.kind !== "credito") return [];
    const r = statementInvoiceCycleIsoRange(invoiceDetailYm, card.closingDay);
    if (!r) return [];
    return cardTxns
      .filter((t) => {
        const day = t.date.slice(0, 10);
        return day >= r.startIso && day <= r.endIso;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [invoiceDetailYm, card, cardTxns]);

  useEffect(() => {
    if (!invoiceDetailYm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInvoiceDetailYm(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [invoiceDetailYm]);

  const categoryRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of cardTxns) {
      if (t.amount >= 0) continue;
      const k = t.category.trim() || "Outros";
      map.set(k, (map.get(k) ?? 0) + Math.abs(t.amount));
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    if (total <= 0) {
      return [
        { name: "Alimentação", pct: 35, dot: "bg-primary" },
        { name: "Transporte", pct: 22, dot: "bg-[#7490c3]" },
        { name: "Lazer", pct: 18, dot: "bg-[#cee6f3]" },
        { name: "Saúde", pct: 15, dot: "bg-[#4b626c]" },
        { name: "Outros", pct: 10, dot: "bg-[#e0e3e5]" },
      ];
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const dots = ["bg-primary", "bg-[#7490c3]", "bg-[#cee6f3]", "bg-[#4b626c]", "bg-[#e0e3e5]"];
    const top = sorted.slice(0, 4);
    const rest = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
    const rowsOut: { name: string; pct: number; dot: string }[] = [];
    top.forEach(([name, v], i) => {
      rowsOut.push({ name, pct: Math.round((v / total) * 100), dot: dots[i % dots.length]! });
    });
    if (rest > 0) {
      rowsOut.push({ name: "Outros", pct: Math.round((rest / total) * 100), dot: dots[4]! });
    }
    return rowsOut;
  }, [cardTxns]);

  const aiInsight = useMemo(() => {
    const now = new Date();
    const thisYm = ymKey(now);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYm = ymKey(prev);
    let thisSpend = 0;
    let prevSpend = 0;
    for (const t of cardTxns) {
      if (t.amount >= 0) continue;
      const ym = t.date.slice(0, 7);
      const v = Math.abs(t.amount);
      if (ym === thisYm) thisSpend += v;
      if (ym === prevYm) prevSpend += v;
    }
    if (prevSpend > 0 && thisSpend > 0) {
      const delta = Math.round(((thisSpend - prevSpend) / prevSpend) * 100);
      if (delta >= 5) {
        return `Detectamos um aumento de ${delta}% nos gastos deste cartão em relação ao mês anterior. Que tal rever seu orçamento de lazer?`;
      }
      if (delta <= -5) {
        return `Seus gastos neste cartão caíram cerca de ${Math.abs(delta)}% em relação ao mês anterior. Bom controle!`;
      }
    }
    return "Acompanhe lançamentos e faturas para manter o limite sob controle. Use a importação por IA para registrar fechamentos com praticidade.";
  }, [cardTxns]);

  if (!cardId || !card) {
    return <Navigate to="/" replace />;
  }

  const isCredito = card.kind === "credito";
  const due = isCredito ? creditCardDueStatus(card.dueDay) : null;
  const available = isCredito ? Math.max(0, card.creditLimit - card.currentInvoice) : 0;
  const usedPct =
    isCredito && card.creditLimit > 0
      ? Math.min(100, Math.round((card.currentInvoice / card.creditLimit) * 100))
      : 0;
  const dDue = isCredito ? daysUntilCreditCardDue(card.dueDay) : 0;
  const dClose = isCredito ? daysUntilCreditCardClosing(card.closingDay) : 0;
  const dueHint =
    dDue < 0
      ? `${Math.abs(dDue)} dia(s) de atraso`
      : dDue === 0
        ? "Vence hoje"
        : `Faltam ${dDue} dia(s) para o vencimento`;

  const recentTxns = cardTxns.slice(0, 5);

  const cycleModalStatement = invoiceDetailYm ? statements.find((s) => s.referenceMonth === invoiceDetailYm) : undefined;
  const cycleModalRange =
    invoiceDetailYm && isCredito ? statementInvoiceCycleIsoRange(invoiceDetailYm, card.closingDay) : null;
  const cycleModalRawSum =
    invoiceDetailYm && isCredito ? (rawAmountSumByReferenceMonth.get(invoiceDetailYm) ?? 0) : 0;
  const cycleModalNetFromTxns = Math.max(0, -cycleModalRawSum);
  const cycleModalTotal =
    cycleModalStatement != null ? cycleModalStatement.amount : cycleModalNetFromTxns;

  return (
    <div className="mx-auto max-w-7xl space-y-3 px-3 pb-24 md:space-y-4 md:px-6 md:pb-8">
      <CreditCardThirdPartyModal
        open={thirdPartyTxn !== null}
        transaction={thirdPartyTxn}
        onClose={() => setThirdPartyTxn(null)}
        onSave={(name) => {
          if (thirdPartyTxn) patchTransaction(thirdPartyTxn.id, { thirdPartyName: name });
        }}
      />
      <AttachmentPreviewModal
        open={attachmentPreview !== null}
        onClose={() => setAttachmentPreview(null)}
        dataUrl={attachmentPreview?.dataUrl ?? null}
        fileName={attachmentPreview?.name ?? null}
      />
      {invoiceDetailYm && isCredito ? (
        <div
          className="fixed inset-0 z-[125] flex items-center justify-center bg-black/50 p-3"
          role="dialog"
          aria-modal
          aria-labelledby="inv-cycle-title"
          onClick={() => setInvoiceDetailYm(null)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-outline-variant/20 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-outline-variant/25 px-4 py-3 dark:border-slate-700">
              <div className="min-w-0">
                <h2 id="inv-cycle-title" className="font-headline text-lg font-bold text-primary dark:text-slate-100">
                  {monthLabel(invoiceDetailYm)}
                </h2>
                {cycleModalRange ? (
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    Período: {formatStatementInvoiceCyclePt(cycleModalRange)}
                  </p>
                ) : null}
                <p className="mt-2 text-sm font-semibold text-primary dark:text-slate-100">
                  Total (gráfico): {formatBRL(cycleModalTotal)}
                  {cycleModalStatement ? (
                    <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">· fatura salva</span>
                  ) : (
                    <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">· líquido dos lançamentos</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setInvoiceDetailYm(null)}
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="flex shrink-0 flex-col gap-2 border-b border-outline-variant/15 px-4 py-3 dark:border-slate-700 sm:flex-row sm:flex-wrap sm:items-center">
              {cycleModalStatement ? (
                <>
                  {cycleModalStatement.attachmentDataUrl ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary-container/30 px-3 py-2 text-xs font-semibold text-primary shadow-sm transition-colors hover:bg-primary-container/50 dark:border-blue-600/50 dark:bg-blue-950/50 dark:text-blue-100 dark:hover:bg-blue-900/50"
                      onClick={() =>
                        setAttachmentPreview({
                          dataUrl: cycleModalStatement.attachmentDataUrl!,
                          name: cycleModalStatement.attachmentName ?? "fatura",
                        })
                      }
                    >
                      <span className="material-symbols-outlined text-[18px]">description</span>
                      Ver fatura
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg border border-outline-variant/50 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    onClick={() => {
                      setInvoiceDetailYm(null);
                      setStatementPrefill(null);
                      setStatementEditing(cycleModalStatement);
                      setStatementOpen(true);
                    }}
                  >
                    Editar fatura
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 dark:bg-blue-950/30 dark:hover:bg-blue-900/40"
                  onClick={() => {
                    setInvoiceDetailYm(null);
                    setStatementEditing(null);
                    setStatementPrefill({
                      referenceMonth: invoiceDetailYm,
                      amount: cycleModalNetFromTxns,
                    });
                    setStatementOpen(true);
                  }}
                >
                  Registrar esta fatura
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
              {invoiceDetailCycleTxns.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Nenhum lançamento neste período.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-700">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80">
                      <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="px-3 py-2">Data</th>
                        <th className="px-3 py-2">Descrição</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                      {invoiceDetailCycleTxns.map((t) => (
                        <tr
                          key={t.id}
                          className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${t.skipCardInvoiceDelta ? "opacity-[0.72]" : ""}`}
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400">
                            {formatDateShort(t.date)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-primary dark:text-slate-100">{t.description}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {t.category}
                              {t.skipCardInvoiceDelta ? " · só histórico" : ""}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-primary dark:text-slate-100">
                            {formatBRL(t.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <CreditCardStatementModal
        open={statementOpen}
        creditCardId={card.id}
        enableStatementAi={isCredito}
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
            addCreditCardStatement({
              creditCardId: card.id,
              ...data,
            });
          }
        }}
      />

      {/* Toolbar estilo mock (voltar + contexto) */}
      <div className="-mb-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Voltar"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <Link
          to="/"
          className="text-xs font-semibold text-[#002855] underline-offset-2 hover:underline dark:text-blue-200"
        >
          Painel
        </Link>
      </div>

      {/* Card header */}
      <section className="flex flex-col justify-between gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md bg-primary-container text-on-primary">
            {isCredito ? (
              <span className="material-symbols-outlined filled text-lg">credit_card</span>
            ) : (
              <CardBrandLogo brand={card.brand} className="!h-7 !w-12" imgClassName="max-h-5 object-contain" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="font-headline text-xl font-bold tracking-tight text-primary md:text-2xl md:leading-snug">
                {card.name}
              </h1>
              <span className="rounded-full bg-secondary-container px-1.5 py-0.5 font-label text-[10px] font-semibold uppercase tracking-wide text-on-secondary-container">
                {isCredito ? "Ativo" : "Benefícios"}
              </span>
            </div>
            <p className="mt-0.5 font-body text-xs text-slate-600 dark:text-slate-400">
              Final •••• {card.last4}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isCredito && (
            <button
              type="button"
              onClick={() => navigate(`/lancamentos?novo=1&cartao=${card.id}`)}
              className="flex items-center gap-1.5 rounded-lg bg-surface-container-highest px-3 py-1.5 font-label text-xs font-semibold text-primary transition-colors hover:bg-surface-container-high dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <span className="material-symbols-outlined text-[18px]">payments</span>
              Registrar pagamento
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(`/lancamentos?novo=1&cartao=${card.id}`)}
            className="flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-1.5 font-label text-xs font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[18px]">add_card</span>
            Novo lançamento
          </button>
          <button
            type="button"
            onClick={() => alert("Exporte o backup em Configurações para guardar todos os dados.")}
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 px-2.5 py-1.5 font-label text-[11px] font-semibold text-primary dark:border-slate-600"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Backup
          </button>
        </div>
      </section>

      {/* Métricas */}
      {isCredito ? (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-surface-container bg-white p-4 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
            <p className="mb-1 font-label text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Fatura atual
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-xl font-semibold tabular-nums text-primary md:text-[22px]">
                {formatBRL(card.currentInvoice)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-container dark:bg-slate-800">
                <div className="h-full rounded-full bg-primary" style={{ width: `${usedPct}%` }} />
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">{usedPct}%</span>
            </div>
            <p
              className={`mt-1.5 flex items-center gap-1 text-xs ${
                due === "overdue" ? "text-error" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <span className="material-symbols-outlined text-sm">schedule</span>
              {dueHint}
            </p>
          </div>
          <div className="rounded-lg border border-surface-container bg-white p-4 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
            <p className="mb-1 font-label text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Limite disponível
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-xl font-semibold tabular-nums text-primary md:text-[22px]">
                {formatBRL(available)}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Total: {formatBRL(card.creditLimit)}
            </p>
          </div>
          <div className="flex flex-col justify-between rounded-lg border border-surface-container bg-white p-4 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
            <div>
              <p className="mb-1 font-label text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Próximo fechamento
              </p>
              <div className="flex items-center gap-1.5">
                <span className="font-headline text-xl font-semibold capitalize tabular-nums text-primary md:text-[22px]">
                  {formatNextClosingShort(card.closingDay)}
                </span>
                <span className="material-symbols-outlined text-base text-outline-variant dark:text-slate-500">
                  calendar_today
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {formatCardBillingDayLabel(card.closingDay)}
              </p>
            </div>
            <p
              className={`mt-1.5 flex items-center gap-1 text-xs ${
                dClose <= 7 ? "text-error" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <span className="material-symbols-outlined text-sm">schedule</span>
              {dClose < 0
                ? "Fechamento já ocorreu neste ciclo"
                : dClose === 0
                  ? "Fecha hoje"
                  : `Faltam ${dClose} dia${dClose === 1 ? "" : "s"}`}
            </p>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["refeicao", "alimentacao", "mobilidade"] as BenefitBucket[]).map((b) => (
            <div
              key={b}
              className="rounded-lg border border-surface-container bg-white p-4 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="mb-1 font-label text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {BENEFIT_BUCKET_LABEL[b]}
              </p>
              <span className="font-headline text-xl font-semibold tabular-nums text-primary">{formatBRL(card.benefitBalances[b])}</span>
            </div>
          ))}
        </section>
      )}

      <details className="rounded-lg border border-red-200/80 bg-white/90 py-2 pl-3 pr-2 text-xs shadow-[0px_2px_8px_rgba(0,40,85,0.04)] dark:border-red-900/50 dark:bg-slate-900/80">
        <summary className="cursor-pointer list-none font-semibold text-error marker:content-none [&::-webkit-details-marker]:hidden">
          Zerar este cartão (testes do zero)
        </summary>
        <p className="mt-1.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
          Apaga <strong className="text-on-surface dark:text-slate-200">todos</strong> os lançamentos deste cartão e as
          faturas arquivadas. Zera a fatura em aberto (crédito) ou as bolsas (benefícios). Não altera outras contas nem
          outros cartões.
        </p>
        <button
          type="button"
          className="mt-2 rounded border border-error/50 bg-error/10 px-2 py-1.5 text-[10px] font-bold text-error hover:bg-error/15 dark:border-red-800 dark:bg-red-950/40"
          onClick={() => {
            if (
              !confirm(
                "Apagar todos os lançamentos e faturas arquivadas deste cartão? A fatura / bolsas voltam a zero. Não dá para desfazer.",
              )
            ) {
              return;
            }
            resetCreditCardActivity(card.id);
            setInvoiceDetailYm(null);
          }}
        >
          Zerar agora
        </button>
      </details>

      {/* Bento: IA + gráficos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-stretch">
        <div className="lg:col-span-4">
          <div className="relative flex h-full min-h-0 flex-col justify-between gap-3 overflow-hidden rounded-xl bg-primary-container p-4 text-on-primary lg:min-h-[11rem]">
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 min-h-0">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-lg text-primary-fixed">auto_awesome</span>
                <span className="font-headline text-base font-semibold text-on-primary">Análise IA</span>
              </div>
              <p className="line-clamp-4 font-body text-xs leading-snug text-white/85">{aiInsight}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/assistente")}
              className="relative z-10 mt-1 flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white py-2 font-label text-xs font-semibold text-primary shadow-md transition-all hover:bg-primary-fixed dark:text-primary"
            >
              <span className="material-symbols-outlined text-[18px]">psychology</span>
              Analisar com IA
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:col-span-8">
          {isCredito ? (
            <>
              <div className="flex flex-col rounded-xl border border-surface-container bg-white p-4 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-headline text-base font-semibold text-primary">Histórico de faturas</h3>
                  <label className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Período</span>
                    <select
                      value={invoiceHistoryHorizonStr}
                      onChange={(e) => setInvoiceHistoryHorizonStr(e.target.value)}
                      className="max-w-[11rem] cursor-pointer rounded-lg border border-slate-200 bg-surface-container-high py-1 pl-2 pr-7 text-[10px] font-semibold text-primary shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-blue-200"
                      aria-label="Quantidade de meses no gráfico"
                    >
                      <option value="4">4 meses</option>
                      <option value="8">8 meses</option>
                      <option value="12">12 meses</option>
                      <option value="24">24 meses</option>
                      <option value="all">Desde o 1º dado (máx. {INVOICE_HISTORY_MAX_MONTHS} m.)</option>
                    </select>
                  </label>
                </div>
                <p className="mb-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                  Ciclo pelo fechamento do cartão. Toque em um ponto para ver lançamentos e a fatura anexada.
                </p>
                {(() => {
                  const VB_W = 320;
                  const VB_H = 128;
                  const padL = 6;
                  const padR = 6;
                  const padT = 18;
                  const padB = 24;
                  const plotW = VB_W - padL - padR;
                  const plotH = VB_H - padT - padB;
                  const series = invoiceHistorySeries;
                  if (series.length === 0) {
                    return (
                      <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
                        Sem dados para o gráfico.
                      </p>
                    );
                  }
                  const maxVal = Math.max(1, ...series.map((s) => s.amount));
                  const pts = series.map((s, i) => {
                    const n = series.length;
                    const x = padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
                    const y = padT + plotH * (1 - s.amount / maxVal);
                    return { x, y, ...s };
                  });
                  const linePoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
                  const labelStep = Math.max(1, Math.ceil(series.length / 8));
                  const valueStep = series.length > 12 ? labelStep : 1;
                  const showValueAt = (idx: number) =>
                    idx % valueStep === 0 ||
                    idx === pts.length - 1 ||
                    invoiceDetailYm === pts[idx]!.ym;
                  return (
                    <div className="w-full shrink-0 overflow-x-auto rounded-lg border border-slate-100/90 bg-slate-50/50 dark:border-slate-700/80 dark:bg-slate-800/30">
                      <svg
                        viewBox={`0 0 ${VB_W} ${VB_H}`}
                        className="mx-auto block h-[8rem] min-w-[260px] w-full max-w-full"
                        preserveAspectRatio="xMidYMid meet"
                        role="img"
                        aria-label="Evolução do total por mês de referência do ciclo"
                      >
                        <desc>Totais por mês de referência da fatura; toque nos pontos para detalhes.</desc>
                        {[0, 0.5, 1].map((t) => {
                          const gy = padT + plotH * (1 - t);
                          return (
                            <line
                              key={t}
                              x1={padL}
                              x2={VB_W - padR}
                              y1={gy}
                              y2={gy}
                              className="stroke-slate-200 dark:stroke-slate-600"
                              strokeWidth={1}
                              strokeDasharray="3 4"
                              strokeOpacity={0.85}
                            />
                          );
                        })}
                        <polyline
                          fill="none"
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          className="stroke-primary dark:stroke-blue-400"
                          points={linePoints}
                        />
                        {pts.map((p, idx) => {
                          if (!showValueAt(idx)) return null;
                          const vy = Math.max(10, p.y - (idx % 2 === 0 ? 10 : 14));
                          return (
                            <text
                              key={`${p.ym}-val`}
                              x={p.x}
                              y={vy}
                              textAnchor="middle"
                              className="pointer-events-none fill-primary font-bold tabular-nums dark:fill-blue-300"
                              style={{ fontSize: series.length > 16 ? 6.5 : 7.5 }}
                            >
                              {formatBRL(p.amount)}
                            </text>
                          );
                        })}
                        {pts.map((p) => {
                          const isOpen = invoiceDetailYm === p.ym;
                          return (
                            <circle
                              key={p.ym}
                              role="button"
                              tabIndex={0}
                              cx={p.x}
                              cy={p.y}
                              r={isOpen ? 6 : 4}
                              className={`cursor-pointer transition-all ${
                                isOpen
                                  ? "fill-primary stroke-white stroke-[2.5] dark:fill-blue-400 dark:stroke-slate-900"
                                  : p.isCurrent
                                    ? "fill-white stroke-primary stroke-[2] dark:fill-slate-900 dark:stroke-blue-400"
                                    : "fill-white stroke-slate-300 stroke-[1.5] dark:fill-slate-900 dark:stroke-slate-500"
                              }`}
                              onClick={() => setInvoiceDetailYm(p.ym)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setInvoiceDetailYm(p.ym);
                                }
                              }}
                            >
                              <title>
                                {p.ym}: {formatBRL(p.amount)}
                              </title>
                            </circle>
                          );
                        })}
                        {pts.map((p, idx) => {
                          const showLabel = idx % labelStep === 0 || idx === pts.length - 1;
                          if (!showLabel) return null;
                          return (
                            <text
                              key={`${p.ym}-lbl`}
                              x={p.x}
                              y={VB_H - 5}
                              textAnchor={idx === 0 ? "start" : idx === pts.length - 1 ? "end" : "middle"}
                              className="pointer-events-none fill-slate-500 text-[8px] font-semibold uppercase dark:fill-slate-400"
                              style={{ fontSize: 8 }}
                            >
                              {p.label}
                            </text>
                          );
                        })}
                      </svg>
                    </div>
                  );
                })()}
                <p className="mt-1 text-[9px] text-slate-400 dark:text-slate-500">
                  Máximo no período:{" "}
                  {formatBRL(
                    invoiceHistorySeries.length > 0
                      ? Math.max(...invoiceHistorySeries.map((s) => s.amount))
                      : 0,
                  )}
                </p>
                <div className="mt-3 flex flex-wrap justify-end gap-1.5 border-t border-surface-container/80 pt-2 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => {
                      setStatementEditing(null);
                      setStatementPrefill(null);
                      setStatementOpen(true);
                    }}
                    className="text-[10px] font-semibold text-primary hover:underline dark:text-blue-300"
                  >
                    + Registrar fatura
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatementEditing(null);
                      setStatementPrefill({
                        referenceMonth: new Date().toISOString().slice(0, 7),
                        amount: card.currentInvoice,
                      });
                      setStatementOpen(true);
                    }}
                    className="rounded border border-outline-variant/30 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-surface-container-low dark:border-slate-600"
                  >
                    Usar fatura atual ({formatBRL(card.currentInvoice)})
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-surface-container bg-white p-4 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
                <h3 className="mb-2 font-headline text-base font-semibold text-primary">Gastos por categoria</h3>
                <div className="space-y-1.5">
                  {categoryRows.map((row) => (
                    <div key={row.name} className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`} />
                      <div className="min-w-0 flex-1 truncate text-xs text-on-surface dark:text-slate-200">{row.name}</div>
                      <div className="shrink-0 text-xs font-semibold text-primary dark:text-slate-100">{row.pct}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-surface-container bg-white p-4 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900 md:col-span-2">
                <h3 className="mb-2 font-headline text-base font-semibold text-primary">Gastos por categoria</h3>
                <div className="space-y-1.5">
                  {categoryRows.map((row) => (
                    <div key={row.name} className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`} />
                      <div className="min-w-0 flex-1 truncate text-xs">{row.name}</div>
                      <div className="shrink-0 text-xs font-semibold">{row.pct}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Faturas arquivadas (crédito) */}
      {isCredito ? (
        <section className="rounded-xl border border-surface-container bg-white p-4 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-headline text-base font-semibold text-primary">Faturas arquivadas</h3>
            <button
              type="button"
              onClick={() => {
                setStatementEditing(null);
                setStatementPrefill(null);
                setStatementOpen(true);
              }}
              className="text-xs font-semibold text-primary hover:underline dark:text-blue-300"
            >
              + Registrar
            </button>
          </div>
          {statements.length === 0 ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Nenhuma fatura arquivada. Use &quot;+ Registrar&quot; para guardar um fechamento com anexo.
            </p>
          ) : (
          <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1">
            {statements.map((s) => {
              const cycle = statementInvoiceCycleIsoRange(s.referenceMonth, card.closingDay);
              return (
              <div
                key={s.id}
                className="w-[min(100%,240px)] shrink-0 rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-3 dark:border-slate-700 dark:bg-slate-800/80"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-label text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {monthLabel(s.referenceMonth)}
                    </p>
                    <p className="mt-0.5 font-headline text-sm font-bold tabular-nums text-primary dark:text-slate-100">{formatBRL(s.amount)}</p>
                    {cycle ? (
                      <p className="mt-1 text-[9px] leading-tight text-slate-500 dark:text-slate-400">
                        Período: {formatStatementInvoiceCyclePt(cycle)}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 font-label text-[10px] font-semibold uppercase ${
                      s.status === "paga"
                        ? "bg-secondary-container text-on-secondary-container"
                        : "bg-surface-container-highest text-primary dark:bg-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {s.status === "paga" ? "Paga" : "Aberta"}
                  </span>
                </div>
                {s.note ? <p className="mb-1 text-[10px] text-slate-600 dark:text-slate-400">{s.note}</p> : null}
                <div className="flex flex-wrap gap-1.5 border-t border-outline-variant/10 pt-2 dark:border-slate-600">
                  {s.attachmentDataUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachmentPreview({
                            dataUrl: s.attachmentDataUrl!,
                            name: s.attachmentName ?? "fatura",
                          })
                        }
                        className="flex items-center text-[11px] font-semibold text-primary hover:underline dark:text-blue-300"
                      >
                        <span className="material-symbols-outlined mr-0.5 text-sm">description</span>
                        Ver fatura
                      </button>
                      <a
                        href={s.attachmentDataUrl}
                        download={s.attachmentName ?? "fatura"}
                        className="flex items-center text-[11px] font-semibold text-primary hover:underline"
                      >
                        <span className="material-symbols-outlined mr-0.5 text-sm">download</span>
                        Baixar
                      </a>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setStatementPrefill(null);
                      setStatementEditing(s);
                      setStatementOpen(true);
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Remover este registro de fatura?")) deleteCreditCardStatement(s.id);
                    }}
                    className="text-[11px] font-semibold text-error hover:underline"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
            })}
          </div>
          )}
        </section>
      ) : null}

      {/* Lançamentos recentes */}
      <section className="overflow-hidden rounded-xl border border-surface-container bg-white shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-surface-container px-4 py-2.5 dark:border-slate-700">
          <h3 className="font-headline text-base font-semibold text-primary">Lançamentos recentes</h3>
          <Link
            to={`/lancamentos?cartao=${card.id}`}
            className="font-label text-xs font-semibold text-primary-container hover:underline dark:text-blue-300"
          >
            Ver todos
          </Link>
        </div>
        {cardTxns.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-600 dark:text-slate-400">
            Nenhum lançamento ainda. Use &quot;Novo lançamento&quot; ou cadastre em Lançamentos.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low font-label text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/80 dark:text-slate-400">
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container dark:divide-slate-700">
                {recentTxns.map((t) => (
                  <tr
                    key={t.id}
                    className="group transition-colors hover:bg-surface-container-low dark:hover:bg-slate-800/50"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                      {formatDateShort(t.date)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary-container text-primary dark:bg-slate-700 dark:text-blue-200">
                          <span className="material-symbols-outlined text-[16px]">{categoryMaterialIcon(t.category)}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-primary dark:text-slate-100">{t.description}</span>
                          {t.thirdPartyName ? (
                            <button
                              type="button"
                              onClick={() => setThirdPartyTxn(t)}
                              className="mt-0.5 block truncate text-left text-[10px] font-semibold text-slate-500 hover:underline dark:text-slate-400"
                            >
                              {t.thirdPartyName}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setThirdPartyTxn(t)}
                              className="mt-0.5 block text-[10px] font-semibold text-slate-500 hover:text-primary dark:text-slate-400"
                            >
                              Atribuir pessoa
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex max-w-[8rem] truncate rounded-full bg-surface-container px-2 py-0.5 font-label text-[9px] font-semibold uppercase tracking-wide text-on-surface-variant dark:bg-slate-800 dark:text-slate-300">
                        {(t.category || "—").slice(0, 24)}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 text-right text-xs font-semibold tabular-nums ${
                        t.amount < 0 ? "text-primary dark:text-slate-100" : "text-secondary dark:text-emerald-400"
                      }`}
                    >
                      {formatBRL(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Hero */}
      <section className="relative h-[160px] overflow-hidden rounded-2xl shadow-lg md:h-[180px]">
        <img alt="" src={HERO_CARD_IMG} className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-primary/80 to-transparent p-4 md:p-5">
          <p className="mb-1 font-headline text-base font-semibold text-on-primary md:text-lg">Segurança em primeiro lugar</p>
          <p className="max-w-md font-body text-xs leading-snug text-white/90 md:text-sm">
            Seus dados são protegidos por criptografia de ponta a ponta. Mantenha o backup em Configurações.
          </p>
        </div>
      </section>
    </div>
  );
}
