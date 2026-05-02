import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CreditCardLimitsModal } from "../components/CreditCardLimitsModal";
import { EditAccountModal } from "../components/EditAccountModal";
import { ManageCreditCardModal } from "../components/ManageCreditCardModal";
import { QuickIncomeModal } from "../components/QuickIncomeModal";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { iconWrapForCategory } from "../domain/categories";
import { CardBrandLogo } from "../components/CardBrandLogo";
import { GreetingTimeIcon } from "../components/GreetingTimeIcon";
import { BENEFIT_BUCKET_LABEL, BENEFIT_BUCKETS } from "../domain/cardWallet";
import type { BenefitBucket, CreditCard } from "../domain/types";
import {
  creditCardDueStatus,
  formatCardBillingDayLabel,
  formatDateTimeShort,
  roundMoney,
} from "../domain/money";

const INSIGHT_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBqvfc0f7AM-bF6Hh7T7vyOEdPevfVFW7Cq7J5_80vzNfiHIxQtWDkD0KCo_lE2aWl3zmDbdyfjzM_rbGuJ1C2lwVx3L0OJ8AXiUamDp726p5DhpIKCDmM9eUg5yWsMUOVq7FqMOlz0_NKcDWlOQl6FhNazOK2PV2YD01tb0qZZiw96C9V_bfvFeEH4mIv5vueHkb6sNbErtTs6ztSG7rR-jLFUVwN33gD_o0V9mfEvzZZ60jsZSrVh9JCpbQPY6AB_Hsch_uUv80U";

const STATUS_LEDGER: Record<string, string> = {
  confirmado: "Aprovado",
  pendente: "Pendente",
  recebido: "Liquidado",
};

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

