import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CreditCardLimitsModal } from "../components/CreditCardLimitsModal";
import { EditAccountModal } from "../components/EditAccountModal";
import { ManageCreditCardModal } from "../components/ManageCreditCardModal";
import { QuickIncomeModal } from "../components/QuickIncomeModal";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { CardBrandLogo } from "../components/CardBrandLogo";
import { useAuth } from "../context/AuthContext";
import { categoryPillClass, iconWrapForCategory } from "../domain/categories";
import { BENEFIT_BUCKET_LABEL, BENEFIT_BUCKETS } from "../domain/cardWallet";
import type { BenefitBucket, CreditCard, Transaction } from "../domain/types";
import {
  creditCardDueStatus,
  formatCardBillingDayLabel,
  formatDateTimeShort,
  roundMoney,
} from "../domain/money";

const DESKTOP_PROMO_IMG =
  "https://lh3.googleusercontent.com/aida/ADBb0ugDtfl0mnVik0vcJ38GlQ8aS150PZqiaGT19dj42zqxq0fqsJmGauewvhJFNbQFyMrJ8FoWfE32K8yup3Izfkvuo9BkUdwPvpEP14gdEdjd7SqD7Me4__mdRaY9Vxd0bvoWoF5w7hjRneBhk6PQZR_AkReRBokZEOq4kntT2QRWsS1gBvtj4i9WAMmuOPhuMu6EUb9YKfEmCSWGhrCq92oe0_ElFqZJxUMLZqS3vHhky8qKiHU5mmexV9KAExDPRqjUU16f7fyqzg";

const WALLET_TEX_URLS = [
  "https://lh3.googleusercontent.com/aida/ADBb0ug3Ufqy9pb2u67Ux9tDC329Jmml301zOKZ4KtODUZQ2eY1B8_qzOyOQSEkFaUa0U9vq1uokUx4EI3nGcFFZvADr4TcrKysUdyrnJ8X1QypnQEhaNvTF59iIlkO7qQVsk4fwCJXQLI_TyGLkuuB9_lDGWAIQmHLPWruy1vM4fnz916pPMtccukobJmbZ-Zd_NMn8iwOlSYnUger1hZrSGrrroTulgzXgRl9X2q7WMl61RAIDC42tpoxTdy82-EPiUOU0Ea1ZAT8lpg",
  "https://lh3.googleusercontent.com/aida/ADBb0uhmHheKpn_fYoRll-odHuvqNrb9sJMTTMbVeYQOMnRpjBy4cc0NdZNfHHcCzRk24_O8pbcU2UKgd-_cga1JsBP8lckVuklJgf3_rdrlQUi96Hs1EBRzfIUNw1FIF6wIi5XziTtpmaZfDvoDrtuTlgrP-9N9V39Qv8VlGnCZAenkmNLCv_tZARFo4ryOTqLqjnRgE5wpsAWq4rNBGU9ta34pKcb_gtlTAnxWP20ZqifFPk5vX0bHdSAOM5cSSszlWolOtjHQj9p0yUw",
];

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

function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PT";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
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

function desktopWalletGradient(card: CreditCard): string {
  if (card.kind === "beneficios") {
    return "bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-950";
  }
  switch (card.brand) {
    case "visa":
      return "bg-gradient-to-br from-slate-900 to-blue-950";
    case "master":
      return "bg-gradient-to-br from-blue-700 to-indigo-900";
    case "elo":
      return "bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-950";
    case "amex":
      return "bg-gradient-to-br from-slate-800 via-sky-950 to-slate-950";
    default:
      return "bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950";
  }
}

