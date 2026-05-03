export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatBRL(value: number, options?: { showSign?: boolean }): string {
  const abs = Math.abs(value);
  const fmt = abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = value < 0 ? "-" : value > 0 && options?.showSign ? "+" : "";
  return `${sign} R$ ${fmt}`;
}

/** Accepts "1.234,56" or "1234.56" or "1234,56" */
export function parseMoneyInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  if (Number.isNaN(n)) return null;
  return roundMoney(n);
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTimeShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isInCurrentMonth(iso: string, now = new Date()): boolean {
  const d = new Date(iso + "T12:00:00");
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

/**
 * Datas do lançamento (YYYY-MM-DD) dentro de uma janela de ±`days` dias em torno de hoje
 * (meia-noite a fim do dia), em horário local. Inclui lançamentos “agendados” com data futura
 * próxima — o intervalo antigo usava só `d <= now`, o que escondia qualquer data > hoje.
 */
export function isInLastDays(iso: string, days: number, now = new Date()): boolean {
  const tx = new Date(iso + "T12:00:00").getTime();
  const pivot = new Date(now);
  pivot.setHours(12, 0, 0, 0);
  const start = new Date(pivot);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  const end = new Date(pivot);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);
  return tx >= start.getTime() && tx <= end.getTime();
}

export function greetingForNow(now = new Date()): "Bom dia" | "Boa tarde" | "Boa noite" {
  const h = now.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export type GreetingPeriod = "morning" | "afternoon" | "night";

export function greetingPeriodForNow(now = new Date()): GreetingPeriod {
  const h = now.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "night";
}

/** Ícone Material alinhado ao período (sol, nuvem, lua). */
export function greetingMaterialIconForNow(now = new Date()): {
  name: string;
  className: string;
  filled: boolean;
} {
  const p = greetingPeriodForNow(now);
  if (p === "morning") {
    return { name: "wb_sunny", className: "text-amber-500 dark:text-amber-400", filled: true };
  }
  if (p === "afternoon") {
    return { name: "partly_cloudy_day", className: "text-sky-500 dark:text-sky-400", filled: true };
  }
  return { name: "dark_mode", className: "text-indigo-400 dark:text-indigo-300", filled: true };
}

/** Garante dia de ciclo de fatura entre 1 e 31 (bancos costumam usar 1–28). */
export function clampBillingDay(day: unknown): number {
  const n = typeof day === "number" ? day : Number(day);
  if (!Number.isFinite(n)) return 1;
  return Math.min(31, Math.max(1, Math.floor(n)));
}

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Data de calendário do `desiredDay` no mês (ajusta fevereiro etc.). */
export function calendarDateForBillingDayInMonth(
  year: number,
  monthIndex: number,
  desiredDay: number
): Date {
  const want = clampBillingDay(desiredDay);
  const last = lastDayOfMonth(year, monthIndex);
  const d = Math.min(want, last);
  return new Date(year, monthIndex, d, 12, 0, 0, 0);
}

export function creditCardDueDateThisMonth(dueDay: number, now = new Date()): Date {
  return calendarDateForBillingDayInMonth(now.getFullYear(), now.getMonth(), dueDay);
}

/** Ex.: "Todo dia 5" — vencimento/fechamento recorrente no mês */
export function formatCardBillingDayLabel(day: number): string {
  return `Todo dia ${clampBillingDay(day)}`;
}

export type CardDueStatus = "overdue" | "soon" | "open";

/** Classifica vencimento para selo na UI (fatura atrasada / próxima / em aberto). */
export function creditCardDueStatus(dueDay: number, now = new Date()): CardDueStatus {
  const due = startOfDayLocal(creditCardDueDateThisMonth(dueDay, now));
  const startToday = startOfDayLocal(now);
  const diffDays = Math.round((due.getTime() - startToday.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "soon";
  return "open";
}

/** Dias até o vencimento deste mês (negativo se já passou no calendário). */
export function daysUntilCreditCardDue(dueDay: number, now = new Date()): number {
  const due = startOfDayLocal(creditCardDueDateThisMonth(dueDay, now));
  const startToday = startOfDayLocal(now);
  return Math.round((due.getTime() - startToday.getTime()) / 86_400_000);
}

/** Próxima data de fechamento (ciclo mensal pelo dia do mês). */
export function nextCreditCardClosingDate(closingDay: number, now = new Date()): Date {
  const y = now.getFullYear();
  const m = now.getMonth();
  let close = calendarDateForBillingDayInMonth(y, m, closingDay);
  const startToday = startOfDayLocal(now);
  const closeStart = startOfDayLocal(close);
  if (closeStart < startToday) {
    const nextM = m === 11 ? 0 : m + 1;
    const nextY = m === 11 ? y + 1 : y;
    close = calendarDateForBillingDayInMonth(nextY, nextM, closingDay);
  }
  return close;
}

/** Dias até o próximo fechamento (0 = hoje). */
export function daysUntilCreditCardClosing(closingDay: number, now = new Date()): number {
  const close = nextCreditCardClosingDate(closingDay, now);
  const startToday = startOfDayLocal(now);
  return Math.round((startOfDayLocal(close).getTime() - startToday.getTime()) / 86_400_000);
}

/** Ex.: "15 out" para o próximo fechamento (título curto). */
export function formatNextClosingShort(closingDay: number, now = new Date()): string {
  const d = nextCreditCardClosingDate(closingDay, now);
  return d
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
    .replace(/\./g, "")
    .trim();
}
