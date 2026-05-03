import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
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
} from "../domain/money";
import type { CreditCardStatement, Transaction } from "../domain/types";

const HERO_CARD_IMG =
  "https://lh3.googleusercontent.com/aida/ADBb0uhr8rBKS9A9DSpeE2Y9t1NzGHmHAyaudl9p1-SvB16C3_zijn_cqKeVokNfdAxWEdiUUoqhuYavySoTKwPGQh-zHadYLdB5e93Jc0bIQK_i8JUHALOPQPul37bmZy-vl_njHVWC4AXD4M_NMQgz8M9elLcmazeFKP-QiEmKMzbCXrLj2M8M2ev3SWygkJJgMPFOaRJ1E7MwCgs427w3l3_11l4LY-JiQhAtCAJUaGdKHq-MMN3g8sdetnEhYxgVj-lnee0ettZ0Kk0";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function firstDayOfMonthIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
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

export function CreditCardDetailPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const {
    state,
    patchTransaction,
    addCreditCardStatement,
    updateCreditCardStatement,
    deleteCreditCardStatement,
    syncCreditCardOpenInvoice,
  } = useFinance();

  const card = cardId ? state.creditCards.find((c) => c.id === cardId) : undefined;
  const [thirdPartyTxn, setThirdPartyTxn] = useState<Transaction | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementEditing, setStatementEditing] = useState<CreditCardStatement | null>(null);
  const [statementPrefill, setStatementPrefill] = useState<{
    referenceMonth: string;
    amount: number;
  } | null>(null);
  const [invoiceCutDate, setInvoiceCutDate] = useState(() => firstDayOfMonthIso());

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

  const invoiceBars = useMemo(() => {
    const now = new Date();
    const rows: { ym: string; label: string; amount: number; isCurrent: boolean }[] = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = ymKey(d);
      const st = statements.find((s) => s.referenceMonth === ym);
      const label = d
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(/\./g, "")
        .toUpperCase()
        .slice(0, 3);
      rows.push({
        ym,
        label,
        amount: st?.amount ?? 0,
        isCurrent: i === 3,
      });
    }
    const max = Math.max(...rows.map((r) => r.amount), 1);
    return rows.map((r) => ({ ...r, heightPct: Math.round((r.amount / max) * 100) }));
  }, [statements]);

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

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-28 md:space-y-8 md:px-8 md:pb-12">
      <CreditCardThirdPartyModal
        open={thirdPartyTxn !== null}
        transaction={thirdPartyTxn}
        onClose={() => setThirdPartyTxn(null)}
        onSave={(name) => {
          if (thirdPartyTxn) patchTransaction(thirdPartyTxn.id, { thirdPartyName: name });
        }}
      />
      <CreditCardStatementModal
        open={statementOpen}
        creditCardId={card.id}
        enableStatementAi={isCredito}
        editing={statementEditing}
        prefill={statementEditing ? null : statementPrefill}
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
      <div className="flex items-center gap-3 md:gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Voltar"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <Link
          to="/"
          className="text-sm font-semibold text-[#002855] underline-offset-2 hover:underline dark:text-blue-200"
        >
          Painel
        </Link>
      </div>

      {/* Card header */}
      <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary">
            {isCredito ? (
              <span className="material-symbols-outlined filled text-[22px]">credit_card</span>
            ) : (
              <CardBrandLogo brand={card.brand} className="!h-8 !w-14" imgClassName="max-h-6 object-contain" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-headline text-3xl font-bold tracking-tight text-primary md:text-[32px] md:leading-tight">
                {card.name}
              </h1>
              <span className="rounded-full bg-secondary-container px-2 py-0.5 font-label text-[11px] font-semibold uppercase tracking-wider text-on-secondary-container">
                {isCredito ? "Ativo" : "Benefícios"}
              </span>
            </div>
            <p className="mt-1 font-body text-sm text-slate-600 dark:text-slate-400">
              Final •••• {card.last4}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {isCredito && (
            <button
              type="button"
              onClick={() => navigate(`/lancamentos?novo=1&cartao=${card.id}`)}
              className="flex items-center gap-2 rounded-xl bg-surface-container-highest px-6 py-2 font-label text-[15px] font-semibold text-primary transition-colors hover:bg-surface-container-high dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <span className="material-symbols-outlined text-[20px]">payments</span>
              Registrar pagamento
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(`/lancamentos?novo=1&cartao=${card.id}`)}
            className="flex items-center gap-2 rounded-xl bg-primary-container px-6 py-2 font-label text-[15px] font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[20px]">add_card</span>
            Novo lançamento
          </button>
          <button
            type="button"
            onClick={() => alert("Exporte o backup em Configurações para guardar todos os dados.")}
            className="flex items-center gap-2 rounded-xl border border-outline-variant/40 px-4 py-2 font-label text-[13px] font-semibold text-primary dark:border-slate-600"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Backup
          </button>
        </div>
      </section>

      {/* Métricas */}
      {isCredito ? (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-surface-container bg-white p-6 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
            <p className="mb-2 font-label text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Fatura atual
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-2xl font-semibold text-primary md:text-[24px]">
                {formatBRL(card.currentInvoice)}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container dark:bg-slate-800">
                <div className="h-full rounded-full bg-primary" style={{ width: `${usedPct}%` }} />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">{usedPct}%</span>
            </div>
            <p
              className={`mt-2 flex items-center gap-1 text-sm ${
                due === "overdue" ? "text-error" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <span className="material-symbols-outlined text-base">schedule</span>
              {dueHint}
            </p>
          </div>
          <div className="rounded-xl border border-surface-container bg-white p-6 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
            <p className="mb-2 font-label text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Limite disponível
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-2xl font-semibold text-primary md:text-[24px]">
                {formatBRL(available)}
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Total: {formatBRL(card.creditLimit)}
            </p>
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-surface-container bg-white p-6 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
            <div>
              <p className="mb-2 font-label text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Próximo fechamento
              </p>
              <div className="flex items-center gap-2">
                <span className="font-headline text-2xl font-semibold capitalize text-primary md:text-[24px]">
                  {formatNextClosingShort(card.closingDay)}
                </span>
                <span className="material-symbols-outlined text-outline-variant dark:text-slate-500">
                  calendar_today
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {formatCardBillingDayLabel(card.closingDay)}
              </p>
            </div>
            <p
              className={`mt-2 flex items-center gap-1 text-sm ${
                dClose <= 7 ? "text-error" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <span className="material-symbols-outlined text-base">schedule</span>
              {dClose < 0
                ? "Fechamento já ocorreu neste ciclo"
                : dClose === 0
                  ? "Fecha hoje"
                  : `Faltam ${dClose} dia${dClose === 1 ? "" : "s"}`}
            </p>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {(["refeicao", "alimentacao", "mobilidade"] as BenefitBucket[]).map((b) => (
            <div
              key={b}
              className="rounded-xl border border-surface-container bg-white p-6 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="mb-2 font-label text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {BENEFIT_BUCKET_LABEL[b]}
              </p>
              <span className="font-headline text-2xl font-semibold text-primary">{formatBRL(card.benefitBalances[b])}</span>
            </div>
          ))}
        </section>
      )}

      {isCredito ? (
        <details className="rounded-xl border border-outline-variant/25 bg-white/90 p-4 text-sm shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900/80">
          <summary className="cursor-pointer font-semibold text-primary dark:text-slate-100">
            Corrigir fatura atual (dados já gravados errados)
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Se importou fatura antiga pela IA e o valor da fatura aberta ficou alto, escolha uma{" "}
            <strong className="text-on-surface dark:text-slate-200">data de corte</strong>: todas as{" "}
            <strong className="text-on-surface dark:text-slate-200">despesas</strong> com data{" "}
            <strong className="text-on-surface dark:text-slate-200">antes</strong> dela passam a contar só como
            histórico (não entram na fatura aberta) e o total é recalculado. Ajuste a data ao seu caso (ex.: primeiro
            dia do mês do ciclo atual).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              Data de corte
              <input
                type="date"
                value={invoiceCutDate}
                onChange={(e) => setInvoiceCutDate(e.target.value)}
                className="rounded-lg border border-outline-variant/40 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (
                  !/^\d{4}-\d{2}-\d{2}$/.test(invoiceCutDate) ||
                  !confirm(
                    `Marcar despesas com data antes de ${invoiceCutDate} como só histórico e recalcular a fatura aberta?`,
                  )
                ) {
                  return;
                }
                syncCreditCardOpenInvoice(card.id, { markExpenseHistoryBefore: invoiceCutDate });
              }}
              className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-white dark:bg-emerald-700"
            >
              Marcar antes da data + recalcular
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm("Recalcular só a fatura aberta a partir dos lançamentos (sem alterar datas)?")) return;
                syncCreditCardOpenInvoice(card.id);
              }}
              className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold dark:border-slate-600"
            >
              Só recalcular
            </button>
          </div>
        </details>
      ) : null}

      {/* Bento: IA + gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <div className="relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-2xl bg-primary-container p-6 text-on-primary lg:min-h-[300px]">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10">
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed">auto_awesome</span>
                <span className="font-headline text-xl font-semibold text-on-primary">Análise IA</span>
              </div>
              <p className="mb-6 font-body text-base leading-relaxed text-white/85">{aiInsight}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/assistente")}
              className="relative z-10 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 font-label text-[15px] font-semibold text-primary shadow-lg transition-all hover:bg-primary-fixed dark:text-primary"
            >
              <span className="material-symbols-outlined text-[20px]">psychology</span>
              Analisar com IA
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-8">
          {isCredito ? (
            <>
              <div className="rounded-2xl border border-surface-container bg-white p-6 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
                <h3 className="mb-6 font-headline text-xl font-semibold text-primary">Histórico de faturas</h3>
                <div className="flex h-[200px] items-end justify-between gap-2 px-2 pt-2">
                  {invoiceBars.map((bar) => {
                    const barH = Math.max(Math.round((bar.heightPct / 100) * 168), 12);
                    return (
                      <div key={bar.ym} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                        <div
                          className={`w-full rounded-t-lg transition-all hover:opacity-90 ${
                            bar.isCurrent ? "bg-primary-container dark:bg-blue-900" : "bg-surface-container dark:bg-slate-800"
                          }`}
                          style={{ height: barH }}
                        />
                        <span
                          className={`shrink-0 font-label text-[11px] font-semibold uppercase tracking-wider ${
                            bar.isCurrent
                              ? "font-bold text-primary dark:text-blue-200"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {bar.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStatementEditing(null);
                      setStatementPrefill(null);
                      setStatementOpen(true);
                    }}
                    className="text-xs font-semibold text-primary hover:underline dark:text-blue-300"
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
                    className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container-low dark:border-slate-600"
                  >
                    Usar fatura atual ({formatBRL(card.currentInvoice)})
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-surface-container bg-white p-6 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
                <h3 className="mb-6 font-headline text-xl font-semibold text-primary">Gastos por categoria</h3>
                <div className="space-y-4">
                  {categoryRows.map((row) => (
                    <div key={row.name} className="flex items-center gap-3">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
                      <div className="flex-1 text-sm text-on-surface dark:text-slate-200">{row.name}</div>
                      <div className="font-semibold text-primary dark:text-slate-100">{row.pct}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-surface-container bg-white p-6 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900 md:col-span-2">
                <h3 className="mb-4 font-headline text-xl font-semibold text-primary">Gastos por categoria</h3>
                <div className="space-y-4">
                  {categoryRows.map((row) => (
                    <div key={row.name} className="flex items-center gap-3">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
                      <div className="flex-1 text-sm">{row.name}</div>
                      <div className="font-semibold">{row.pct}%</div>
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
        <section className="rounded-2xl border border-surface-container bg-white p-6 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-headline text-xl font-semibold text-primary">Faturas arquivadas</h3>
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
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nenhuma fatura arquivada ainda. Registre fechamentos para alimentar o gráfico acima.
            </p>
          ) : (
          <div className="custom-scrollbar flex gap-4 overflow-x-auto pb-2">
            {statements.map((s) => (
              <div
                key={s.id}
                className="w-[min(100%,280px)] shrink-0 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800/80"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-label text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {monthLabel(s.referenceMonth)}
                    </p>
                    <p className="mt-1 font-headline text-lg font-bold text-primary dark:text-slate-100">{formatBRL(s.amount)}</p>
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
                {s.note ? <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">{s.note}</p> : null}
                <div className="flex flex-wrap gap-2 border-t border-outline-variant/10 pt-3 dark:border-slate-600">
                  {s.attachmentDataUrl ? (
                    <a
                      href={s.attachmentDataUrl}
                      download={s.attachmentName ?? "fatura"}
                      className="flex items-center text-[11px] font-semibold text-primary hover:underline"
                    >
                      <span className="material-symbols-outlined mr-1 text-base">attach_file</span>
                      Anexo
                    </a>
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
            ))}
          </div>
          )}
        </section>
      ) : null}

      {/* Lançamentos recentes */}
      <section className="overflow-hidden rounded-2xl border border-surface-container bg-white shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-surface-container p-6 dark:border-slate-700">
          <h3 className="font-headline text-xl font-semibold text-primary">Lançamentos recentes</h3>
          <Link
            to={`/lancamentos?cartao=${card.id}`}
            className="font-label text-[15px] font-semibold text-primary-container hover:underline dark:text-blue-300"
          >
            Ver todos
          </Link>
        </div>
        {cardTxns.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600 dark:text-slate-400">
            Nenhum lançamento ainda. Use &quot;Novo lançamento&quot; ou cadastre em Lançamentos.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low font-label text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800/80 dark:text-slate-400">
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container dark:divide-slate-700">
                {recentTxns.map((t) => (
                  <tr
                    key={t.id}
                    className="group transition-colors hover:bg-surface-container-low dark:hover:bg-slate-800/50"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {formatDateShort(t.date)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-primary dark:bg-slate-700 dark:text-blue-200">
                          <span className="material-symbols-outlined text-[18px]">{categoryMaterialIcon(t.category)}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-primary dark:text-slate-100">{t.description}</span>
                          {t.thirdPartyName ? (
                            <button
                              type="button"
                              onClick={() => setThirdPartyTxn(t)}
                              className="mt-0.5 block truncate text-left text-[11px] font-semibold text-slate-500 hover:underline dark:text-slate-400"
                            >
                              {t.thirdPartyName}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setThirdPartyTxn(t)}
                              className="mt-0.5 block text-[11px] font-semibold text-slate-500 hover:text-primary dark:text-slate-400"
                            >
                              Atribuir pessoa
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-surface-container px-3 py-1 font-label text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:bg-slate-800 dark:text-slate-300">
                        {(t.category || "—").slice(0, 24)}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-semibold ${
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
      <section className="relative h-[300px] overflow-hidden rounded-3xl shadow-2xl">
        <img alt="" src={HERO_CARD_IMG} className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-primary/80 to-transparent p-8 md:p-10">
          <p className="mb-2 font-headline text-2xl font-semibold text-on-primary">Segurança em primeiro lugar</p>
          <p className="max-w-md font-body text-base leading-relaxed text-white/90">
            Seus dados são protegidos por criptografia de ponta a ponta. Mantenha o backup em Configurações.
          </p>
        </div>
      </section>
    </div>
  );
}
