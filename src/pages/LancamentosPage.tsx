import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TransactionFormModal } from "../components/TransactionFormModal";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { categoryPillClass, iconWrapForCategory, statusUi } from "../domain/categories";
import { BENEFIT_BUCKET_LABEL } from "../domain/cardWallet";
import { formatDateShort, isInLastDays, isInCurrentMonth } from "../domain/money";
import type { CreditCard, Transaction } from "../domain/types";

const PAGE_SIZE = 6;

type DateFilter = "30" | "90" | "month" | "all";

function matchesDateFilter(iso: string, f: DateFilter): boolean {
  if (f === "all") return true;
  if (f === "month") return isInCurrentMonth(iso);
  if (f === "30") return isInLastDays(iso, 30);
  return isInLastDays(iso, 90);
}

function transactionCardLabel(t: Transaction, cards: CreditCard[]): string {
  if (!t.creditCardId) return "";
  const c = cards.find((x) => x.id === t.creditCardId);
  if (!c) return "";
  if (c.kind === "beneficios" && t.benefitBucket) {
    return `${c.name} · ${BENEFIT_BUCKET_LABEL[t.benefitBucket]}`;
  }
  return c.name;
}

function transactionPaymentLabel(t: Transaction): string {
  if (t.amount >= 0) return "—";
  if (t.creditCardId) return "—";
  const m = t.paymentMethod;
  if (m === "pix") return "PIX";
  if (m === "boleto") return "Boleto";
  return "Conta";
}

