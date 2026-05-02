import { newId } from "./id";
import { roundMoney } from "./money";
import type { Receivable, ReceivablePayment } from "./types";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function parseIsoDay(iso: string): Date {
  return new Date(iso + "T12:00:00");
}

/** Soma já recebida nesta cobrança */
export function receivedTotal(r: Receivable): number {
  if (!Array.isArray(r.payments)) return 0;
  return roundMoney(r.payments.reduce((s, p) => s + p.amount, 0));
}

/** Falta receber (≥ 0) */
export function receivableRemaining(r: Receivable): number {
  return roundMoney(Math.max(0, r.amount - receivedTotal(r)));
}

/** Dias de atraso (≥0). Só faz sentido se vencimento < hoje. */
export function daysOverdue(dueDateIso: string, now = new Date()): number {
  const due = startOfDay(parseIsoDay(dueDateIso));
  const t = startOfDay(now);
  const diff = Math.round((t.getTime() - due.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

export function isReceivableOverdue(r: Receivable, now = new Date()): boolean {
  if (r.status !== "aberto") return false;
  return startOfDay(parseIsoDay(r.dueDate)) < startOfDay(now);
}

export function receivableUrgentLabel(r: Receivable, now = new Date()): string {
  if (r.status !== "aberto") return "";
  const due = startOfDay(parseIsoDay(r.dueDate));
  const t = startOfDay(now);
  if (due < t) {
    const d = daysOverdue(r.dueDate, now);
    return `${d} dia${d === 1 ? "" : "s"} de atraso`;
  }
  const ahead = Math.round((due.getTime() - t.getTime()) / 86_400_000);
  if (ahead === 0) return "Vence hoje";
  return `Faltam ${ahead} dia${ahead === 1 ? "" : "s"}`;
}

export function sumOpenReceivables(list: Receivable[]): number {
  return roundMoney(
    list.filter((r) => r.status === "aberto").reduce((s, r) => s + receivableRemaining(r), 0)
  );
}

export function sumOverdueReceivables(list: Receivable[], now = new Date()): number {
  return roundMoney(
    list
      .filter((r) => r.status === "aberto" && isReceivableOverdue(r, now))
      .reduce((s, r) => s + receivableRemaining(r), 0)
  );
}

export function sumRecoveredInMonth(list: Receivable[], now = new Date()): number {
  const m = now.getMonth();
  const y = now.getFullYear();
  let total = 0;
  for (const r of list) {
    if (!Array.isArray(r.payments)) continue;
    for (const p of r.payments) {
      const d = parseIsoDay(p.date);
      if (d.getMonth() === m && d.getFullYear() === y) {
        total += p.amount;
      }
    }
  }
  return roundMoney(total);
}

export function recoveryBarPercent(list: Receivable[], now = new Date()): number {
  const open = sumOpenReceivables(list);
  const recovered = sumRecoveredInMonth(list, now);
  const denom = open + recovered;
  if (denom <= 0) return 0;
  return Math.min(100, roundMoney((recovered / denom) * 100));
}

function normalizePaymentRows(raw: unknown): ReceivablePayment[] {
  if (!Array.isArray(raw)) return [];
  const out: ReceivablePayment[] = [];
  for (const x of raw) {
    const p = x as Partial<ReceivablePayment>;
    const date =
      typeof p.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : null;
    if (!date) continue;
    const amount =
      typeof p.amount === "number" && Number.isFinite(p.amount) ? roundMoney(Math.max(0, p.amount)) : 0;
    if (amount <= 0) continue;
    out.push({ date, amount });
  }
  return out;
}

export function normalizeReceivables(raw: unknown): Receivable[] {
  if (!Array.isArray(raw)) return [];
  const out: Receivable[] = [];
  for (const x of raw) {
    const r = x as Partial<Receivable>;
    if (typeof r.debtorName !== "string" || !r.debtorName.trim()) continue;
    const amount =
      typeof r.amount === "number" && Number.isFinite(r.amount) ? roundMoney(Math.max(0, r.amount)) : 0;
    const dueDate =
      typeof r.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.dueDate)
        ? r.dueDate
        : new Date().toISOString().slice(0, 10);
    const status = r.status === "pago" ? "pago" : "aberto";
    const paidAt =
      status === "pago" && typeof r.paidAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.paidAt)
        ? r.paidAt
        : null;
    const note = typeof r.note === "string" ? r.note : "";
    const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
    const id = typeof r.id === "string" && r.id.length > 0 ? r.id : newId();

    let payments = normalizePaymentRows(r.payments);
    if (payments.length === 0 && status === "pago" && paidAt && amount > 0) {
      payments = [{ date: paidAt, amount }];
    }

    let recv = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
    if (recv > amount && amount > 0) {
      const last = payments[payments.length - 1];
      payments = [{ date: last?.date ?? paidAt ?? dueDate, amount }];
      recv = amount;
    }

    const installmentMode = Boolean(r.installmentMode);
    const installmentCount =
      typeof r.installmentCount === "number" &&
      Number.isFinite(r.installmentCount) &&
      r.installmentCount > 0
        ? Math.min(999, Math.floor(r.installmentCount))
        : null;

    const effectiveStatus: Receivable["status"] = amount > 0 && recv >= amount ? "pago" : "aberto";
    const effectivePaidAt =
      effectiveStatus === "pago"
        ? payments.length > 0
          ? payments[payments.length - 1].date
          : paidAt ?? dueDate
        : null;

    out.push({
      id,
      debtorName: r.debtorName.trim(),
      amount,
      payments,
      installmentMode,
      installmentCount,
      dueDate,
      note,
      status: effectiveStatus,
      paidAt: effectivePaidAt,
      createdAt,
    });
  }
  return out;
}
