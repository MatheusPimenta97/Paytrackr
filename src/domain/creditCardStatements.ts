import { newId } from "./id";
import { roundMoney } from "./money";
import type { CreditCardStatement, CreditCardStatementStatus } from "./types";

export function normalizeCreditCardStatements(raw: unknown): CreditCardStatement[] {
  if (!Array.isArray(raw)) return [];
  const out: CreditCardStatement[] = [];
  for (const x of raw) {
    const r = x as Partial<CreditCardStatement>;
    if (typeof r.creditCardId !== "string" || !r.creditCardId) continue;
    const referenceMonth =
      typeof r.referenceMonth === "string" && /^\d{4}-\d{2}$/.test(r.referenceMonth)
        ? r.referenceMonth
        : new Date().toISOString().slice(0, 7);
    const amount =
      typeof r.amount === "number" && Number.isFinite(r.amount) ? roundMoney(Math.max(0, r.amount)) : 0;
    const status: CreditCardStatementStatus = r.status === "paga" ? "paga" : "aberta";
    const paidAt =
      status === "paga" && typeof r.paidAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.paidAt)
        ? r.paidAt
        : null;
    const note = typeof r.note === "string" ? r.note.slice(0, 500) : "";
    let attachmentDataUrl: string | null = null;
    let attachmentName: string | null = null;
    if (
      typeof r.attachmentDataUrl === "string" &&
      r.attachmentDataUrl.startsWith("data:") &&
      r.attachmentDataUrl.length <= 2_500_000
    ) {
      attachmentDataUrl = r.attachmentDataUrl;
      attachmentName =
        typeof r.attachmentName === "string" && r.attachmentName.length > 0
          ? r.attachmentName.slice(0, 240)
          : "anexo";
    }
    const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
    const id = typeof r.id === "string" && r.id.length > 0 ? r.id : newId();
    out.push({
      id,
      creditCardId: r.creditCardId,
      referenceMonth,
      amount,
      status,
      paidAt,
      note,
      attachmentDataUrl,
      attachmentName,
      createdAt,
    });
  }
  return out;
}
