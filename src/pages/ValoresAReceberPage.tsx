import { useMemo, useState } from "react";
import { ReceivableFormModal } from "../components/ReceivableFormModal";
import { ReceivablePartialModal } from "../components/ReceivablePartialModal";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { formatDateShort } from "../domain/money";
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
import type { Receivable } from "../domain/types";

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

export function ValoresAReceberPage() {
  const { state, greeting, receiveReceivable, deleteReceivable } = useFinance();
  const [formOpen, setFormOpen] = useState(false);
  const [partialFor, setPartialFor] = useState<Receivable | null>(null);
  const list = state.receivables;

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

  const totalPendente = sumOpenReceivables(list);
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
            Valores a receber
          </h1>
          <p className="font-medium text-on-surface-variant">
            {greeting}, {state.profile.displayName}! Acompanhe quem deve e registre o que já entrou.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-6 py-3 font-bold text-white shadow-xl transition-all hover:shadow-primary/20 active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          Nova cobrança
        </button>
      </div>

      <section className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="group rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-[0px_10px_30px_rgba(7,30,39,0.04)] transition-all hover:shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Total pendente
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low text-primary">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
          </div>
          <p className="font-headline text-3xl font-extrabold text-primary">{formatBRL(totalPendente)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {list.filter((r) => r.status === "aberto").length} cobrança(s) em aberto
          </p>
        </div>

        <div className="group rounded-xl border border-error/10 bg-error-container/20 p-6 transition-all hover:shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-error">Em atraso</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error-container text-error">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                warning
              </span>
            </div>
          </div>
          <p className="font-headline text-3xl font-extrabold text-error">{formatBRL(totalAtraso)}</p>
          <p className="mt-1 text-xs font-medium text-error/80">
            {overdueCount > 0 ? `${overdueCount} cobrança(s) vencida(s)` : "Nada vencido"}
          </p>
        </div>

        <div className="group rounded-xl border border-secondary/10 bg-secondary-container/20 p-6 transition-all hover:shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-on-secondary-container">
              Recuperado no mês
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container text-secondary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                payments
              </span>
            </div>
          </div>
          <p className="font-headline text-3xl font-extrabold text-on-secondary-container">
            {formatBRL(recuperadoMes)}
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary-container/40">
            <div
              className="h-full rounded-full bg-secondary transition-all"
              style={{ width: `${barPct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] font-bold uppercase text-on-secondary-container/70">
            {barPct}% do que já entrou vs. pendente + recuperado
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold text-primary">Cobranças em aberto</h2>
            <span className="text-sm text-on-surface-variant">{openSorted.length} item(ns)</span>
          </div>

          {openSorted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest/80 p-10 text-center">
              <p className="mb-4 text-on-surface-variant">
                Nada a receber por aqui. Cadastre uma cobrança quando alguém te dever.
              </p>
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white"
              >
                Nova cobrança
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
                            {r.installmentMode && (
                              <span className="rounded-full bg-primary-container/30 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                                Parcelas no cartão
                                {r.installmentCount ? ` · até ${r.installmentCount}x` : ""}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant">
                            Vencimento: {formatDateShort(r.dueDate)}
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
                        Cobrar agora
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
                          if (window.confirm("Excluir esta cobrança?")) deleteReceivable(r.id);
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
        </section>

        <aside className="rounded-xl border border-outline-variant/5 bg-surface-container-low p-6 lg:col-span-4">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-headline font-bold text-primary">Últimas entradas</h3>
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
                  Use &quot;Cobrar agora&quot; para o WhatsApp com o valor que falta. Em parcelas no cartão,
                  registre cada entrada em &quot;Registrar parcial&quot;; ao liquidar o restante, use
                  &quot;Liquidar restante&quot;.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
