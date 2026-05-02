import type { RecurringExpense } from "./types";
import { roundMoney } from "./money";

/** Valor que entra na fatura do cartão ao marcar pago no mês (mensal = valor; anual = 1/12). */
export function recurringChargeForCreditCard(r: RecurringExpense): number {
  return roundMoney(r.cadence === "anual" ? r.amount / 12 : r.amount);
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Dias até o vencimento no mês corrente ou próximo mês */
export function daysUntilDue(dueDay: number, now = new Date()): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const day = Math.min(dueDay, lastDay);
  let target = new Date(y, m, day, 23, 59, 59, 999);
  if (target < now) {
    const nm = m + 1;
    const ny = nm > 11 ? y + 1 : y;
    const nmm = nm > 11 ? 0 : nm;
    const lastNext = new Date(ny, nmm + 1, 0).getDate();
    const d2 = Math.min(dueDay, lastNext);
    target = new Date(ny, nmm, d2, 23, 59, 59, 999);
  }
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
}

export function isPaidThisMonth(r: RecurringExpense, monthKey = currentMonthKey()): boolean {
  return r.paidForMonth === monthKey;
}

export type RecurringDisplayStatus = "vencendo" | "pago" | "pendente";

export function displayStatus(
  r: RecurringExpense,
  now = new Date()
): RecurringDisplayStatus {
  const mk = currentMonthKey(now);
  if (r.paidForMonth === mk) return "pago";
  const d = daysUntilDue(r.dueDay, now);
  if (d <= 3) return "vencendo";
  return "pendente";
}

export function monthlyEquivalentTotal(items: RecurringExpense[]): number {
  let s = 0;
  for (const r of items) {
    if (r.cadence === "anual") s += r.amount / 12;
    else s += r.amount;
  }
  return roundMoney(s);
}

export function annualProjectionTotal(items: RecurringExpense[]): number {
  let s = 0;
  for (const r of items) {
    if (r.cadence === "anual") s += r.amount;
    else s += r.amount * 12;
  }
  return roundMoney(s);
}

export function dueLabel(r: RecurringExpense): string {
  const c = r.cadence === "anual" ? "Anual" : "Mensal";
  return `Dia ${r.dueDay} (${c})`;
}
