import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ReceivableFormModal } from "../components/ReceivableFormModal";
import { ReceivablePartialModal } from "../components/ReceivablePartialModal";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { formatDateShort, roundMoney } from "../domain/money";
import {
  currentMonthKey,
  daysUntilDue,
  displayStatus,
  dueLabel,
  isPaidThisMonth,
} from "../domain/recurring";
import {
  isReceivableOverdue,
  receivableRemaining,
  receivableUrgentLabel,
  receivedTotal,
  recoveryBarPercent,
  sumOpenReceivables,
  sumOverdueReceivables,
  sumRecoveredInMonth,
} from "../domain/receivables";
import type { CreditCard, RecurringExpense, Receivable } from "../domain/types";

function recurringPaymentShort(cards: CreditCard[], creditCardId: string | null): string | null {
  if (!creditCardId) return null;
  const c = cards.find((x) => x.id === creditCardId);
  return c ? `${c.name} ·••• ${c.last4}` : null;
}

function pendingRecurringMonthTotal(rows: RecurringExpense[], mk: string): number {
  let s = 0;
  for (const r of rows) {
    if (isPaidThisMonth(r, mk)) continue;
    s += r.cadence === "anual" ? r.amount / 12 : r.amount;
  }
  return roundMoney(s);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function cobrarWhatsApp(r: Receivable) {
  const rest = receivableRemaining(r);
  const parcela = r.installmentMode
    ? r.installmentCount
      ? ` Está pagando em parcelas no cartão (até ${r.installmentCount}x).`
      : " Está quitando em parcelas no cartão."
    : "";
  const msg = `Olá! Passando para lembrar: falta ${formatBRL(rest)} de ${formatBRL(r.amount)} no total, vencimento em ${formatDateShort(r.dueDate)}.${parcela}${r.note ? ` Obs.: ${r.note}` : ""} Obrigado!`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
}

function formatRelativePaid(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const now = new Date();
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return `Há ${diff} dias`;
  return formatDateShort(iso);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function recurringRowBadge(st: ReturnType<typeof displayStatus>) {
  if (st === "pago") {
    return "rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase text-on-secondary-container";
  }
  if (st === "vencendo") {
    return "rounded-full bg-error-container px-2 py-0.5 text-[10px] font-bold uppercase text-on-error-container";
  }
  return "rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold uppercase text-on-tertiary-fixed-variant";
}

export function ContasPagarReceberPage() {
  const {
    state,
    greeting,
    receiveReceivable,
    deleteReceivable,
    toggleRecurringPaid,
  } = useFinance();
  const [formOpen, setFormOpen] = useState(false);
  const [partialFor, setPartialFor] = useState<Receivable | null>(null);
  const list = state.receivables;
  const mk = currentMonthKey();

  const unpaidRecurring = useMemo(() => {
    return state.recurringExpenses
      .filter((r) => !isPaidThisMonth(r, mk))
      .sort((a, b) => a.dueDay - b.dueDay);
  }, [state.recurringExpenses, mk]);

  const totalRecorrentePendente = useMemo(
    () => pendingRecurringMonthTotal(state.recurringExpenses, mk),
    [state.recurringExpenses, mk]
  );

  const openSorted = useMemo(() => {
    const open = list.filter((r) => r.status === "aberto");
    return [...open].sort((a, b) => {
      const oa = isReceivableOverdue(a) ? 0 : 1;
      const ob = isReceivableOverdue(b) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [list]);

  const recentPayments = useMemo(() => {
    const rows: { key: string; debtorName: string; amount: number; date: string }[] = [];
    for (const r of list) {
      if (!Array.isArray(r.payments)) continue;
      for (let i = 0; i < r.payments.length; i++) {
        const p = r.payments[i];
        rows.push({
          key: `${r.id}-${p.date}-${i}-${p.amount}`,
          debtorName: r.debtorName,
          amount: p.amount,
          date: p.date,
        });
      }
    }
    return rows
      .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)
      .slice(0, 10);
  }, [list]);

  const totalPendenteReceber = sumOpenReceivables(list);
  const totalAtraso = sumOverdueReceivables(list);
  const recuperadoMes = sumRecoveredInMonth(list);
  const barPct = recoveryBarPercent(list);
  const overdueCount = list.filter((r) => r.status === "aberto" && isReceivableOverdue(r)).length;

  return (
    <div className="mx-auto max-w-7xl px-6 pb-12 md:px-12">
      <ReceivableFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <ReceivablePartialModal
        open={partialFor !== null}
        receivable={partialFor}
        onClose={() => setPartialFor(null)}
        onConfirm={({ amount, registerIncome }) => {
          if (!partialFor) return;
          receiveReceivable(partialFor.id, { amount, registerIncome });
        }}
      />

      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mb-1 font-headline text-3xl font-extrabold tracking-tight text-primary">
            Contas a pagar e receber
          </h1>
          <p className="font-medium text-on-surface-variant">
            {greeting}, {state.profile.displayName}! Gastos fixos do mês num lugar; entradas esperadas como salário,
            aluguel ou dividendos em outro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/gastos-recorrentes"
            className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-5 py-3 text-sm font-bold text-primary shadow-sm transition-all hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-lg">calendar_month</span>
            Gastos recorrentes
          </Link>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-6 py-3 font-bold text-white shadow-xl transition-all hover:shadow-primary/20 active:scale-95"
          >
            <span className="material-symbols-outlined">add</span>
            Nova receita
          </button>
        </div>
      </div>

      <section className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="group rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-[0px_10px_30px_rgba(7,30,39,0.04)] transition-all hover:shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              A pagar (fixos no mês)
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low text-error">
              <span className="material-symbols-outlined">south_west</span>
            </div>
          </div>
          <p className="font-headline text-3xl font-extrabold text-primary">{formatBRL(totalRecorrentePendente)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {unpaidRecurring.length} conta(s) fixa(s) ainda não marcada(s) como pagas neste mês
          </p>
        </div>

        <div className="group rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-[0px_10px_30px_rgba(7,30,39,0.04)] transition-all hover:shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              A receber (em aberto)
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low text-primary">
              <span className="material-symbols-outlined">north_east</span>
            </div>
          </div>
          <p className="font-headline text-3xl font-extrabold text-primary">{formatBRL(totalPendenteReceber)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {list.filter((r) => r.status === "aberto").length} entrada(s) esperada(s)
          </p>
        </div>

        <div className="group rounded-xl border border-error/10 bg-error-container/20 p-6 transition-all hover:shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-error">Receitas em atraso</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error-container text-error">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                warning
              </span>
            </div>
          </div>
          <p className="font-headline text-3xl font-extrabold text-error">{formatBRL(totalAtraso)}</p>
          <p className="mt-1 text-xs font-medium text-error/80">
            {overdueCount > 0 ? `${overdueCount} com vencimento passado` : "Nada vencido"}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <section className="space-y-10 lg:col-span-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-headline text-xl font-bold text-primary">Contas a pagar — gastos recorrentes</h2>
              <Link
                to="/gastos-recorrentes?novo=1"
                className="text-xs font-bold text-primary underline-offset-2 hover:underline"
              >
                + Novo gasto fixo
              </Link>
            </div>
            <p className="text-sm text-on-surface-variant">
              São os compromissos mensais ou anuais (água, streaming, academia…). Marque como pago aqui ou gerencie
              categorias e cartões na página de gastos recorrentes.
            </p>

            {unpaidRecurring.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest/80 p-8 text-center">
                <p className="mb-3 text-on-surface-variant">
                  Nenhum gasto fixo pendente neste mês — ou você já marcou todos como pagos.
                </p>
                <Link
                  to="/gastos-recorrentes?novo=1"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white"
                >
                  Cadastrar gasto fixo
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {unpaidRecurring.slice(0, 12).map((r) => {
                  const st = displayStatus(r);
                  const cardHint = recurringPaymentShort(state.creditCards, r.creditCardId);
                  const dueSoon = daysUntilDue(r.dueDay);
                  return (
                    <div
                      key={r.id}
                      className="flex flex-col gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-error-container/25 text-error">
                          <span className="material-symbols-outlined text-xl">payments</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-primary">{r.name}</h3>
                            <span className={recurringRowBadge(st)}>
                              {st === "pago" ? "Pago" : st === "vencendo" ? "Vencendo" : "Pendente"}
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant">
                            {r.category} · {dueLabel(r)}
                            {dueSoon <= 7 ? (
                              <span className="font-semibold text-on-surface">
                                {" "}
                                · {dueSoon === 0 ? "vence hoje" : `em ${dueSoon} dia(s)`}
                              </span>
                            ) : null}
                          </p>
                          {cardHint ? (
                            <p className="mt-0.5 text-[11px] text-on-surface-variant/90">Cartão: {cardHint}</p>
                          ) : null}
                          {r.subtitle ? (
                            <p className="mt-1 text-[11px] text-on-surface-variant/80">{r.subtitle}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                        <p className="font-headline text-lg font-black text-primary sm:text-right">
                          {formatBRL(r.cadence === "anual" ? r.amount / 12 : r.amount)}
                          <span className="ml-1 text-xs font-medium text-on-surface-variant">
                            {r.cadence === "anual" ? "/mês (proporc.)" : ""}
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleRecurringPaid(r.id, mk)}
                          className="rounded-lg bg-secondary px-4 py-2 text-xs font-bold text-on-secondary-container hover:bg-secondary/90"
                        >
                          Marcar pago no mês
                        </button>
                      </div>
                    </div>
                  );
                })}
                {unpaidRecurring.length > 12 ? (
                  <p className="text-center text-sm text-on-surface-variant">
                    +{unpaidRecurring.length - 12} outro(s).{" "}
                    <Link to="/gastos-recorrentes" className="font-bold text-primary hover:underline">
                      Ver todos em Gastos recorrentes
                    </Link>
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-6 border-t border-outline-variant/15 pt-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-headline text-xl font-bold text-primary">Contas a receber</h2>
              <span className="text-sm text-on-surface-variant">{openSorted.length} em aberto</span>
            </div>
            <p className="text-sm text-on-surface-variant">
              Salário, aluguel que você recebe, dividendos, reembolsos ou valores que alguém te deve — registre o que
              espera entrar e acompanhe parciais e quitações.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-secondary/15 bg-secondary-container/15 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                  Recuperado no mês
                </p>
                <p className="mt-1 font-headline text-2xl font-extrabold text-on-secondary-container">
                  {formatBRL(recuperadoMes)}
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary-container/40">
                  <div
                    className="h-full rounded-full bg-secondary transition-all"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-bold uppercase text-on-secondary-container/70">{barPct}% meta</p>
              </div>
            </div>

            {openSorted.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest/80 p-10 text-center">
                <p className="mb-4 text-on-surface-variant">
                  Nenhuma conta a receber em aberto. Inclua salário, aluguel, dividendos ou cobranças de terceiros.
                </p>
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white"
                >
                  Nova receita
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {openSorted.map((r) => {
                  const overdue = isReceivableOverdue(r);
                  const badge = receivableUrgentLabel(r);
                  const recv = receivedTotal(r);
                  const rest = receivableRemaining(r);
                  const pct = r.amount > 0 ? Math.min(100, Math.round((recv / r.amount) * 100)) : 0;
                  return (
                    <div
                      key={r.id}
                      className="flex flex-col gap-5 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5 transition-colors hover:bg-surface-container-low"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container-high">
                            <span className="font-bold text-primary">{initials(r.debtorName)}</span>
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-primary">{r.debtorName}</h3>
                              {r.incomeCategory ? (
                                <span className="rounded-full bg-secondary-container/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-secondary-container">
                                  {r.incomeCategory}
                                </span>
                              ) : null}
                              {r.installmentMode && (
                                <span className="rounded-full bg-primary-container/30 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                                  Parcelas no cartão
                                  {r.installmentCount ? ` · até ${r.installmentCount}x` : ""}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-on-surface-variant">
                              Expectativa / vencimento: {formatDateShort(r.dueDate)}
                            </p>
                            {badge && (
                              <div
                                className={`mt-1 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  overdue
                                    ? "bg-error-container text-error"
                                    : "bg-surface-container-high text-on-surface-variant"
                                }`}
                              >
                                {badge}
                              </div>
                            )}
                            {r.note ? (
                              <p className="mt-1.5 text-[11px] text-on-surface-variant/80">{r.note}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="min-w-[200px] space-y-2 md:text-right">
                          <p className="font-headline text-2xl font-black text-primary">
                            {formatBRL(rest)}{" "}
                            <span className="text-sm font-medium text-on-surface-variant">a receber</span>
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            Total {formatBRL(r.amount)} · já entrou {formatBRL(recv)}
                          </p>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high md:ml-auto md:max-w-[220px]">
                            <div
                              className="h-full rounded-full bg-secondary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/10 pt-4">
                        <button
                          type="button"
                          onClick={() => cobrarWhatsApp(r)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary-container sm:max-w-[160px]"
                        >
                          <span className="material-symbols-outlined text-sm">send</span>
                          Lembrar (WhatsApp)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPartialFor(r)}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-secondary/40 bg-secondary-container/30 px-4 py-2.5 text-xs font-bold text-on-secondary-container hover:bg-secondary-container/50 sm:max-w-[180px]"
                        >
                          <span className="material-symbols-outlined text-sm">payments</span>
                          Registrar parcial
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Registrar o restante (${formatBRL(rest)}) na conta principal? Será criado um lançamento de receita.`
                              )
                            ) {
                              receiveReceivable(r.id, { registerIncome: true });
                            }
                          }}
                          className="flex flex-1 rounded-lg border border-outline-variant/30 bg-white px-4 py-2.5 text-xs font-bold text-primary hover:bg-surface-container-low dark:bg-slate-800/80 sm:max-w-[200px]"
                        >
                          Liquidar restante
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Marcar os ${formatBRL(rest)} restantes como recebidos sem lançar na conta?`
                              )
                            ) {
                              receiveReceivable(r.id, { registerIncome: false });
                            }
                          }}
                          className="text-xs font-semibold text-on-surface-variant underline-offset-2 hover:text-primary hover:underline"
                        >
                          Só marcar quitado
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Excluir esta entrada?")) deleteReceivable(r.id);
                          }}
                          className="text-error hover:underline"
                          aria-label="Excluir"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-xl border border-outline-variant/5 bg-surface-container-low p-6 lg:col-span-4">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-headline font-bold text-primary">Últimas entradas recebidas</h3>
            <span className="material-symbols-outlined text-on-surface-variant">history</span>
          </div>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Nenhum recebimento registrado ainda.</p>
          ) : (
            <div className="space-y-6">
              {recentPayments.map((row) => (
                <div key={row.key} className="relative border-l-2 border-secondary/20 pl-6">
                  <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-secondary ring-4 ring-white dark:ring-slate-800" />
                  <p className="text-sm font-bold text-primary">Entrada registrada</p>
                  <p className="text-xs text-on-surface-variant">{row.debtorName}</p>
                  <p className="mt-1 font-headline text-lg font-bold text-secondary">{formatBRL(row.amount)}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-on-surface-variant">
                    {formatRelativePaid(row.date)}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-8 border-t border-outline-variant/10 pt-6">
            <div className="flex items-start gap-3 rounded-lg bg-surface-container-highest/50 p-4">
              <span className="material-symbols-outlined text-primary">lightbulb</span>
              <div>
                <p className="text-xs font-bold text-primary">Dica</p>
                <p className="text-[11px] leading-relaxed text-on-surface-variant">
                  Use <strong className="text-on-surface">Contas a pagar</strong> para não esquecer boletos fixos do mês.
                  Em <strong className="text-on-surface">Contas a receber</strong>, “Registrar parcial” serve para salário
                  ou aluguel recebido em partes; “Liquidar restante” gera receita na conta principal.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