function mobileWalletCardBg(card: CreditCard): string {
  if (card.kind === "beneficios") {
    return "bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900";
  }
  switch (card.brand) {
    case "visa":
      return "bg-gradient-to-br from-[#0a1628] via-[#152b52] to-[#3d5a8c]";
    case "master":
      return "bg-gradient-to-br from-[#1c1408] via-[#4a3518] to-[#b8860b]";
    case "elo":
      return "bg-gradient-to-br from-[#1a237e] via-[#3949ab] to-[#7986cb]";
    case "amex":
      return "bg-gradient-to-br from-[#263238] via-[#455a64] to-[#78909c]";
    default:
      return "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700";
  }
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
    greeting,
    primaryBalance,
    defaultAccountBalance,
    benefitLiquidity,
    monthlyIncome,
    monthlyExpense,
    deleteCreditCard,
  } = useFinance();
  const primaryAcc = state.accounts.find((a) => a.id === state.defaultAccountId);
  const declaredSalary = state.profile.monthlySalary;
  const [depositOpen, setDepositOpen] = useState(false);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [cardFormEditing, setCardFormEditing] = useState<CreditCard | null>(null);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const cardsScrollerRef = useRef<HTMLDivElement>(null);
  const [cardScroll, setCardScroll] = useState({ canPrev: false, canNext: false });

  const updateCardScroll = useCallback(() => {
    const el = cardsScrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCardScroll({
      canPrev: scrollLeft > 2,
      canNext: scrollLeft + clientWidth < scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    updateCardScroll();
    const el = cardsScrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateCardScroll());
    ro.observe(el);
    return () => ro.disconnect();
  }, [state.creditCards.length, updateCardScroll]);

  const scrollCardsDir = useCallback((dir: -1 | 1) => {
    const el = cardsScrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  }, []);

  const recent = useMemo(
    () =>
      [...state.transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
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

  return (
    <Fragment>
      {/* Dashboard mobile — layout compacto estilo mock */}
      <div className="mx-auto max-w-md space-y-5 px-4 pb-28 pt-24 md:hidden">
        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Saldo total
              </h2>
              <p className="mt-1 font-headline text-3xl font-bold tracking-tight text-primary dark:text-slate-100">
                {formatBRL(primaryBalance)}
              </p>
            </div>
            {flowPctVsIncome !== null && Number.isFinite(flowPctVsIncome) && (
              <span
                className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  netMonthlyFlow >= 0
                    ? "bg-secondary-container text-on-secondary-container dark:bg-emerald-950/50 dark:text-emerald-200"
                    : "bg-error-container text-on-error-container dark:bg-red-950/40 dark:text-red-200"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {netMonthlyFlow >= 0 ? "trending_up" : "trending_down"}
                </span>
                {netMonthlyFlow >= 0 ? "+" : ""}
                {flowPctVsIncome}%
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate("/lancamentos?novo=1")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-[15px] font-semibold text-white transition-transform active:scale-[0.98] dark:bg-primary"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Novo lançamento
          </button>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-headline text-lg font-semibold text-primary dark:text-slate-100">Meus cartões</h3>
            <button
              type="button"
              onClick={() => setLimitsOpen(true)}
              disabled={state.creditCards.length === 0}
              className="text-sm font-semibold text-on-primary-container hover:underline disabled:opacity-40 dark:text-blue-300"
            >
              Ver todos
            </button>
          </div>
          {state.creditCards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest p-6 text-center dark:bg-slate-900">
              <p className="mb-3 text-sm text-on-surface-variant">Nenhum cartão cadastrado.</p>
              <button
                type="button"
                onClick={() => {
                  setCardFormEditing(null);
                  setCardFormOpen(true);
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white"
              >
                Incluir cartão
              </button>
            </div>
          ) : (
            <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto pb-1">
              {carouselCreditCards.map((c) => (
                <Link
                  key={c.id}
                  to={`/cartao/${c.id}`}
                  className={`relative flex min-h-[180px] min-w-[280px] shrink-0 snap-center flex-col justify-between rounded-xl p-5 text-white shadow-lg ${mobileWalletCardBg(c)}`}
                >
                  <div className="relative z-10 flex items-start justify-between">
                    <span className="material-symbols-outlined text-3xl opacity-90">contactless</span>
                    <span className="max-w-[60%] text-right font-headline text-lg font-semibold italic leading-tight">
                      {c.name}
                    </span>
                  </div>
                  <div className="relative z-10">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-80">
                      Número do cartão
                    </p>
                    <p className="font-headline text-lg tracking-[0.18em]">•••• {c.last4}</p>
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-black/15" aria-hidden />
                </Link>
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

    <div className="mx-auto hidden max-w-7xl px-6 pb-12 md:block md:px-12">
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
      <header className="mb-12 flex flex-col items-end justify-between md:flex-row">
        <div className="w-full space-y-6 md:w-auto">
          <div>
            <p className="flex items-center gap-2 text-lg font-medium text-on-surface-variant">
              {greeting},
              <GreetingTimeIcon />
            </p>
            <h1 className="font-headline text-4xl font-black tracking-tight text-primary">
              {state.profile.displayName}!
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-8 gap-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline">
                receita mensal
              </p>
              <p className="font-headline text-2xl font-black text-secondary">
                {formatBRL(monthlyIncome)}
              </p>
              {declaredSalary > 0 && (
                <p className="text-xs text-on-surface-variant">
                  Salário no perfil:{" "}
                  <span className="font-semibold text-primary">{formatBRL(declaredSalary)}</span>
                </p>
              )}
            </div>
            <div className="h-10 w-px bg-outline-variant/30" />
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline">
                despesa mensal
              </p>
              <p className="font-headline text-2xl font-black text-error">
                {formatBRL(monthlyExpense)}
              </p>
            </div>
            <div className="ml-0 flex items-center justify-center rounded-lg border border-outline-variant/20 bg-white p-2 shadow-sm sm:ml-4">
              <span className="material-symbols-outlined text-on-surface-variant opacity-60">
                show_chart
              </span>
            </div>
          </div>
        </div>
        <div className="mt-8 flex w-full flex-col items-stretch space-y-4 md:mt-0 md:w-auto md:items-end">
          <div className="text-left md:text-right">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-outline">
              Saldo Principal
            </p>
            <p className="font-headline text-4xl font-black tracking-tighter text-primary">
              {formatBRL(primaryBalance)}
            </p>
            {benefitLiquidity > 0 && (
              <p className="mt-1 max-w-xs text-left text-xs leading-snug text-on-surface-variant md:text-right md:ml-auto">
                {primaryAcc?.name ?? "Conta principal"}: {formatBRL(defaultAccountBalance)} · Benefícios:{" "}
                {formatBRL(benefitLiquidity)}
              </p>
            )}
            <Link
              to="/settings#saldo-real"
              className="mt-2 inline-block text-sm font-semibold text-secondary underline-offset-2 hover:underline"
            >
              Definir saldo real
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setDepositOpen(true)}
              className="flex items-center space-x-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary/90"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              <span>Depositar</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/lancamentos?novo=1")}
              className="flex items-center space-x-2 rounded-lg border border-outline-variant/20 bg-surface-container-highest px-5 py-2.5 text-sm font-bold text-primary transition-all hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-sm">payments</span>
              <span>Novo lançamento</span>
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <div className="space-y-8 md:col-span-8">
          <section id="gestao-cartoes">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-headline text-2xl font-bold tracking-tight text-primary">
                Gestão de Cartões
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCardFormEditing(null);
                    setCardFormOpen(true);
                  }}
                  className="flex items-center space-x-1 rounded-lg border border-secondary/40 bg-secondary-container/30 px-3 py-2 text-sm font-bold text-secondary transition-colors hover:bg-secondary-container/50"
                >
                  <span className="material-symbols-outlined text-base">add_card</span>
                  <span>Incluir cartão</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLimitsOpen(true)}
                  disabled={state.creditCards.length === 0}
                  className="flex items-center space-x-1 text-sm font-semibold text-secondary hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  <span>Ver todos os limites</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
            {state.creditCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest/80 p-10 text-center shadow-light">
                <p className="mb-4 text-on-surface-variant">
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
              <div>
                <div
                  ref={cardsScrollerRef}
                  onScroll={updateCardScroll}
                  className="flex gap-6 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] snap-x snap-mandatory sm:snap-none [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-outline-variant/40"
                >
                  {carouselCreditCards.map((c) => {
                  const isBenef = c.kind === "beneficios";
                  const due = isBenef ? ("open" as const) : creditCardDueStatus(c.dueDay);
                  const available = roundMoney(c.creditLimit - c.currentInvoice);
                  const usedPct =
                    c.creditLimit > 0
                      ? Math.min(100, roundMoney((c.currentInvoice / c.creditLimit) * 100))
                      : 0;
                  const dueUrgent = !isBenef && (due === "overdue" || due === "soon");
                  return (
                    <div
                      key={c.id}
                      className="relative shrink-0 snap-center max-sm:w-full max-sm:min-w-[min(100%,22rem)] sm:w-[calc(50%-0.75rem)] sm:min-w-[calc(50%-0.75rem)] sm:max-w-[calc(50%-0.75rem)] rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-light"
                    >
                      <div className="mb-6 flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center space-x-3">
                          <CardBrandLogo
                            brand={c.brand}
                            className="!h-10 !w-[4.25rem] shadow-sm"
                            imgClassName="max-h-8 w-full max-w-[3.5rem] object-contain object-center"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                              {c.name}
                            </p>
                            <p className="font-mono text-[10px] text-outline">•••• {c.last4}</p>
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
                              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
                              aria-label="Detalhes do cartão"
                              title="Detalhes"
                            >
                              <span className="material-symbols-outlined text-lg">visibility</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setCardFormEditing(c);
                                setCardFormOpen(true);
                              }}
                              className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
                              aria-label="Editar cartão"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Remover o cartão "${c.name}"?`)) deleteCreditCard(c.id);
                              }}
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
                                  className="flex items-center justify-between rounded-lg bg-surface-container-high/40 px-3 py-2"
                                >
                                  <span className="text-xs font-medium text-on-surface-variant">
                                    {BENEFIT_BUCKET_LABEL[b]}
                                  </span>
                                  <span className="font-headline text-sm font-black text-primary">
                                    {formatBRL(c.benefitBalances[b])}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="text-right text-[10px] text-on-surface-variant">
                              Lançamentos com este cartão atualizam as bolsas.
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-end justify-between gap-2">
                              <div>
                                <p className="mb-1 text-xs font-medium text-on-surface-variant">Fatura Atual</p>
                                <p className="font-headline text-2xl font-black text-primary">
                                  {formatBRL(c.currentInvoice)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-medium text-on-surface-variant">Fechamento</p>
                                <p className="text-xs font-semibold text-on-surface-variant">
                                  {formatCardBillingDayLabel(c.closingDay)}
                                </p>
                                <p className="mt-1.5 text-[10px] font-medium text-on-surface-variant">
                                  Vencimento
                                </p>
                                <p
                                  className={`text-sm font-bold ${dueUrgent ? "text-error" : "text-on-surface-variant"}`}
                                >
                                  {formatCardBillingDayLabel(c.dueDay)}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-on-surface-variant">Limite utilizado</span>
                                <span className="text-primary">
                                  Limite disponível: {formatBRL(available)}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                                <div
                                  className={`h-full rounded-full ${BAR_COLOR[c.brand]}`}
                                  style={{ width: `${usedPct}%` }}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
                {state.creditCards.length > 2 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-on-surface-variant">
                      Deslize ou use as setas para ver os demais cartões
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-label="Cartões anteriores"
                        disabled={!cardScroll.canPrev}
                        onClick={() => scrollCardsDir(-1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-primary shadow-sm transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-35"
                      >
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                      <button
                        type="button"
                        aria-label="Próximos cartões"
                        disabled={!cardScroll.canNext}
                        onClick={() => scrollCardsDir(1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-primary shadow-sm transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-35"
                      >
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <div className="rounded-xl border border-white/40 bg-surface-container-low p-8">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="font-headline text-xl font-bold tracking-tight text-primary">
                  Extrato do Ledger
                </h2>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => navigate("/lancamentos")}
                    className="rounded p-2 transition-colors hover:bg-surface-container-high"
                    aria-label="Ver lançamentos"
                  >
                    <span className="material-symbols-outlined text-on-surface-variant">
                      filter_list
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rounded p-2 transition-colors hover:bg-surface-container-high"
                    aria-label="Download"
                  >
                    <span className="material-symbols-outlined text-on-surface-variant">
                      download
                    </span>
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {recent.map((t) => {
                  const wrap = iconWrapForCategory(t.category, t.amount);
                  return (
                    <div
                      key={t.id}
                      className="group flex items-center justify-between rounded-lg bg-surface-container-lowest p-4 transition-all duration-300 hover:translate-x-1"
                    >
                      <div className="flex items-center space-x-4">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-[9999px] ${wrap}`}
                        >
                          <span className="material-symbols-outlined">{t.icon}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-primary">{t.description}</p>
                          <p className="text-[10px] text-on-surface-variant">
                            {t.category} • {formatDateTimeShort(t.date + "T12:00:00")}
                            {t.amount < 0 &&
                              !t.creditCardId &&
                              t.paymentMethod === "pix" &&
                              " · PIX"}
                            {t.amount < 0 &&
                              !t.creditCardId &&
                              t.paymentMethod === "boleto" &&
                              " · Boleto"}
                          </p>
                          {t.paymentAttachmentDataUrl && (
                            <a
                              href={t.paymentAttachmentDataUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-secondary hover:underline"
                            >
                              <span className="material-symbols-outlined text-xs">attach_file</span>
                              Abrir comprovante
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-black ${t.amount >= 0 ? "text-secondary" : "text-error"}`}
                        >
                          {formatBRL(t.amount, { showSign: true })}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">
                          {STATUS_LEDGER[t.status] ?? t.status}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => navigate("/lancamentos")}
                className="mt-8 w-full rounded-lg border border-outline-variant/30 py-3 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
              >
                Ver extrato completo
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-8 md:col-span-4">
          <section className="rounded-xl bg-surface-container-high p-6">
            <h3 className="mb-6 font-headline text-lg font-extrabold text-primary">Minhas Contas</h3>
            <div className="space-y-4">
              {state.accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/20 bg-white/40 p-3"
                >
                  <div className="flex min-w-0 flex-1 items-center space-x-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${
                        acc.icon === "account_balance"
                          ? "bg-primary-container text-on-primary-container"
                          : acc.icon === "savings"
                            ? "bg-secondary-container text-on-secondary-container"
                            : "bg-tertiary-fixed text-on-tertiary-fixed"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">{acc.icon}</span>
                    </div>
                    <span className="truncate text-xs font-bold text-primary">{acc.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs font-black text-primary">{formatBRL(acc.balance)}</span>
                    <button
                      type="button"
                      onClick={() => setEditAccountId(acc.id)}
                      className="rounded-md p-1 text-outline transition-colors hover:bg-surface-container-high hover:text-primary"
                      aria-label={`Editar ${acc.name}`}
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                  </div>
                </div>
              ))}

              {state.creditCards.filter((c) => c.kind === "beneficios").map((card) => (
                <div
                  key={card.id}
                  className="rounded-lg border border-tertiary-fixed/30 bg-white/50 p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-tertiary-fixed text-on-tertiary-fixed-variant">
                      <span className="material-symbols-outlined text-sm">restaurant</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-primary">{card.name}</p>
                      <p className="text-[10px] font-medium text-on-surface-variant">Cartão de benefícios</p>
                    </div>
                    <Link
                      to={`/cartao/${card.id}`}
                      className="shrink-0 rounded p-1 text-primary hover:bg-white/40"
                      aria-label={`Detalhes — ${card.name}`}
                      title="Detalhes"
                    >
                      <span className="material-symbols-outlined text-lg">visibility</span>
                    </Link>
                  </div>
                  <ul className="space-y-1.5 border-t border-outline-variant/15 pt-2">
                    {BENEFIT_BUCKETS.map((b) => (
                      <li
                        key={b}
                        className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant"
                      >
                        <span>{BENEFIT_BUCKET_LABEL[b]}</span>
                        <span className="font-bold text-primary">{formatBRL(card.benefitBalances[b])}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-6 w-full rounded-lg border-2 border-dashed border-outline-variant/50 py-3 text-xs font-bold text-outline transition-all hover:border-secondary hover:text-secondary"
            >
              + Conectar Nova Conta
            </button>
          </section>

          <section className="rounded-xl bg-primary p-6 text-white">
            <div className="mb-6 flex items-center space-x-2">
              <span className="material-symbols-outlined text-secondary-fixed">security</span>
              <h3 className="font-headline text-lg font-bold">Segurança do Cartão</h3>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold">Bloqueio Temporário</p>
                  <p className="text-[10px] opacity-60">Inativa o cartão instantaneamente</p>
                </div>
                <div className="relative h-5 w-10 cursor-pointer rounded-full bg-on-primary-fixed">
                  <div className="absolute left-1 top-1 h-3 w-3 rounded-[9999px] bg-white" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold">Compras Online</p>
                  <p className="text-[10px] opacity-60">Uso exclusivo em e-commerce</p>
                </div>
                <div className="relative h-5 w-10 cursor-pointer rounded-full bg-secondary">
                  <div className="absolute right-1 top-1 h-3 w-3 rounded-[9999px] bg-white" />
                </div>
              </div>
            </div>
            <hr className="my-6 border-white/10" />
            <button
              type="button"
              className="w-full text-center text-xs font-bold text-secondary-fixed transition-colors hover:text-white"
            >
              Gerar Cartão Virtual Dinâmico
            </button>
          </section>

          <div className="overflow-hidden rounded-xl shadow-light">
            <img alt="" src={INSIGHT_IMG} className="h-32 w-full object-cover" />
            <div className="bg-surface-container-lowest p-6">
              <h4 className="mb-2 text-sm font-black tracking-tight text-primary">
                Análise de IA: Seu limite pode aumentar.
              </h4>
              <p className="text-xs leading-relaxed text-on-surface-variant">
                Detectamos um fluxo de caixa estável nos últimos 90 dias. Você tem 85% de chance de
                aprovação para um upgrade.
              </p>
              <button
                type="button"
                className="mt-4 flex items-center space-x-1 text-xs font-extrabold text-secondary"
              >
                <span>Saber mais</span>
                <span className="material-symbols-outlined text-xs">open_in_new</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
    </Fragment>
  );
}
