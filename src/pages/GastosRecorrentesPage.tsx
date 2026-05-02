import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GreetingTimeIcon } from "../components/GreetingTimeIcon";
import { RecurringFormModal } from "../components/RecurringFormModal";
import { useFinance, formatBRL } from "../context/FinanceContext";
import type { CreditCard } from "../domain/types";
import {
  annualProjectionTotal,
  currentMonthKey,
  daysUntilDue,
  displayStatus,
  dueLabel,
  isPaidThisMonth,
  monthlyEquivalentTotal,
} from "../domain/recurring";

function recurringPaymentLabel(cards: CreditCard[], creditCardId: string | null): string {
  if (!creditCardId) return "—";
  const c = cards.find((x) => x.id === creditCardId);
  return c ? `${c.name} ·••• ${c.last4}` : "Cartão removido";
}

const FOOTER_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCQx2ew0K7DBWu8YiOOjSCssJGdo5KwZqPOLx-6jfeP6WErskvYlzEjK3VnyUi_A1Eo6vA1_FltAi4Y_6DSBJhhuD7ApIhff8uhiAM1QjGVAb_QBYEFHYPwQLyC01WQP8Q4kYerInekrbhm7X-IxjIXrViN0YtXhYIgi_HL-YgWvqXjeY0x8J75NPZmAs-LPqYn53qPgbmb59teI4iouD1Resx87jsj4IjDZ9JAFGMMZeZSbQH3Vld2cx_E49UYgXbhxyx1LWu0TRA";

const PAGE_SIZE = 6;

function statusBadge(st: ReturnType<typeof displayStatus>) {
  if (st === "pago") {
    return "inline-flex rounded-full bg-secondary-container px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container";
  }
  if (st === "vencendo") {
    return "inline-flex rounded-full bg-error-container px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-error-container";
  }
  return "inline-flex rounded-full bg-tertiary-fixed px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-tertiary-fixed-variant";
}

function statusLabel(st: ReturnType<typeof displayStatus>) {
  if (st === "pago") return "Pago";
  if (st === "vencendo") return "Vencendo";
  return "Pendente";
}

