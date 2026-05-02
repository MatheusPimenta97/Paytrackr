import { Fragment, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { CreditCardLimitsModal } from "../components/CreditCardLimitsModal";
import { EditAccountModal } from "../components/EditAccountModal";
import { ManageCreditCardModal } from "../components/ManageCreditCardModal";
import { QuickIncomeModal } from "../components/QuickIncomeModal";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { CardBrandLogo } from "../components/CardBrandLogo";
import { iconWrapForCategory } from "../domain/categories";
import { BENEFIT_BUCKET_LABEL } from "../domain/cardWallet";
import type { BenefitBucket, CreditCard, Transaction } from "../domain/types";
import {
  creditCardDueStatus,
  formatCardBillingDayLabel,
  formatDateShort,
  formatDateTimeShort,
  roundMoney,
} from "../domain/money";

const BAR_COLOR: Record<CreditCard["brand"], string> = {
  visa: "bg-secondary",
  master: "bg-primary",
  elo: "bg-amber-600",
  amex: "bg-[#006fcf]",
  outro: "bg-on-surface-variant",
};

function cardStatusLabel(s: ReturnType<typeof creditCardDueStatus>) {
  if (s === "overdue") return "Fatura atrasada";
  if (s === "soon") return "Próximo vencimento";
  return "Fatura em aberto";
}

function ymFromOffset(monthsAgo: number): string {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth() - monthsAgo, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

function monthNet(transactions: Transaction[], ym: string): number {
  let inc = 0;
  let exp = 0;
  for (const tx of transactions) {
    if (!tx.date.startsWith(ym)) continue;
    if (tx.amount > 0) inc += tx.amount;
    else exp += Math.abs(tx.amount);
  }
  return roundMoney(inc - exp);
}

function txnStatusBadge(t: Transaction): { label: string; className: string } {
  if (t.status === "pendente") {
    return {
      label: "Pendente",
      className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    };
  }
  if (t.amount > 0 && t.status === "recebido") {
    return {
      label: "Liquidado",
      className: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    };
  }
  return {
    label: "Concluído",
    className: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  };
}

function DashboardCreditCardTile({
  card: c,
  onEdit,
  onTryDelete,
}: {
  card: CreditCard;
  onEdit: () => void;
  onTryDelete: () => void;
}) {
  const isBenef = c.kind === "beneficios";
  const due = isBenef ? ("open" as const) : creditCardDueStatus(c.dueDay);
  const available = roundMoney(c.creditLimit - c.currentInvoice);
  const usedPct =
    c.creditLimit > 0
      ? Math.min(100, roundMoney((c.currentInvoice / c.creditLimit) * 100))
      : 0;
  const dueUrgent = !isBenef && (due === "overdue" || due === "soon");

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-light dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-6 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center space-x-3">
          <CardBrandLogo
            brand={c.brand}
            className="!h-10 !w-[4.25rem] shadow-sm"
            imgClassName="max-h-8 w-full max-w-[3.5rem] object-contain object-center"
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-400">
              {c.name}
            </p>
            <p className="font-mono text-[10px] text-outline dark:text-slate-500">•••• {c.last4}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`rounded px-2 py-1 text-[10px] font-black uppercase ${
              isBenef
                ? "bg-tertiary-fixed text-on-tertiary-fixed-variant"
                : due === "overdue" || due === "soon"
                  ? "bg-error-container text-on-error-container"
                  : "bg-secondary-container text-on-secondary-container"
            }`}
          >
            {isBenef ? "Pré-pago" : cardStatusLabel(due)}
          </span>
          <div className="flex gap-1">
            <Link
              to={`/cartao/${c.id}`}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Detalhes do cartão"
              title="Detalhes"
            >
              <span className="material-symbols-outlined text-lg">visibility</span>
            </Link>
            <button
              type="button"
              onClick={onEdit}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Editar cartão"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
            <button
              type="button"
              onClick={onTryDelete}
              className="rounded p-1 text-error hover:bg-error-container/30"
              aria-label="Remover cartão"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {isBenef ? (
          <>
            <div className="space-y-2">
              {(["refeicao", "alimentacao", "mobilidade"] as BenefitBucket[]).map((b) => (
                <div
                  key={b}
                  className="flex items-center justify-between rounded-lg bg-surface-container-high/40 px-3 py-2 dark:bg-slate-800/60"
                >
                  <span className="text-xs font-medium text-on-surface-variant dark:text-slate-400">
                    {BENEFIT_BUCKET_LABEL[b]}
                  </span>
                  <span className="font-headline text-sm font-black text-primary dark:text-slate-100">
                    {formatBRL(c.benefitBalances[b])}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-right text-[10px] text-on-surface-variant dark:text-slate-500">
              Lançamentos com este cartão atualizam as bolsas.
            </div>
          </>
        ) : (
          <>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="mb-1 text-xs font-medium text-on-surface-variant dark:text-slate-400">
                  Fatura Atual
                </p>
                <p className="font-headline text-2xl font-black text-primary dark:text-slate-100">
                  {formatBRL(c.currentInvoice)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium text-on-surface-variant dark:text-slate-400">
                  Fechamento
                </p>
                <p className="text-xs font-semibold text-on-surface-variant dark:text-slate-300">
                  {formatCardBillingDayLabel(c.closingDay)}
                </p>
                <p className="mt-1.5 text-[10px] font-medium text-on-surface-variant dark:text-slate-400">
                  Vencimento
                </p>
                <p
                  className={`text-sm font-bold ${dueUrgent ? "text-error" : "text-on-surface-variant dark:text-slate-300"}`}
                >
                  {formatCardBillingDayLabel(c.dueDay)}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-on-surface-variant dark:text-slate-400">Limite utilizado</span>
                <span className="text-primary dark:text-blue-200">
                  Limite disponível: {formatBRL(available)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high dark:bg-slate-800">
                <div className={`h-full rounded-full ${BAR_COLOR[c.brand]}`} style={{ width: `${usedPct}%` }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function accountSubtitleMobile(acc: { icon: string }): string {
  if (acc.icon === "savings") return "Reserva · disponível";
  if (acc.icon === "show_chart") return "Investimentos";
  return "Conta corrente";
}

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    state,
    primaryBalance,
    totalWealth,
    monthlyIncome,
    monthlyExpense,
    deleteCreditCard,
    portfolioCompletion,
    nextMilestoneGoal,
    vestedTotal,
    targetTotal,
  } = useFinance();
  const [depositOpen, setDepositOpen] = useState(false);
  const [balancePeriod, setBalancePeriod] = useState<"month" | "year">("month");
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [cardFormEditing, setCardFormEditing] = useState<CreditCard | null>(null);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);

  const recent = useMemo(
    () =>
      [...state.transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
    [state.transactions]
  );

  const recentDesktop = useMemo(
    () =>
      [...state.transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10),
    [state.transactions]
  );

  /** No carrossel: cartões de crédito à esquerda; benefícios sempre à extrema direita. */
  const carouselCreditCards = useMemo(() => {
    return [...state.creditCards].sort((a, b) => {
      const rank = (k: CreditCard["kind"]) => (k === "beneficios" ? 1 : 0);
      return rank(a.kind) - rank(b.kind);
    });
  }, [state.creditCards]);

  const netMonthlyFlow = monthlyIncome - monthlyExpense;
  const flowPctVsIncome =
    monthlyIncome > 0 ? Math.round((netMonthlyFlow / monthlyIncome) * 1000) / 10 : null;

  const prevMonthNet = useMemo(() => monthNet(state.transactions, ymFromOffset(1)), [state.transactions]);

  const balanceTrendVsPrevMonthPct = useMemo(() => {
    const cur = netMonthlyFlow;
    if (prevMonthNet === 0) {
      if (cur === 0) return null;
      return cur > 0 ? 100 : -100;
    }
    return roundMoney(((cur - prevMonthNet) / Math.abs(prevMonthNet)) * 100);
  }, [prevMonthNet, netMonthlyFlow]);

  const monthlyBars = useMemo(() => {
    const raw: number[] = [];
    for (let i = 6; i >= 0; i--) {
      raw.push(monthNet(state.transactions, ymFromOffset(i)));
    }
    const maxAbs = Math.max(...raw.map((n) => Math.abs(n)), 1);
    return raw.map((n, idx) => ({
      net: n,
      heightPct: Math.max(18, Math.round((Math.abs(n) / maxAbs) * 100)),
      highlight: idx === raw.length - 1,
    }));
  }, [state.transactions]);

  const yearlyBars = useMemo(() => {
    const y = new Date().getFullYear();
    const raw: number[] = [];
    for (let m = 0; m < 12; m++) {
      raw.push(monthNet(state.transactions, `${y}-${String(m + 1).padStart(2, "0")}`));
    }
    const maxAbs = Math.max(...raw.map((n) => Math.abs(n)), 1);
    const curMonth = new Date().getMonth();
    return raw.map((n, idx) => ({
      net: n,
      heightPct: Math.max(12, Math.round((Math.abs(n) / maxAbs) * 100)),
      highlight: idx === curMonth,
    }));
  }, [state.transactions]);

  const creditAgg = useMemo(() => {
    const cards = state.creditCards.filter((c) => c.kind === "credito");
    const totalLimit = roundMoney(cards.reduce((s, c) => s + c.creditLimit, 0));
    const totalInvoice = roundMoney(cards.reduce((s, c) => s + c.currentInvoice, 0));
    const pct = totalLimit > 0 ? Math.min(100, Math.round((totalInvoice / totalLimit) * 100)) : 0;
    return { cards, totalLimit, totalInvoice, pct };
  }, [state.creditCards]);

  const financeScore = useMemo(() => {
    let s = 520 + Math.round(portfolioCompletion * 2.8);
    if (monthlyIncome > monthlyExpense) s += 35;
    else s -= 15;
    return Math.min(850, Math.max(300, s));
  }, [portfolioCompletion, monthlyIncome, monthlyExpense]);

  const currentCalendarYear = new Date().getFullYear();
  const yearNetCur = useMemo(() => {
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      sum += monthNet(state.transactions, `${currentCalendarYear}-${String(m).padStart(2, "0")}`);
    }
    return roundMoney(sum);
  }, [state.transactions, currentCalendarYear]);

  const yearNetPrev = useMemo(() => {
    const y = currentCalendarYear - 1;
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      sum += monthNet(state.transactions, `${y}-${String(m).padStart(2, "0")}`);
    }
    return roundMoney(sum);
  }, [state.transactions, currentCalendarYear]);

  const yearTrendPct = useMemo(() => {
    if (yearNetPrev === 0) {
      if (yearNetCur === 0) return null;
      return yearNetCur > 0 ? 100 : -100;
    }
    return roundMoney(((yearNetCur - yearNetPrev) / Math.abs(yearNetPrev)) * 100);
  }, [yearNetCur, yearNetPrev]);

  const chartBars = balancePeriod === "month" ? monthlyBars : yearlyBars;
  const balanceHeadline =
    balancePeriod === "month" ? "Saldo total consolidado" : "Patrimônio total";
  const balanceAmount = balancePeriod === "month" ? primaryBalance : totalWealth;

  const goalTargetAmt = nextMilestoneGoal?.target ?? targetTotal;
  const goalCurrentAmt = nextMilestoneGoal?.current ?? vestedTotal;
  const goalPct =
    goalTargetAmt > 0
      ? Math.min(100, Math.round((goalCurrentAmt / goalTargetAmt) * 100))
      : Math.min(100, Math.round(portfolioCompletion));

  const desktopInsightLine = useMemo(() => {
    const mes = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date());
    const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
    if (portfolioCompletion >= 85) {
      return `O desempenho de ${mesCap}: suas metas estão ${portfolioCompletion}% avançadas — ótimo ritmo de poupança.`;
    }
    if (netMonthlyFlow > 0) {
      return `Em ${mesCap}, seu fluxo líquido ficou positivo (${formatBRL(netMonthlyFlow)}). Mantenha o controle das categorias.`;
    }
    if (netMonthlyFlow < 0) {
      return `Em ${mesCap}, o fluxo líquido foi ${formatBRL(netMonthlyFlow)}. Vale revisar gastos fixos e cartões.`;
    }
    return `Cadastre lançamentos em ${mesCap} para ver tendências e comparativos automáticos.`;
  }, [portfolioCompletion, netMonthlyFlow]);

  return (
    <Fragment>
      <QuickIncomeModal
        open={depositOpen}
        title="Depositar"
        onClose={() => setDepositOpen(false)}
      />
      <ManageCreditCardModal
        open={cardFormOpen}
        editing={cardFormEditing}
        onClose={() => setCardFormOpen(false)}
      />
      <CreditCardLimitsModal
        open={limitsOpen}
        onClose={() => setLimitsOpen(false)}
        cards={state.creditCards}
      />
      <EditAccountModal
        open={editAccountId !== null}
        accountId={editAccountId}
        onClose={() => setEditAccountId(null)}
      />
      {/* Dashboard mobile — layout compacto estilo mock */}
      <div className="mx-auto max-w-md space-y-5 px-4 pb-28 pt-24 md:hidden">
        <section className="rounded-3xl bg-[#00224D] p-6 shadow-[0px_8px_24px_rgba(0,17,61,0.25)] dark:bg-[#001935]">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-400">Saldo disponível</p>
              <p className="mt-1 font-headline text-2xl font-bold tabular-nums tracking-tight text-white">
                {formatBRL(primaryBalance)}
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              {balanceTrendVsPrevMonthPct !== null && Number.isFinite(balanceTrendVsPrevMonthPct) ? (
                <span className="flex items-center gap-0.5 rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  <span className="material-symbols-outlined text-[18px]">
                    {balanceTrendVsPrevMonthPct >= 0 ? "trending_up" : "trending_down"}
                  </span>
                  {balanceTrendVsPrevMonthPct >= 0 ? "+" : ""}
                  {Math.round(balanceTrendVsPrevMonthPct * 10) / 10}%
                </span>
              ) : flowPctVsIncome !== null && Number.isFinite(flowPctVsIncome) ? (
                <span className="flex items-center gap-0.5 rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  <span className="material-symbols-outlined text-[18px]">
                    {netMonthlyFlow >= 0 ? "trending_up" : "trending_down"}
                  </span>
                  {netMonthlyFlow >= 0 ? "+" : ""}
                  {flowPctVsIncome}%
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/lancamentos?novo=1")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-100 py-4 text-[15px] font-semibold text-[#00224D] shadow-sm transition-transform active:scale-[0.98] dark:bg-sky-200 dark:text-[#00152e]"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Novo lançamento
          </button>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 px-1">
            <h3 className="font-headline text-lg font-semibold tracking-tight text-primary dark:text-slate-100">
              Gestão de Cartões
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCardFormEditing(null);
                  setCardFormOpen(true);
                }}
                className="flex items-center space-x-1 rounded-lg border border-secondary/40 bg-secondary-container/30 px-3 py-2 text-sm font-bold text-secondary transition-colors hover:bg-secondary-container/50 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
              >
                <span className="material-symbols-outlined text-base">add_card</span>
                <span>Incluir cartão</span>
              </button>
              <button
                type="button"
                onClick={() => setLimitsOpen(true)}
                disabled={state.creditCards.length === 0}
                className="flex items-center space-x-1 text-sm font-semibold text-secondary hover:underline disabled:pointer-events-none disabled:opacity-40 dark:text-emerald-300"
              >
                <span>Ver todos os limites</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
          {state.creditCards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest/80 p-8 text-center shadow-light dark:bg-slate-900">
              <p className="mb-4 text-sm text-on-surface-variant dark:text-slate-400">
                Nenhum cartão cadastrado. Inclua os seus para acompanhar fatura, vencimento e limite.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCardFormEditing(null);
                  setCardFormOpen(true);
                }}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white"
              >
                Incluir primeiro cartão
              </button>
            </div>
          ) : (
            <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {carouselCreditCards.map((c) => (
                <div
                  key={c.id}
                  className="relative w-[min(100%,22rem)] shrink-0 snap-center min-w-[min(100%,22rem)]"
                >
                  <DashboardCreditCardTile
                    card={c}
                    onEdit={() => {
                      setCardFormEditing(c);
                      setCardFormOpen(true);
                    }}
                    onTryDelete={() => {
                      if (confirm(`Remover o cartão "${c.name}"?`)) deleteCreditCard(c.id);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <h3 className="font-headline text-lg font-semibold text-primary dark:text-slate-100">Contas</h3>
            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="material-symbols-outlined text-slate-400 transition-colors hover:text-primary dark:text-slate-500"
              aria-label="Contas e configurações"
            >
              add_circle
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => setEditAccountId(acc.id)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      acc.icon === "account_balance"
                        ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
                        : acc.icon === "savings"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                    }`}
                  >
                    <span className="material-symbols-outlined">{acc.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-primary dark:text-slate-100">{acc.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{accountSubtitleMobile(acc)}</p>
                  </div>
                </div>
                <p className="shrink-0 pl-2 font-semibold text-primary dark:text-slate-100">{formatBRL(acc.balance)}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <h3 className="font-headline text-lg font-semibold text-primary dark:text-slate-100">
              Transações recentes
            </h3>
            <button
              type="button"
              onClick={() => navigate("/lancamentos")}
              className="text-sm font-semibold text-on-primary-container hover:underline dark:text-blue-300"
            >
              Ver todas
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-on-surface-variant">Sem lançamentos recentes.</p>
            ) : (
              recent.map((t) => {
                const wrap = iconWrapForCategory(t.category, t.amount);
                const positive = t.amount >= 0;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${wrap}`}
                      >
                        <span className="material-symbols-outlined text-lg">{t.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-primary dark:text-slate-100">{t.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTimeShort(t.date + "T12:00:00")}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`shrink-0 pl-2 text-sm font-bold ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-error dark:text-red-400"}`}
                    >
                      {formatBRL(t.amount, { showSign: true })}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="relative hidden pb-8 md:block md:-mt-6">
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white font-manrope tracking-tight shadow-[0px_4px_12px_rgba(0,40,85,0.05)] antialiased dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-5">
            <div className="flex min-w-0 items-center gap-4 lg:gap-6">
              <h1 className="truncate text-lg font-bold tracking-tight text-blue-900 dark:text-blue-100">Dashboard</h1>
              <nav className="hidden items-center gap-4 lg:flex">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    [
                      "pb-1 text-sm font-bold transition-colors",
                      isActive
                        ? "border-b-2 border-blue-900 text-blue-900 dark:border-blue-400 dark:text-blue-100"
                        : "text-sm font-medium text-slate-500 hover:text-blue-800 dark:text-slate-400 dark:hover:text-blue-300",
                    ].join(" ")
                  }
                >
                  Resumo
                </NavLink>
                <NavLink
                  to="/lancamentos"
                  className={({ isActive }) =>
                    [
                      "pb-1 text-sm transition-colors",
                      isActive
                        ? "border-b-2 border-blue-900 pb-1 font-bold text-blue-900 dark:border-blue-400 dark:text-blue-100"
                        : "text-sm font-medium text-slate-500 hover:text-blue-800 dark:text-slate-400 dark:hover:text-blue-300",
                    ].join(" ")
                  }
                >
                  Transações
                </NavLink>
                <NavLink
                  to="/valores-a-receber"
                  className={({ isActive }) =>
                    [
                      "pb-1 text-sm transition-colors",
                      isActive
                        ? "border-b-2 border-blue-900 pb-1 font-bold text-blue-900 dark:border-blue-400 dark:text-blue-100"
                        : "text-sm font-medium text-slate-500 hover:text-blue-800 dark:text-slate-400 dark:hover:text-blue-300",
                    ].join(" ")
                  }
                >
                  Recebíveis
                </NavLink>
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="relative hidden md:block">
                <input
                  className="focus:ring-primary-fixed w-44 rounded-full border-none bg-surface-container-low py-1.5 pl-8 pr-3 text-xs transition-all focus:ring-2 dark:bg-slate-800 dark:text-slate-100 xl:w-52"
                  placeholder="Buscar..."
                  type="search"
                  aria-label="Buscar"
                />
                <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[18px] text-outline dark:text-slate-400">
                  search
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900"
                  aria-label="Notificações"
                >
                  <span className="material-symbols-outlined text-[20px]">notifications</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/lancamentos?novo=1")}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-primary px-3 py-2 text-xs font-semibold leading-none text-white shadow-[0_4px_14px_0_rgba(0,20,48,0.2)] transition-all duration-200 active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-lg">add_circle</span>
                  <span className="hidden sm:inline">Novo lançamento</span>
                  <span className="sm:hidden">Novo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDepositOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-none text-primary shadow-sm transition-all duration-200 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="material-symbols-outlined text-lg">account_balance</span>
                  Depositar
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 pt-5">
          <div className="grid grid-cols-12 gap-4">
            <section className="col-span-12 overflow-hidden rounded-xl border border-slate-100/50 bg-white shadow-[0px_4px_24px_rgba(0,40,85,0.08)] dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
              <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
                <div className="min-w-0">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-on-secondary-container opacity-75 dark:text-slate-400">
                    {balanceHeadline}
                  </p>
                  <h2 className="font-headline text-2xl font-bold tabular-nums tracking-tight text-primary dark:text-slate-100 sm:text-3xl">
                    {formatBRL(balanceAmount)}
                  </h2>
                  {(balancePeriod === "month"
                    ? balanceTrendVsPrevMonthPct !== null && Number.isFinite(balanceTrendVsPrevMonthPct)
                    : yearTrendPct !== null && Number.isFinite(yearTrendPct)) && (
                    <p className="mt-2 flex flex-wrap items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                      <span className="material-symbols-outlined text-sm font-bold">
                        {(balancePeriod === "month"
                          ? balanceTrendVsPrevMonthPct!
                          : yearTrendPct!) >= 0
                          ? "trending_up"
                          : "trending_down"}
                      </span>
                      {(balancePeriod === "month"
                        ? balanceTrendVsPrevMonthPct!
                        : yearTrendPct!) >= 0
                        ? "+"
                        : ""}
                      {Math.round(
                        (balancePeriod === "month" ? balanceTrendVsPrevMonthPct! : yearTrendPct!) * 10
                      ) / 10}
                      %{" "}
                      {balancePeriod === "month"
                        ? "em relação ao mês anterior"
                        : "fluxo líquido vs. ano anterior"}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 rounded-lg border border-slate-200/50 bg-surface-container-low p-1 dark:border-slate-600 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setBalancePeriod("month")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      balancePeriod === "month"
                        ? "bg-white font-bold text-primary shadow-sm dark:bg-slate-900 dark:text-slate-100"
                        : "text-on-secondary-container hover:text-primary dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    Mês
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalancePeriod("year")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      balancePeriod === "year"
                        ? "bg-white font-bold text-primary shadow-sm dark:bg-slate-900 dark:text-slate-100"
                        : "text-on-secondary-container hover:text-primary dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    Ano
                  </button>
                </div>
              </div>
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <div className="group relative h-[200px] overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-br from-primary-container/10 via-surface-container-low to-primary-fixed/25 dark:border-slate-700 dark:from-primary-container/30 dark:to-slate-900 sm:h-[220px]">
                  <div className="absolute inset-0 z-10 flex flex-col justify-end p-3 sm:p-4">
                    <div className="mb-2 max-w-[min(100%,20rem)] rounded-lg border border-white/60 bg-white/40 p-2.5 shadow-sm backdrop-blur-md dark:border-slate-600 dark:bg-slate-950/50">
                      <p className="text-[10px] font-bold uppercase tracking-tighter text-primary/60 dark:text-slate-400">
                        {balancePeriod === "month" ? "Resumo mensal" : "Últimos 12 meses"}
                      </p>
                      <p className="line-clamp-2 text-xs font-semibold leading-snug text-primary dark:text-slate-100 sm:text-sm">
                        {desktopInsightLine}
                      </p>
                    </div>
                  </div>
                  <div className="absolute inset-x-6 bottom-8 top-14 flex items-end justify-between gap-0.5 opacity-90 sm:inset-x-8 sm:bottom-10 sm:top-16">
                    {chartBars.map((bar, idx) => (
                      <div
                        key={idx}
                        className="flex h-full max-h-[120px] min-h-[32px] w-full flex-col justify-end sm:max-h-[130px]"
                        title={`Fluxo líquido: ${formatBRL(bar.net)}`}
                      >
                        <div
                          className={`w-full rounded-t-sm transition-colors ${
                            bar.highlight
                              ? "bg-primary shadow-[0_0_12px_rgba(0,61,107,0.25)] dark:bg-primary-fixed dark:shadow-none"
                              : "bg-primary-container/35 dark:bg-slate-700"
                          }`}
                          style={{ height: `${bar.heightPct}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent dark:from-slate-950/40" />
                </div>
              </div>
            </section>

            <div className="col-span-12 flex flex-col gap-4 lg:col-span-4">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#001430] to-[#002855] p-4 text-white shadow-xl sm:p-5">
                <div className="relative z-10">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/60">
                    Uso do cartão de crédito
                  </p>
                  <div className="mb-3 flex flex-wrap items-end gap-1.5">
                    <span className="text-2xl font-bold tabular-nums tracking-tight sm:text-[1.65rem]">
                      {formatBRL(creditAgg.totalInvoice)}
                    </span>
                    <span className="pb-0.5 text-xs font-medium text-white/45">
                      / {formatBRL(creditAgg.totalLimit)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full border border-white/5 bg-white/10">
                    <div
                      className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                      style={{ width: `${creditAgg.pct}%` }}
                    />
                  </div>
                  {creditAgg.cards.length === 0 && (
                    <p className="mt-2 text-[11px] leading-snug text-white/70">
                      Cadastre um cartão de crédito para acompanhar o uso do limite.
                    </p>
                  )}
                </div>
                <span className="material-symbols-outlined pointer-events-none absolute -bottom-4 -right-4 text-[88px] text-white/5 sm:text-[100px]">
                  credit_card
                </span>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-blue-100/30 bg-white p-4 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                <div>
                  <div className="mb-2 flex justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-on-secondary-fixed-variant dark:text-slate-400">
                      {nextMilestoneGoal?.title ?? "Meta do portfólio"}
                    </p>
                    <span className="material-symbols-outlined shrink-0 text-lg text-primary/40 dark:text-slate-500">
                      savings
                    </span>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-primary dark:text-slate-100 sm:text-2xl">
                    {formatBRL(nextMilestoneGoal?.target ?? targetTotal)}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-on-secondary-container dark:text-slate-400">
                      {goalPct}% da meta atingida
                    </span>
                    <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div className="h-full rounded-full bg-primary dark:bg-blue-400" style={{ width: `${goalPct}%` }} />
                    </div>
                  </div>
                  <Link
                    className="text-xs font-bold text-primary underline underline-offset-4 dark:text-blue-300"
                    to="/metas"
                  >
                    Ver detalhes
                  </Link>
                </div>
              </div>
            </div>

            <section className="col-span-12 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <h3 className="font-headline text-base font-semibold text-primary dark:text-slate-100">
                  Transações recentes
                </h3>
                <button
                  type="button"
                  onClick={() => navigate("/lancamentos")}
                  className="text-xs font-semibold text-primary hover:underline dark:text-blue-300"
                >
                  Ver todas
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-50 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-outline dark:border-slate-800 dark:text-slate-400">
                      <th className="px-4 py-2">Entidade / Categoria</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Data</th>
                      <th className="px-4 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {recentDesktop.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-xs text-on-surface-variant dark:text-slate-400">
                          Sem lançamentos recentes.
                        </td>
                      </tr>
                    ) : (
                      recentDesktop.slice(0, 8).map((t) => {
                        const wrap = iconWrapForCategory(t.category, t.amount);
                        const st = txnStatusBadge(t);
                        return (
                          <tr key={t.id} className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-primary group-hover:text-white dark:bg-slate-800 dark:group-hover:bg-blue-600 ${wrap}`}
                                >
                                  <span className="material-symbols-outlined text-base">{t.icon}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[13px] font-semibold text-primary dark:text-slate-100">
                                    {t.description}
                                  </p>
                                  <p className="text-[11px] text-outline dark:text-slate-400">{t.category}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${st.className}`}
                              >
                                {st.label}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-[12px] text-outline dark:text-slate-400">
                              {formatDateShort(t.date)}
                            </td>
                            <td
                              className={`whitespace-nowrap px-4 py-2.5 text-right text-[13px] font-bold ${
                                t.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-error dark:text-red-400"
                              }`}
                            >
                              {formatBRL(t.amount, { showSign: true })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="col-span-12 flex flex-col rounded-lg border border-slate-100 bg-white shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <h3 className="font-headline text-base font-semibold text-primary dark:text-slate-100">
                  Saúde financeira
                </h3>
              </div>
              <div className="flex flex-1 flex-col justify-between p-4">
                <div className="mb-4 flex flex-wrap items-center gap-4">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[5px] border-primary border-t-primary-fixed dark:border-blue-700 dark:border-t-blue-300">
                    <span className="text-base font-bold tabular-nums text-primary dark:text-slate-100">
                      {financeScore}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-primary dark:text-slate-100">
                      {portfolioCompletion >= 70 ? "Metas em bom ritmo" : "Há espaço para ajustes"}
                    </p>
                    <p className="text-xs leading-snug text-outline dark:text-slate-400">
                      Metas do portfólio em {portfolioCompletion}%
                      {monthlyIncome > monthlyExpense ? " · fluxo mensal positivo." : " · revise despesas fixas."}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Link
                    to="/gastos-recorrentes"
                    className="flex items-start gap-3 rounded-lg border border-blue-50 bg-surface-container-low p-3 transition-colors hover:bg-surface-container-high dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                  >
                    <span className="material-symbols-outlined mt-0.5 text-lg text-primary dark:text-blue-300">
                      auto_awesome
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-primary dark:text-slate-100">Gastos recorrentes</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-on-secondary-container dark:text-slate-400">
                        Revise assinaturas e compromissos fixos para liberar margem no mês.
                      </p>
                    </div>
                  </Link>
                  <div className="relative h-[88px] overflow-hidden rounded-lg bg-gradient-to-br from-primary-container via-primary to-slate-900 sm:h-[96px]">
                    <div className="absolute inset-0 flex items-center bg-gradient-to-r from-primary/85 to-transparent p-4">
                      <div className="max-w-[75%]">
                        <p className="text-xs font-semibold text-white">Planeje o próximo ciclo</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-white/85">
                          Centralize metas e lançamentos para ver projeções mais claras.
                        </p>
                        <Link
                          to="/metas"
                          className="mt-2 inline-block rounded-md bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-primary"
                        >
                          Ver metas
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="col-span-12 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-800 dark:bg-slate-900 sm:p-4">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-300">
                    <span className="material-symbols-outlined text-[18px]">currency_bitcoin</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-outline dark:text-slate-400">Bitcoin (BTC)</p>
                    <p className="text-sm font-bold text-primary dark:text-slate-100">—</p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-outline dark:text-slate-500">Ilustrativo</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-800 dark:bg-slate-900 sm:p-4">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <span className="material-symbols-outlined text-[18px]">query_stats</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-outline dark:text-slate-400">Índice amplo (ref.)</p>
                    <p className="text-sm font-bold text-primary dark:text-slate-100">—</p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-outline dark:text-slate-500">Ilustrativo</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-800 dark:bg-slate-900 sm:p-4">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                    <span className="material-symbols-outlined text-[18px]">paid</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-outline dark:text-slate-400">USD/BRL (ref.)</p>
                    <p className="text-sm font-bold text-primary dark:text-slate-100">—</p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-outline dark:text-slate-500">Ilustrativo</span>
              </div>
            </section>
          </div>
        </div>

        <footer className="mx-auto mt-6 flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 text-[11px] text-outline dark:text-slate-400">
          <p>© {new Date().getFullYear()} PayTrackr. Uso local dos seus dados.</p>
          <div className="flex flex-wrap gap-4">
            <Link className="transition-colors hover:text-primary dark:hover:text-blue-300" to="/settings">
              Privacidade e dados
            </Link>
            <Link className="transition-colors hover:text-primary dark:hover:text-blue-300" to="/settings">
              Configurações
            </Link>
          </div>
        </footer>
      </div>

    </Fragment>
  );
}
