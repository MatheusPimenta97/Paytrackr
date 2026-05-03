import { roundMoney } from "./money";
import type { Transaction } from "./types";

/**
 * Soma o efeito dos lançamentos no cartão de **crédito** sobre a fatura em aberto,
 * ignorando linhas com `skipCardInvoiceDelta` (ex.: importação de fatura antiga pela IA).
 * Espelha a lógica de `ADD_TRANSACTION` / `DELETE_TRANSACTION` para `kind === "credito"`.
 */
export function openInvoiceTotalFromCardTransactions(
  cardId: string,
  transactions: ReadonlyArray<Transaction>,
): number {
  let inv = 0;
  for (const t of transactions) {
    if (t.creditCardId !== cardId || t.skipCardInvoiceDelta === true) continue;
    inv += t.amount < 0 ? Math.abs(t.amount) : -t.amount;
  }
  return roundMoney(Math.max(0, inv));
}