function exportCsv(
  rows: {
    date: string;
    description: string;
    category: string;
    cartao: string;
    pagamento: string;
    status: string;
    amount: number;
  }[]
) {
  const header = "Data,Descrição,Categoria,Cartão,Pagamento,Status,Valor\n";
  const body = rows
    .map((r) =>
      [
        r.date,
        `"${r.description.replace(/"/g, '""')}"`,
        r.category,
        `"${r.cartao.replace(/"/g, '""')}"`,
        r.pagamento,
        r.status,
        r.amount.toFixed(2),
      ].join(",")
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paytrackr-lancamentos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LancamentosPage() {
  const {
    state,
    deleteTransaction,
    primaryBalance,
    defaultAccountBalance,
    benefitLiquidity,
    totalWealth,
    monthlyIncome,
    monthlyExpense,
    incomeExpenseRatio,
    greeting,
  } = useFinance();
  const primaryAccount = state.accounts.find((a) => a.id === state.defaultAccountId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30");
  const [categoryFilter, setCategoryFilter] = useState<string | "">("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitialCardId, setFormInitialCardId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (searchParams.get("novo") !== "1") return;
    const cartao = searchParams.get("cartao");
    setEditingTransaction(null);
    setFormOpen(true);
    setFormInitialCardId(cartao);
    const next = new URLSearchParams(searchParams);
    next.delete("novo");
    next.delete("cartao");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.transactions
      .filter((t) => matchesDateFilter(t.date, dateFilter))
      .filter((t) => !categoryFilter || t.category === categoryFilter)
      .filter((t) => {
        if (!q) return true;
        const cardLbl = transactionCardLabel(t, state.creditCards).toLowerCase();
        return (
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (cardLbl && cardLbl.includes(q))
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.transactions, state.creditCards, search, dateFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const monthNet = monthlyIncome - monthlyExpense;
  const trendLabel =
    monthNet >= 0
      ? `${formatBRL(monthNet, { showSign: true })} no mês`
      : `${formatBRL(monthNet)} no mês`;

  const categories = useMemo(
    () => [...new Set(state.transactions.map((t) => t.category))].sort(),
    [state.transactions]
  );

  return (
    <div className="mx-auto max-w-7xl px-6 pb-12 md:px-12">
      <TransactionFormModal
        open={formOpen}
        editingTransaction={editingTransaction}
        onClose={() => {
          setFormOpen(false);
          setFormInitialCardId(null);
          setEditingTransaction(null);
        }}
        initialCreditCardId={formInitialCardId}
      />

      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full max-w-md items-center gap-3 rounded-full bg-surface-container-high px-4 py-2 sm:max-w-lg md:max-w-xl">
          <span className="material-symbols-outlined shrink-0 text-outline">search</span>
          <input
            type="search"
            placeholder="Pesquisar transações..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full border-none bg-transparent text-sm focus:ring-0"
          />
        </div>
        <div className="hidden items-center gap-4 text-primary sm:flex">
          <span className="material-symbols-outlined">notifications</span>
          <span className="material-symbols-outlined">account_balance_wallet</span>
        </div>
      </div>

      <div className="mb-12">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="mb-1 font-headline text-4xl font-extrabold tracking-tight text-primary">
              {greeting}, {state.profile.displayName}!
            </h1>
            <p className="font-medium text-on-surface-variant">
              Aqui está o resumo do seu Ledger para hoje.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingTransaction(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-6 py-3 font-bold text-white shadow-xl transition-all hover:shadow-primary/20 active:scale-95"
          >
            <span className="material-symbols-outlined">add</span>
            Novo Lançamento
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex min-h-[160px] flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-[0px_10px_30px_rgba(7,30,39,0.04)]">
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Saldo principal
              </span>
              <p className="mb-1 text-[11px] text-on-surface-variant/80">
                {benefitLiquidity > 0 ? (
                  <>
                    {primaryAccount?.name ?? "Conta"}: {formatBRL(defaultAccountBalance)} · Benefícios:{" "}
                    {formatBRL(benefitLiquidity)} (soma no valor acima)
                  </>
                ) : (
                  <>{primaryAccount?.name ?? "Conta principal"} — usada nos lançamentos sem cartão</>
                )}
              </p>
              <h2 className="text-3xl font-extrabold text-primary">{formatBRL(primaryBalance)}</h2>
              {state.accounts.length > 1 && (
                <p className="mt-2 text-xs text-on-surface-variant">
                  Total em {state.accounts.length} contas + benefícios:{" "}
                  <span className="font-semibold text-primary">{formatBRL(totalWealth)}</span>
                  <Link
                    to="/"
                    className="ml-2 font-bold text-secondary underline-offset-2 hover:underline"
                  >
                    Ver no painel
                  </Link>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-secondary">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>{trendLabel}</span>
            </div>
          </div>

          <div className="flex min-h-[160px] flex-col justify-between rounded-xl bg-surface-container-low p-6">
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Receitas (Mês)
              </span>
              <h2 className="text-3xl font-extrabold text-secondary">{formatBRL(monthlyIncome)}</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/50">
                <div
                  className="h-full bg-secondary transition-all"
                  style={{ width: `${incomeExpenseRatio}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex min-h-[160px] flex-col justify-between rounded-xl bg-surface-container-low p-6">
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Despesas (Mês)
              </span>
              <h2 className="text-3xl font-extrabold text-on-surface">{formatBRL(monthlyExpense)}</h2>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-error">
              <span className="material-symbols-outlined text-sm">warning</span>
              <span>
                {monthlyExpense > monthlyIncome * 1.1
                  ? "Despesas acima da receita"
                  : "Atenção aos gastos fixos"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-[0px_20px_60px_rgba(0,29,68,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white px-6 py-6 md:px-8">
          <h3 className="text-xl font-bold text-primary">Histórico de Lançamentos</h3>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as DateFilter);
                setPage(1);
              }}
              className="cursor-pointer rounded-lg bg-surface-container-low py-2 pl-4 pr-8 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
            >
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="month">Mês atual</option>
              <option value="all">Todos</option>
            </select>
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className="flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-lg">filter_list</span>
              Filtros
            </button>
            <button
              type="button"
              onClick={() =>
                exportCsv(
                  filtered.map((t) => ({
                    date: t.date,
                    description: t.description,
                    category: t.category,
                    cartao: transactionCardLabel(t, state.creditCards) || "—",
                    pagamento: transactionPaymentLabel(t),
                    status: t.status,
                    amount: t.amount,
                  }))
                )
              }
              className="p-2 text-on-surface-variant transition-colors hover:text-primary"
              aria-label="Download"
            >
              <span className="material-symbols-outlined">download</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="border-t border-surface-container-low bg-surface-container-low/30 px-6 py-4 md:px-8">
            <label className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
              Categoria
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="max-w-xs rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] table-fixed border-collapse text-left">
            <colgroup>
              <col style={{ width: "7.5rem" }} />
              <col style={{ width: "34%" }} />
              <col style={{ width: "7.5rem" }} />
              <col style={{ width: "9rem" }} />
              <col style={{ width: "11rem" }} />
              <col style={{ width: "7.5rem" }} />
              <col style={{ width: "6.5rem" }} />
              <col style={{ width: "4.5rem" }} />
            </colgroup>
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant md:px-6">
                  Data
                </th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant md:px-6">
                  Descrição
                </th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant md:px-6">
                  Categoria
                </th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant md:px-6">
                  Cartão
                </th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant md:px-6">
                  Pagamento
                </th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant md:px-6">
                  Status
                </th>
                <th className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant md:px-6">
                  Valor
                </th>
                <th className="w-[4.5rem] px-1 py-4 text-right md:px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {slice.map((row) => {
                const su = statusUi(row.status);
                const iconWrap = iconWrapForCategory(row.category, row.amount);
                const cardLbl = transactionCardLabel(row, state.creditCards);
                return (
                  <tr key={row.id} className="group transition-colors hover:bg-surface-container-low/30">
                    <td className="align-middle px-4 py-4 text-sm font-medium text-on-surface-variant md:px-6">
                      {formatDateShort(row.date)}
                    </td>
                    <td className="align-middle px-4 py-4 md:px-6">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconWrap}`}
                        >
                          <span className="material-symbols-outlined">{row.icon}</span>
                        </div>
                        <span
                          className="min-w-0 truncate font-bold text-on-surface"
                          title={row.description}
                        >
                          {row.description}
                        </span>
                      </div>
                    </td>
                    <td className="align-middle px-4 py-4 md:px-6">
                      <span className={`whitespace-nowrap ${categoryPillClass(row.category)}`}>
                        {row.category}
                      </span>
                    </td>
                    <td className="align-middle px-4 py-4 text-xs font-medium text-on-surface-variant md:px-6">
                      {cardLbl ? (
                        <span className="block truncate text-on-surface" title={cardLbl}>
                          {cardLbl}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant/50">Conta</span>
                      )}
                    </td>
                    <td className="align-middle px-4 py-4 md:px-6">
                      <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-on-surface-variant">
                        <span className="shrink-0">{transactionPaymentLabel(row)}</span>
                        {row.paymentAttachmentDataUrl && (
                          <a
                            href={row.paymentAttachmentDataUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-[5.5rem] shrink-0 items-center gap-0.5 truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20"
                            title={row.paymentAttachmentName ?? "Abrir comprovante"}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="material-symbols-outlined shrink-0 text-sm">attach_file</span>
                            <span className="truncate">Comprovante</span>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="align-middle px-4 py-4 md:px-6">
                      <div className={`flex items-center gap-2 text-xs font-bold ${su.text}`}>
                        <span className={`h-2 w-2 shrink-0 rounded-[9999px] ${su.dot}`} />
                        {su.label}
                      </div>
                    </td>
                    <td
                      className={`whitespace-nowrap align-middle px-4 py-4 text-right font-bold md:px-6 ${
                        row.amount >= 0 ? "text-secondary" : "text-on-surface"
                      }`}
                    >
                      {formatBRL(row.amount, { showSign: true })}
                    </td>
                    <td className="align-middle px-1 py-4 md:px-2">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTransaction(row);
                            setFormInitialCardId(null);
                            setFormOpen(true);
                          }}
                          className="rounded p-1 text-on-surface-variant hover:text-primary"
                          aria-label="Editar"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTransaction(row.id)}
                          className="rounded p-1 text-on-surface-variant hover:text-error"
                          aria-label="Excluir"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-8 py-12 text-center text-sm text-on-surface-variant">
              Nenhum lançamento encontrado.
            </p>
          )}
        </div>

        <div className="flex flex-col items-stretch justify-between gap-4 bg-surface-container-low/20 px-6 py-6 sm:flex-row sm:items-center md:px-8">
          <span className="text-xs font-medium text-on-surface-variant">
            Mostrando {slice.length} de {filtered.length} lançamentos
            {filtered.length !== state.transactions.length && ` (${state.transactions.length} no total)`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg p-2 transition-colors hover:bg-surface-container-high disabled:opacity-30"
              aria-label="Anterior"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <span className="px-2 text-xs font-bold text-on-surface-variant">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg p-2 transition-colors hover:bg-surface-container-high disabled:opacity-30"
              aria-label="Próxima"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