function GastosRecorrentesPage() {
  const {
    state,
    greeting,
    deleteRecurring,
    toggleRecurringPaid,
    monthlyExpense,
  } = useFinance();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [menuId, setMenuId] = useState<string | null>(null);

  const mk = currentMonthKey();
  const totalMonthly = monthlyEquivalentTotal(state.recurringExpenses);
  const projection12 = annualProjectionTotal(state.recurringExpenses);

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setEditingId(null);
      setFormOpen(true);
      searchParams.delete("novo");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!menuId) return;
    const close = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-rec-menu-root]")) return;
      setMenuId(null);
    };
    const id = window.setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", close);
    };
  }, [menuId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.recurringExpenses
      .filter((r) => !categoryFilter || r.category === categoryFilter)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.subtitle.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      )
      .sort((a, b) => a.dueDay - b.dueDay);
  }, [state.recurringExpenses, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  /** Todos os não pagos que empatem no menor “dias até vencer” (ex.: vários no dia 10). */
  const nextDueGroup = useMemo(() => {
    let bestDays = 999;
    for (const r of state.recurringExpenses) {
      if (isPaidThisMonth(r, mk)) continue;
      const d = daysUntilDue(r.dueDay);
      if (d < bestDays) bestDays = d;
    }
    if (bestDays === 999) return null;
    const rows = state.recurringExpenses
      .filter((r) => !isPaidThisMonth(r, mk) && daysUntilDue(r.dueDay) === bestDays)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { rows, days: bestDays };
  }, [state.recurringExpenses, mk]);

  const nextDueIdsKey = nextDueGroup?.rows.map((r) => r.id).join("|") ?? "";
  const [carouselIdx, setCarouselIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setCarouselIdx(0);
  }, [nextDueIdsKey]);

  const nextDueView = useMemo(() => {
    if (!nextDueGroup) return null;
    const n = nextDueGroup.rows.length;
    const ci = Math.min(carouselIdx, Math.max(0, n - 1));
    return { ...nextDueGroup, n, ci, active: nextDueGroup.rows[ci]! };
  }, [nextDueGroup, carouselIdx]);

  const paidThisMonth = state.recurringExpenses.filter((r) => isPaidThisMonth(r, mk)).length;
  const paidAmount = state.recurringExpenses
    .filter((r) => isPaidThisMonth(r, mk))
    .reduce((s, r) => s + (r.cadence === "anual" ? r.amount / 12 : r.amount), 0);
  const progressPct =
    totalMonthly > 0 ? Math.min(100, Math.round((paidAmount / totalMonthly) * 100)) : 0;

  const barHeights = useMemo(() => {
    if (!state.recurringExpenses.length) return [] as { id: string; h: number }[];
    const max = Math.max(...state.recurringExpenses.map((r) => r.amount), 1);
    return state.recurringExpenses.map((r) => ({
      id: r.id,
      h: Math.round((r.amount / max) * 100),
    }));
  }, [state.recurringExpenses]);

  const sharePct =
    monthlyExpense + totalMonthly > 0
      ? Math.round((totalMonthly / (monthlyExpense + totalMonthly)) * 100)
      : 38;

  function downloadRecurringCsv() {
    const header = "Nome,Detalhe,Categoria,Valor,Dia,Cadência,Pago no mês,Cartão\n";
    const body = filtered
      .map((r) =>
        [
          `"${r.name}"`,
          `"${r.subtitle}"`,
          r.category,
          r.amount,
          r.dueDay,
          r.cadence,
          r.paidForMonth === mk ? "sim" : "não",
          `"${recurringPaymentLabel(state.creditCards, r.creditCardId)}"`,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos-recorrentes-${mk}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const categories = [...new Set(state.recurringExpenses.map((r) => r.category))].sort();

  return (
    <div className="mx-auto max-w-7xl px-6 pb-28 pt-6 text-on-background md:pb-12 md:pt-8">
      <RecurringFormModal
        open={formOpen}
        editingId={editingId}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
        }}
      />

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-headline text-lg font-bold tracking-tight text-primary md:text-xl">
            {greeting}, {state.profile.displayName}!
          </h1>
          <p className="text-sm text-on-surface-variant">Gastos recorrentes e assinaturas</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1">
            <GreetingTimeIcon className="text-sm" />
            <span className="text-[11px] font-bold uppercase tracking-tighter text-on-surface-variant">
              São Paulo
            </span>
          </div>
          <div className="hidden max-w-xs flex-1 items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 lg:flex">
            <span className="material-symbols-outlined text-outline">search</span>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar..."
              className="w-full border-none bg-transparent text-sm placeholder:text-outline/60 focus:ring-0"
            />
          </div>
        </div>
      </div>

      <div className="mb-6 lg:hidden">
        <div className="flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-2">
          <span className="material-symbols-outlined text-outline">search</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar entradas..."
            className="w-full border-none bg-transparent text-sm focus:ring-0"
          />
        </div>
      </div>

      <div className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Total recorrente mensal
              </p>
              <h3 className="font-headline text-4xl font-extrabold tracking-tight text-primary">
                {formatBRL(totalMonthly)}
              </h3>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
                <span className="material-symbols-outlined mr-1 text-xs">trending_up</span>
                {paidThisMonth}/{state.recurringExpenses.length || 1} pagas no mês
              </span>
            </div>
          </div>
          <div className="relative mt-8 h-24 w-full">
            <div className="absolute inset-0 flex items-end gap-1 opacity-20">
              {barHeights.map(({ id, h }) => (
                <div
                  key={id}
                  className="flex-1 bg-primary"
                  style={{ height: `${Math.max(8, h)}%`, borderRadius: "4px 4px 0 0" }}
                />
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/10" />
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-primary p-6 text-white shadow-xl">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          {nextDueView ? (
            <>
              <div
                className="relative z-10"
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(e) => {
                  const start = touchStartX.current;
                  touchStartX.current = null;
                  if (start == null || nextDueView.n < 2) return;
                  const end = e.changedTouches[0]?.clientX ?? start;
                  const dx = end - start;
                  if (Math.abs(dx) < 48) return;
                  if (dx < 0)
                    setCarouselIdx((i) => Math.min(nextDueView.n - 1, i + 1));
                  else setCarouselIdx((i) => Math.max(0, i - 1));
                }}
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/60">
                  Próximo vencimento
                  {nextDueView.n > 1 && (
                    <span className="ml-2 normal-case text-white/50">
                      ({nextDueView.ci + 1}/{nextDueView.n})
                    </span>
                  )}
                </p>
                <div className="flex items-start gap-1">
                  {nextDueView.n > 1 && (
                    <button
                      type="button"
                      aria-label="Anterior"
                      onClick={() => setCarouselIdx((i) => Math.max(0, i - 1))}
                      disabled={nextDueView.ci <= 0}
                      className="-ml-1 mt-0.5 shrink-0 rounded-lg p-1 text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-2xl">chevron_left</span>
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-headline text-xl font-bold leading-tight">
                      {nextDueView.active.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-white/70">
                      {formatBRL(nextDueView.active.amount)}
                      <span className="text-white/40"> · </span>
                      dia {nextDueView.active.dueDay}
                    </p>
                    <p className="mt-1 font-medium text-secondary-fixed">
                      {nextDueView.days === 0
                        ? "Vence hoje"
                        : nextDueView.days === 1
                          ? "Vence amanhã"
                          : `Vence em ${nextDueView.days} dias`}
                    </p>
                  </div>
                  {nextDueView.n > 1 && (
                    <button
                      type="button"
                      aria-label="Próximo"
                      onClick={() =>
                        setCarouselIdx((i) => Math.min(nextDueView.n - 1, i + 1))
                      }
                      disabled={nextDueView.ci >= nextDueView.n - 1}
                      className="-mr-1 mt-0.5 shrink-0 rounded-lg p-1 text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-2xl">chevron_right</span>
                    </button>
                  )}
                </div>
                {nextDueView.n > 1 && (
                  <div className="mt-3 flex justify-center gap-1.5">
                    {nextDueView.rows.map((r, i) => (
                      <button
                        key={r.id}
                        type="button"
                        aria-label={`Ir para ${i + 1}`}
                        aria-current={i === nextDueView.ci}
                        onClick={() => setCarouselIdx(i)}
                        className={`h-1.5 rounded-full transition-all ${
                          i === nextDueView.ci
                            ? "w-6 bg-secondary"
                            : "w-1.5 bg-white/30 hover:bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="relative z-10 mt-8">
                <div className="mb-2 flex justify-between text-sm">
                  <span>Progresso no mês</span>
                  <span className="font-bold">{formatBRL(paidAmount)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => toggleRecurringPaid(nextDueView.active.id, mk)}
                  className="mt-6 w-full rounded-lg bg-white py-2 text-sm font-bold text-primary transition-colors hover:bg-slate-100"
                >
                  {isPaidThisMonth(nextDueView.active, mk) ? "Desmarcar pago" : "Marcar como pago"}
                </button>
              </div>
            </>
          ) : (
            <p className="relative z-10 text-sm text-white/80">Nada pendente — ótimo controle.</p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-container-low shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-container-low px-6 py-6 md:px-8">
          <h2 className="font-headline text-xl font-bold text-primary">Assinaturas e contas fixas</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowFilter((s) => !s)}
              className="flex items-center rounded-lg bg-surface-container-lowest px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-white"
            >
              <span className="material-symbols-outlined mr-2 text-sm">filter_alt</span>
              Filtrar
            </button>
            <button
              type="button"
              onClick={downloadRecurringCsv}
              className="flex items-center rounded-lg bg-surface-container-lowest px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-white"
            >
              <span className="material-symbols-outlined mr-2 text-sm">download</span>
              Exportar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setFormOpen(true);
              }}
              className="flex items-center rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:brightness-110"
            >
              <span className="material-symbols-outlined mr-2 text-sm">add_circle</span>
              Novo
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="border-t border-surface-container-high/50 px-6 py-4 md:px-8">
            <label className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
              Categoria
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg bg-surface-container-high px-3 py-2 text-sm"
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
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-high/50">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant md:px-8">
                  Serviço / Nome
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant md:px-8">
                  Cartão
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant md:px-8">
                  Categoria
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant md:px-8">
                  Valor (R$)
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant md:px-8">
                  Vencimento
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant md:px-8">
                  Status
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant md:px-8">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r, idx) => {
                const st = displayStatus(r);
                const altBg = idx % 2 === 0 ? "bg-surface-container-lowest" : "bg-surface-container-low";
                return (
                  <tr key={r.id} className={`${altBg} transition-colors hover:bg-white`}>
                    <td className="px-6 py-5 md:px-8">
                      <div className="flex items-center">
                        <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-high">
                          <span className="material-symbols-outlined text-primary">{r.icon}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-primary">{r.name}</p>
                          <p className="text-xs text-on-surface-variant">{r.subtitle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[140px] px-6 py-5 text-xs text-on-surface-variant md:px-8">
                      {recurringPaymentLabel(state.creditCards, r.creditCardId)}
                    </td>
                    <td className="px-6 py-5 text-xs font-medium text-on-surface-variant md:px-8">
                      {r.category}
                    </td>
                    <td className="px-6 py-5 md:px-8">
                      <p className="text-sm font-bold text-primary">{formatBRL(r.amount)}</p>
                    </td>
                    <td className="px-6 py-5 md:px-8">
                      <p className="text-xs text-on-surface-variant">{dueLabel(r)}</p>
                    </td>
                    <td className="px-6 py-5 md:px-8">
                      <span className={statusBadge(st)}>{statusLabel(st)}</span>
                    </td>
                    <td className="relative px-6 py-5 md:px-8">
                      <div className="inline-block" data-rec-menu-root>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId((id) => (id === r.id ? null : r.id));
                          }}
                          className="text-outline transition-colors hover:text-primary"
                        >
                          <span className="material-symbols-outlined">more_horiz</span>
                        </button>
                        {menuId === r.id && (
                          <div className="absolute right-4 top-12 z-20 min-w-[160px] rounded-lg border border-outline-variant/20 bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-4 py-2 text-left text-xs font-bold text-primary hover:bg-surface-container-low"
                            onClick={() => {
                              toggleRecurringPaid(r.id, mk);
                              setMenuId(null);
                            }}
                          >
                            {isPaidThisMonth(r, mk) ? "Desmarcar pago" : "Marcar pago"}
                          </button>
                          <button
                            type="button"
                            className="block w-full px-4 py-2 text-left text-xs font-bold text-primary hover:bg-surface-container-low"
                            onClick={() => {
                              setEditingId(r.id);
                              setFormOpen(true);
                              setMenuId(null);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="block w-full px-4 py-2 text-left text-xs font-bold text-error hover:bg-surface-container-low"
                            onClick={() => {
                              if (confirm(`Excluir "${r.name}"?`)) deleteRecurring(r.id);
                              setMenuId(null);
                            }}
                          >
                            Excluir
                          </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-on-surface-variant">Nenhum item.</p>
          )}
        </div>

        <div className="flex flex-col items-stretch justify-between gap-4 bg-surface-container-low/50 px-6 py-4 sm:flex-row sm:items-center md:px-8">
          <p className="text-xs text-on-surface-variant">
            Mostrando {slice.length} de {filtered.length} despesas recorrentes
            {paidThisMonth > 0 && ` · ${paidThisMonth} pagas este mês`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg bg-surface-container-lowest p-2 text-primary disabled:opacity-50"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg bg-surface-container-lowest p-2 text-primary disabled:opacity-50"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 items-center gap-12 md:grid-cols-2">
        <div className="space-y-4">
          <h4 className="font-headline text-2xl font-extrabold leading-tight text-primary">
            Mantenha seu fluxo sob controle soberano.
          </h4>
          <p className="max-w-md leading-relaxed text-on-surface-variant">
            As despesas recorrentes representam cerca de {sharePct}% do seu fluxo mensal estimado
            (fixos + lançamentos do mês). Revise assinaturas para liberar capital para investimentos.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              type="button"
              onClick={() => setShowFilter(true)}
              className="rounded-lg bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:brightness-110"
            >
              Otimizar agora
            </button>
            <button
              type="button"
              onClick={downloadRecurringCsv}
              className="rounded-lg border border-outline-variant/30 px-6 py-3 text-sm font-bold text-primary transition-all hover:bg-surface-container-low"
            >
              Relatório detalhado
            </button>
          </div>
        </div>
        <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-2xl bg-surface-container-high shadow-inner">
          <img
            alt=""
            src={FOOTER_IMG}
            className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-overlay"
          />
          <div className="z-10 text-center">
            <span className="material-symbols-outlined mb-4 text-5xl text-primary">insights</span>
            <p className="font-headline font-bold text-primary">Projeção de 12 meses</p>
            <p className="text-sm text-primary/70">{formatBRL(projection12)} previstos em gastos fixos</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setEditingId(null);
          setFormOpen(true);
        }}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-[9999px] bg-secondary text-white shadow-2xl transition-all hover:scale-105 active:scale-95 md:hidden"
        aria-label="Novo"
      >
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  );
}

export default GastosRecorrentesPage;