function benefitBucketsTotal(card: CreditCard): number {
  return roundMoney(BENEFIT_BUCKETS.reduce((s, b) => s + card.benefitBalances[b], 0));
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
  const { logout } = useAuth();
  const {
    state,
    primaryBalance,
    monthlyIncome,
    monthlyExpense,
    deleteCreditCard,
    portfolioCompletion,
    exportBackup,
  } = useFinance();
  const [depositOpen, setDepositOpen] = useState(false);
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

    <div className="relative hidden md:ml-[calc(50%-50vw)] md:flex md:h-[calc(100vh-7rem)] md:min-h-0 md:w-screen md:max-w-[100vw] md:overflow-hidden dark:bg-slate-950">
      {/* Painel esquerdo — saldo, resumo mensal e ações */}
      <aside className="relative flex min-h-0 w-[400px] shrink-0 flex-col overflow-hidden border-r border-primary-container bg-primary text-white">
        <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary-container opacity-20 blur-3xl" />
        <div className="custom-scrollbar relative z-10 flex min-h-0 flex-1 flex-col gap-12 overflow-y-auto p-8">
          <section>
            <div className="mb-3 flex items-center gap-2 text-primary-fixed">
              <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary-fixed">
                Saldo total disponível
              </span>
            </div>
            <div className="space-y-2">
              <h1 className="font-headline text-4xl font-black tracking-tight text-white md:text-5xl">
                {formatBRL(primaryBalance)}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {balanceTrendVsPrevMonthPct !== null && Number.isFinite(balanceTrendVsPrevMonthPct) && (
                  <span
                    className={`flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${
                      balanceTrendVsPrevMonthPct >= 0
                        ? "bg-emerald-400/10 text-emerald-400"
                        : "bg-red-400/15 text-red-200"
                    }`}
                  >
                    <span className="material-symbols-outlined mr-1 text-[16px]">
                      {balanceTrendVsPrevMonthPct >= 0 ? "trending_up" : "trending_down"}
                    </span>
                    {balanceTrendVsPrevMonthPct >= 0 ? "+" : ""}
                    {Math.round(balanceTrendVsPrevMonthPct * 10) / 10}%
                  </span>
                )}
                <span className="text-sm text-on-primary-container">em relação ao mês passado</span>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="font-headline text-xl font-semibold text-white">Resumo mensal</span>
              <button
                type="button"
                className="material-symbols-outlined text-primary-fixed opacity-80 hover:opacity-100"
                aria-label="Opções do resumo"
              >
                more_horiz
              </button>
            </div>
            <div className="flex h-48 items-end justify-between gap-2 rounded-xl border border-white/5 bg-primary-container/50 p-6">
              {monthlyBars.map((bar, idx) => (
                <div
                  key={idx}
                  className={`w-full rounded-t-sm transition-colors ${
                    bar.highlight
                      ? "bg-primary-fixed shadow-[0_0_20px_rgba(215,226,255,0.35)]"
                      : "bg-on-primary-container/20"
                  }`}
                  style={{ height: `${bar.heightPct}%` }}
                  title={`Fluxo líquido: ${formatBRL(bar.net)}`}
                />
              ))}
            </div>
            <p className="text-sm italic leading-snug text-on-primary-container">{desktopInsightLine}</p>
          </section>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate("/lancamentos?novo=1")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-fixed py-4 text-[15px] font-semibold text-primary shadow-xl shadow-black/20 transition-colors hover:bg-white active:scale-[0.99]"
            >
              <span className="material-symbols-outlined">add_circle</span>
              Novo lançamento
            </button>
            <button
              type="button"
              onClick={() => setDepositOpen(true)}
              className="w-full rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-primary-fixed transition-colors hover:bg-white/5"
            >
              Depositar na conta principal
            </button>
            <Link
              to="/settings#saldo-real"
              className="block text-center text-sm font-medium text-on-primary-container underline-offset-2 hover:text-white hover:underline"
            >
              Definir saldo real
            </Link>
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 px-8 pb-8 pt-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container font-headline text-sm font-bold text-primary-fixed">
              {initialsFromDisplayName(state.profile.displayName)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-headline text-sm font-semibold leading-tight text-white">
                {state.profile.displayName}
              </p>
              <p className="truncate text-sm text-on-primary-container">
                PayTrackr · dados no seu dispositivo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="material-symbols-outlined shrink-0 text-on-primary-container transition-colors hover:text-white"
            aria-label="Sair"
          >
            logout
          </button>
        </div>
      </aside>

      {/* Painel direito — scroll */}
      <section className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-container-low dark:bg-slate-900/50">
        <div className="mx-auto max-w-[1000px] space-y-12 px-8 py-10 pb-16">
          <section>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-headline text-2xl font-semibold tracking-tight text-primary dark:text-slate-100">
                Meus cartões
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCardFormEditing(null);
                    setCardFormOpen(true);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-secondary/40 bg-secondary-container/30 px-3 py-2 text-sm font-bold text-secondary transition-colors hover:bg-secondary-container/50 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-200"
                >
                  <span className="material-symbols-outlined text-base">add_card</span>
                  Incluir cartão
                </button>
                <button
                  type="button"
                  onClick={() => setLimitsOpen(true)}
                  disabled={state.creditCards.length === 0}
                  className="flex items-center gap-1 font-headline text-[15px] font-semibold text-blue-950 hover:underline disabled:pointer-events-none disabled:opacity-40 dark:text-blue-200"
                >
                  Ver todos
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
            {state.creditCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-outline-variant/40 bg-white p-12 text-center shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:border-slate-600 dark:bg-slate-800/80">
                <p className="mb-4 text-on-surface-variant dark:text-slate-400">
                  Nenhum cartão cadastrado. Inclua os seus para acompanhar limite e faturas.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCardFormEditing(null);
                    setCardFormOpen(true);
                  }}
                  className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white"
                >
                  Incluir primeiro cartão
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {carouselCreditCards.map((c, idx) => {
                  const avail =
                    c.kind === "beneficios"
                      ? benefitBucketsTotal(c)
                      : roundMoney(Math.max(0, c.creditLimit - c.currentInvoice));
                  const texUrl = WALLET_TEX_URLS[idx % WALLET_TEX_URLS.length]!;
                  const iconRight = idx % 2 === 0 ? "contactless" : "credit_card";
                  const labelAvail = c.kind === "beneficios" ? "Saldo disponível" : "Limite disponível";
                  return (
                    <Link
                      key={c.id}
                      to={`/cartao/${c.id}`}
                      className={`group relative flex aspect-[1.58/1] flex-col justify-between overflow-hidden rounded-2xl p-8 text-white shadow-[0px_8px_24px_rgba(0,40,85,0.12)] transition-transform hover:scale-[1.01] ${desktopWalletGradient(c)}`}
                    >
                      <img
                        alt=""
                        src={texUrl}
                        className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-overlay transition-opacity group-hover:opacity-50"
                      />
                      <div className="relative z-10 flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
                            {c.name}
                          </p>
                          <p className="text-base font-medium tracking-wide">
                            •••• •••• •••• {c.last4}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-[32px] opacity-90">{iconRight}</span>
                      </div>
                      <div className="relative z-10">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider opacity-70">
                          {labelAvail}
                        </p>
                        <p className="font-headline text-2xl font-bold">{formatBRL(avail)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-16">
            <section className="space-y-6 lg:col-span-1">
              <h2 className="font-headline text-2xl font-semibold tracking-tight text-primary dark:text-slate-100">
                Contas
              </h2>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:divide-slate-700 dark:bg-slate-800/60">
                {state.accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setEditAccountId(acc.id)}
                    className="group flex w-full cursor-pointer items-center justify-between p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
                        <span className="material-symbols-outlined text-xl">{acc.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-primary dark:text-slate-100">{acc.name}</p>
                        <p className="text-sm text-outline dark:text-slate-400">{accountSubtitleMobile(acc)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pl-2 text-right">
                      <p className="font-semibold text-primary dark:text-slate-100">{formatBRL(acc.balance)}</p>
                      <span className="material-symbols-outlined text-outline transition-transform group-hover:translate-x-0.5 dark:text-slate-500">
                        chevron_right
                      </span>
                    </div>
                  </button>
                ))}
                {state.creditCards
                  .filter((c) => c.kind === "beneficios")
                  .map((card) => (
                    <Link
                      key={card.id}
                      to={`/cartao/${card.id}`}
                      className="group flex items-center justify-between p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                          <span className="material-symbols-outlined text-xl">restaurant</span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-primary dark:text-slate-100">{card.name}</p>
                          <p className="text-sm text-outline dark:text-slate-400">Cartão de benefícios</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 pl-2 text-right">
                        <p className="font-semibold text-primary dark:text-slate-100">
                          {formatBRL(benefitBucketsTotal(card))}
                        </p>
                        <span className="material-symbols-outlined text-outline transition-transform group-hover:translate-x-0.5 dark:text-slate-500">
                          chevron_right
                        </span>
                      </div>
                    </Link>
                  ))}
              </div>
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-[15px] font-semibold text-outline transition-all hover:border-primary-container hover:text-primary dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-400 dark:hover:text-blue-200"
              >
                <span className="material-symbols-outlined text-[20px]">link</span>
                Conectar nova conta
              </button>
            </section>

            <section className="space-y-6 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-headline text-2xl font-semibold tracking-tight text-primary dark:text-slate-100">
                  Extrato recente
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/lancamentos")}
                    className="rounded-lg border border-outline-variant p-2 transition-colors hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800"
                    aria-label="Filtrar lançamentos"
                  >
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-slate-300">
                      filter_list
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportBackup()}
                    className="rounded-lg border border-outline-variant p-2 transition-colors hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800"
                    aria-label="Exportar backup"
                  >
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-slate-300">
                      download
                    </span>
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl bg-white shadow-[0px_4px_12px_rgba(0,40,85,0.05)] dark:bg-slate-800/60">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left">
                    <thead className="border-b border-slate-100 bg-surface-container-low dark:border-slate-700 dark:bg-slate-900/80">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-outline dark:text-slate-400">
                          Transação
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-outline dark:text-slate-400">
                          Categoria
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-outline dark:text-slate-400">
                          Data
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-outline dark:text-slate-400">
                          Valor
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/80">
                      {recentDesktop.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-sm text-on-surface-variant">
                            Sem lançamentos. Inclua movimentações em Lançamentos.
                          </td>
                        </tr>
                      ) : (
                        recentDesktop.map((t) => {
                          const wrap = iconWrapForCategory(t.category, t.amount);
                          return (
                            <tr key={t.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40">
                              <td className="px-6 py-4">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${wrap}`}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-primary dark:text-slate-100">
                                      {t.description}
                                    </p>
                                    {t.paymentAttachmentDataUrl && (
                                      <a
                                        href={t.paymentAttachmentDataUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-secondary hover:underline"
                                      >
                                        <span className="material-symbols-outlined text-xs">attach_file</span>
                                        Comprovante
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex max-w-[160px] truncate px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                    t.amount >= 0
                                      ? "rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                      : categoryPillClass(t.category)
                                  }`}
                                >
                                  {t.amount >= 0 ? "Receita" : t.category}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-outline dark:text-slate-400">
                                {formatDateTimeShort(t.date + "T12:00:00")}
                              </td>
                              <td
                                className={`whitespace-nowrap px-6 py-4 text-right text-sm font-bold ${
                                  t.amount >= 0 ? "text-secondary dark:text-emerald-400" : "text-error dark:text-red-400"
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
                <div className="border-t border-slate-50 p-4 text-center dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => navigate("/lancamentos")}
                    className="font-headline text-[15px] font-semibold text-blue-950 hover:underline dark:text-blue-300"
                  >
                    Carregar mais transações
                  </button>
                </div>
              </div>
            </section>
          </div>

          <section className="group relative h-48 cursor-pointer overflow-hidden rounded-2xl">
            <img
              alt=""
              src={DESKTOP_PROMO_IMG}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center bg-gradient-to-r from-primary/90 to-transparent px-10 md:px-14">
              <div className="max-w-md space-y-4">
                <h3 className="font-headline text-2xl font-semibold text-white">Otimize suas metas hoje</h3>
                <p className="text-sm text-on-primary-container md:text-base">
                  Acompanhe o progresso das metas e ajuste aportes conforme seu fluxo mensal.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/metas")}
                  className="rounded-lg bg-white px-6 py-2.5 text-[15px] font-semibold text-primary shadow-lg transition-colors hover:bg-primary-fixed"
                >
                  Conhecer agora
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
    </Fragment>
  );
}
