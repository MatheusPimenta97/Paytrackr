import { roundMoney } from "./money";
import type { FinanceState, Transaction } from "./types";

/** Recebível + lançamento gerados com data errada ("hoje"); limpeza única idempotente ao carregar estado. */
const LEGACY_ADVANCE_JAN26_AMOUNT = roundMoney(3575.86);

function matchesAdvanceDebtorName(name: string): boolean {
  const n = name.trim().replace(/\s+/g, " ");
  return /^Adiantamento JAN\/26$/i.test(n);
}

function matchesAdvanceIncomeTx(t: Transaction): boolean {
  if (roundMoney(t.amount) !== LEGACY_ADVANCE_JAN26_AMOUNT || t.amount <= 0) return false;
  if (t.creditCardId) return false;
  const d = t.description.trim().replace(/\s+/g, " ");
  if (!/^Recebimento\b/i.test(d)) return false;
  return d.includes("Adiantamento JAN/26");
}

/** Remove artefatos conhecidos e reverte saldo da conta para transações removidas. */
export function applyFinanceDataFixes(state: FinanceState): FinanceState {
  const receivables = state.receivables.filter(
    (r) =>
      !(matchesAdvanceDebtorName(r.debtorName) && roundMoney(r.amount) === LEGACY_ADVANCE_JAN26_AMOUNT)
  );
  const txsToDrop = state.transactions.filter(matchesAdvanceIncomeTx);
  if (txsToDrop.length === 0 && receivables.length === state.receivables.length) return state;

  const dropIds = new Set(txsToDrop.map((t) => t.id));
  const transactions = state.transactions.filter((t) => !dropIds.has(t.id));

  let accounts = state.accounts;
  if (txsToDrop.length > 0 && Array.isArray(accounts)) {
    accounts = accounts.map((a) => {
      let sub = 0;
      for (const tx of txsToDrop) {
        if (tx.accountId !== a.id) continue;
        if (tx.status === "recebido" || tx.status === "confirmado") sub += tx.amount;
      }
      return sub !== 0 ? { ...a, balance: roundMoney(a.balance - sub) } : a;
    });
  }

  return { ...state, receivables, transactions, accounts };
}
