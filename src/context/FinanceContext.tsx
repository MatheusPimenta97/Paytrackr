import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  createEmptyFinanceState,
  createInitialFinanceState,
  defaultProfile,
} from "../data/initialFinanceState";
import { useAuth } from "./AuthContext";
import {
  mergeLoyaltyProgramsAfterRemotePull,
  normalizeExpirationBuckets,
  normalizeLoyaltyPrograms,
} from "../domain/loyaltyPoints";
import { normalizeCreditCardStatements } from "../domain/creditCardStatements";
import { normalizeCustomIncomeCategoriesForProfile } from "../domain/incomeCategories";
import { normalizeReceivables, receivedTotal } from "../domain/receivables";
import {
  isTxnPaymentMethod,
  type Account,
  type CreditCard,
  type CreditCardBrand,
  type CreditCardKind,
  type CreditCardStatement,
  type FinanceState,
  type Goal,
  type LoyaltyProgram,
  type PointsExpirationBucket,
  type Receivable,
  type RecurringExpense,
  type Transaction,
  type TxnPaymentMethod,
  type UserProfile,
} from "../domain/types";
import {
  adjustBenefitBalance,
  defaultBenefitBalances,
  isBenefitBucket,
  totalBenefitLiquidity,
} from "../domain/cardWallet";
import { newId } from "../domain/id";
import {
  clampBillingDay,
  coerceStatementReferenceMonthYm,
  formatBRL,
  greetingForNow,
  greetingMaterialIconForNow,
  isInCurrentMonth,
  roundMoney,
} from "../domain/money";
import { openInvoiceTotalFromCardTransactions } from "../domain/creditCardInvoice";
import { currentMonthKey, recurringChargeForCreditCard } from "../domain/recurring";
import {
  fetchFinanceEnvelopeFromCloud,
  getLastRemoteFinanceTs,
  pushFinanceEnvelopeToCloud,
  setLastRemoteFinanceTs,
  subscribeFinanceCloud,
} from "../sync/firestoreFinanceSync";
import { pullLanDevSync, pushLanDevSync } from "../sync/lanDevSync";

function adjustCardInvoice(cards: CreditCard[], cardId: string, delta: number): CreditCard[] {
  return cards.map((c) =>
    c.id === cardId ? { ...c, currentInvoice: roundMoney(Math.max(0, c.currentInvoice + delta)) } : c
  );
}

function getCreditoCardById(cards: CreditCard[], id: string): CreditCard | undefined {
  const c = cards.find((x) => x.id === id);
  return c?.kind === "credito" ? c : undefined;
}

const CREDIT_CARD_BRAND_SET = new Set<CreditCardBrand>(["visa", "master", "elo", "amex", "outro"]);

function normalizeCardBrand(b: unknown): CreditCardBrand {
  return typeof b === "string" && CREDIT_CARD_BRAND_SET.has(b as CreditCardBrand)
    ? (b as CreditCardBrand)
    : "outro";
}

function billingDayFromLegacyIso(s: unknown): number | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const day = parseInt(s.slice(8, 10), 10);
  if (day >= 1 && day <= 31) return day;
  return null;
}

function normalizeCreditCards(raw: unknown[]): CreditCard[] {
  return raw.map((x) => {
    const c = x as CreditCard & {
      closingDate?: unknown;
      dueDate?: unknown;
      closingDay?: unknown;
      dueDay?: unknown;
      kind?: unknown;
      benefitBalances?: unknown;
    };
    const kind: CreditCardKind = c.kind === "beneficios" ? "beneficios" : "credito";
    const rawB = c.benefitBalances as Record<string, unknown> | undefined;
    const benefitBalances = defaultBenefitBalances();
    if (rawB && typeof rawB === "object") {
      for (const k of ["refeicao", "alimentacao", "mobilidade"] as const) {
        const v = rawB[k];
        if (typeof v === "number" && Number.isFinite(v)) benefitBalances[k] = roundMoney(Math.max(0, v));
      }
    }

    let closingDay =
      typeof c.closingDay === "number" && Number.isFinite(c.closingDay)
        ? clampBillingDay(c.closingDay)
        : null;
    let dueDay =
      typeof c.dueDay === "number" && Number.isFinite(c.dueDay) ? clampBillingDay(c.dueDay) : null;
    if (closingDay === null) closingDay = billingDayFromLegacyIso(c.closingDate) ?? 1;
    if (dueDay === null) dueDay = billingDayFromLegacyIso(c.dueDate) ?? closingDay ?? 5;

    const id = typeof c.id === "string" && c.id.length > 0 ? c.id : newId();
    const brand = normalizeCardBrand(c.brand);
    const name = typeof c.name === "string" ? c.name : "";
    const last4 = typeof c.last4 === "string" ? c.last4 : "0000";
    const currentInvoice =
      typeof c.currentInvoice === "number" && Number.isFinite(c.currentInvoice)
        ? roundMoney(Math.max(0, c.currentInvoice))
        : 0;
    const creditLimit =
      typeof c.creditLimit === "number" && Number.isFinite(c.creditLimit)
        ? roundMoney(Math.max(0, c.creditLimit))
        : 0;

    return {
      id,
      kind,
      brand,
      name,
      last4,
      currentInvoice,
      creditLimit,
      closingDay,
      dueDay,
      benefitBalances,
    };
  });
}

const PAYMENT_ATTACHMENT_MAX_LEN = 2_500_000;

function isAllowedReceiptDataUrl(url: string): boolean {
  return (
    url.startsWith("data:application/pdf") ||
    url.startsWith("data:image/png") ||
    url.startsWith("data:image/jpeg") ||
    url.startsWith("data:image/jpg") ||
    url.startsWith("data:image/webp")
  );
}

function pickReceiptFromRaw(raw: Partial<Transaction> & Record<string, unknown>): {
  url?: string;
  name?: string;
} {
  const url =
    typeof raw.paymentAttachmentDataUrl === "string" && raw.paymentAttachmentDataUrl.length > 0
      ? raw.paymentAttachmentDataUrl
      : typeof raw.boletoAttachmentDataUrl === "string" && raw.boletoAttachmentDataUrl.length > 0
        ? raw.boletoAttachmentDataUrl
        : undefined;
  const name =
    typeof raw.paymentAttachmentName === "string"
      ? raw.paymentAttachmentName
      : typeof raw.boletoAttachmentName === "string"
        ? raw.boletoAttachmentName
        : undefined;
  return { url, name };
}

function sanitizeTxnPaymentFields(
  raw: Partial<Transaction> & Record<string, unknown>,
  opts: { creditCardId: string | null; amount: number }
): {
  paymentMethod: TxnPaymentMethod | null;
  paymentAttachmentDataUrl: string | null;
  paymentAttachmentName: string | null;
} {
  let paymentMethod: TxnPaymentMethod | null = null;
  let paymentAttachmentDataUrl: string | null = null;
  let paymentAttachmentName: string | null = null;

  if (!opts.creditCardId && opts.amount < 0) {
    if (isTxnPaymentMethod(raw.paymentMethod)) {
      paymentMethod = raw.paymentMethod;
    }
    if (paymentMethod === "boleto" || paymentMethod === "pix") {
      const { url, name } = pickReceiptFromRaw(raw);
      if (
        typeof url === "string" &&
        url.length <= PAYMENT_ATTACHMENT_MAX_LEN &&
        isAllowedReceiptDataUrl(url)
      ) {
        paymentAttachmentDataUrl = url;
        paymentAttachmentName =
          typeof name === "string" && name.length > 0 && name.length <= 240 ? name : "comprovante";
      }
    }
  }

  return { paymentMethod, paymentAttachmentDataUrl, paymentAttachmentName };
}

function normalizeTransactions(raw: unknown[]): Transaction[] {
  return raw.map((x) => {
    const t = x as Transaction & Record<string, unknown>;
    const creditCardId =
      typeof t.creditCardId === "string" && t.creditCardId.length > 0 ? t.creditCardId : null;
    const benefitBucket =
      t.benefitBucket != null && isBenefitBucket(t.benefitBucket) ? t.benefitBucket : null;
    const amount = typeof t.amount === "number" && Number.isFinite(t.amount) ? t.amount : 0;
    const pay = sanitizeTxnPaymentFields(t, { creditCardId, amount });
    const {
      boletoAttachmentDataUrl: _b,
      boletoAttachmentName: _bn,
      statementReferenceMonth: _srmRaw,
      justification: _juRaw,
      ...rest
    } = t;
    const thirdPartyName =
      typeof t.thirdPartyName === "string" && t.thirdPartyName.trim()
        ? t.thirdPartyName.trim().slice(0, 120)
        : null;
    const skipCardInvoiceDelta = t.skipCardInvoiceDelta === true ? true : undefined;
    const statementReferenceMonth = coerceStatementReferenceMonthYm(t.statementReferenceMonth) ?? undefined;
    const justification =
      typeof t.justification === "string" && t.justification.trim()
        ? t.justification.trim().slice(0, 500)
        : undefined;
    return {
      ...(rest as Transaction),
      creditCardId,
      benefitBucket,
      thirdPartyName,
      skipCardInvoiceDelta,
      ...(statementReferenceMonth ? { statementReferenceMonth } : {}),
      ...(justification ? { justification } : {}),
      ...pay,
    };
  });
}

function normalizeRecurringExpenses(raw: unknown[]): RecurringExpense[] {
  return raw.map((x) => {
    const r = x as RecurringExpense & { creditCardId?: unknown };
    return {
      ...r,
      creditCardId:
        typeof r.creditCardId === "string" && r.creditCardId.length > 0 ? r.creditCardId : null,
    };
  });
}

function migrateProfile(parsed: Record<string, unknown>, base: UserProfile): UserProfile {
  const b: UserProfile = { ...defaultProfile(), ...base };
  const legacyName =
    typeof parsed.userFirstName === "string" ? parsed.userFirstName.trim() : "";
  const raw = parsed.profile;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      displayName: legacyName || b.displayName,
      monthlySalary: b.monthlySalary,
      photoDataUrl: b.photoDataUrl ?? null,
      customIncomeCategories: b.customIncomeCategories,
    };
  }
  const p = raw as Record<string, unknown>;
  const fromProfile =
    typeof p.displayName === "string" ? p.displayName.trim() : "";
  const displayName = fromProfile || legacyName || b.displayName;
  let monthlySalary = b.monthlySalary;
  if (typeof p.monthlySalary === "number" && Number.isFinite(p.monthlySalary)) {
    monthlySalary = roundMoney(Math.max(0, p.monthlySalary));
  }
  let photoDataUrl: string | null = null;
  if (p.photoDataUrl === null) photoDataUrl = null;
  else if (
    typeof p.photoDataUrl === "string" &&
    p.photoDataUrl.startsWith("data:image/") &&
    p.photoDataUrl.length <= 2_500_000
  ) {
    photoDataUrl = p.photoDataUrl;
  } else {
    photoDataUrl = b.photoDataUrl ?? null;
  }
  let customIncomeCategories = b.customIncomeCategories;
  if (Array.isArray(p.customIncomeCategories)) {
    customIncomeCategories = normalizeCustomIncomeCategoriesForProfile(p.customIncomeCategories);
  }
  return { displayName, monthlySalary, photoDataUrl, customIncomeCategories };
}

export const FINANCE_STORAGE_SCOPE_DEMO = "local-demo";

function financeStorageKeys(scope: string) {
  return {
    state: `paytrackr-finance-v1-${scope}`,
    updatedAt: `paytrackr-finance-updatedAt-v1-${scope}`,
  };
}

function getLocalUpdatedAtForScope(scope: string): number {
  try {
    const v = localStorage.getItem(financeStorageKeys(scope).updatedAt);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function loadStateForScope(scope: string): FinanceState {
  const isDemoScope = scope === FINANCE_STORAGE_SCOPE_DEMO;
  const sk = financeStorageKeys(scope).state;
  try {
    const raw = localStorage.getItem(sk);
    if (!raw) {
      return isDemoScope ? createInitialFinanceState() : createEmptyFinanceState();
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const base = isDemoScope ? createInitialFinanceState() : createEmptyFinanceState();
    if (!Array.isArray(parsed.transactions)) return base;
    return migrateFinanceState(parsed, base);
  } catch {
    return isDemoScope ? createInitialFinanceState() : createEmptyFinanceState();
  }
}

type Action =
  | { type: "HYDRATE"; payload: FinanceState }
  | { type: "ADD_TRANSACTION"; payload: Omit<Transaction, "id"> & { id?: string } }
  | { type: "PATCH_TRANSACTION"; id: string; patch: { thirdPartyName?: string | null } }
  | { type: "UPDATE_TRANSACTION"; id: string; patch: Partial<Omit<Transaction, "id">> }
  | { type: "DELETE_TRANSACTION"; id: string }
  | { type: "ADD_GOAL"; payload: Omit<Goal, "id" | "current"> & { current?: number } }
  | { type: "CONTRIBUTE_GOAL"; goalId: string; amount: number }
  | { type: "ADD_RECURRING"; payload: Omit<RecurringExpense, "id"> & { id?: string } }
  | { type: "UPDATE_RECURRING"; id: string; patch: Partial<RecurringExpense> }
  | { type: "DELETE_RECURRING"; id: string }
  | { type: "TOGGLE_RECURRING_PAID"; id: string; monthKey: string }
  | { type: "SET_ACCOUNT_BALANCE"; accountId: string; balance: number }
  | { type: "UPDATE_ACCOUNT"; id: string; patch: Partial<Pick<Account, "name" | "balance" | "icon">> }
  | { type: "ADD_CREDIT_CARD"; payload: Omit<CreditCard, "id"> & { id?: string } }
  | { type: "UPDATE_CREDIT_CARD"; id: string; patch: Partial<Omit<CreditCard, "id">> }
  | { type: "SYNC_CREDIT_CARD_OPEN_INVOICE"; cardId: string; markExpenseHistoryBefore?: string }
  | { type: "DELETE_CREDIT_CARD"; id: string }
  | { type: "RESET_CREDIT_CARD_ACTIVITY"; cardId: string }
  | {
      type: "ADD_CREDIT_CARD_STATEMENT";
      payload: Omit<CreditCardStatement, "id" | "createdAt"> & { id?: string; createdAt?: string };
    }
  | { type: "UPDATE_CREDIT_CARD_STATEMENT"; id: string; patch: Partial<Omit<CreditCardStatement, "id">> }
  | { type: "DELETE_CREDIT_CARD_STATEMENT"; id: string }
  | { type: "UPDATE_PROFILE"; patch: Partial<UserProfile> }
  | { type: "ADD_RECEIVABLE"; payload: Omit<Receivable, "id" | "status" | "paidAt" | "createdAt"> & { id?: string } }
  | { type: "DELETE_RECEIVABLE"; id: string }
  | { type: "RECEIVE_RECEIVABLE"; id: string; registerIncome: boolean; amount?: number }
  | {
      type: "ADD_LOYALTY_PROGRAM";
      payload: Omit<LoyaltyProgram, "id"> & { id?: string };
    }
  | { type: "UPDATE_LOYALTY_PROGRAM"; id: string; patch: Partial<Omit<LoyaltyProgram, "id">> }
  | { type: "DELETE_LOYALTY_PROGRAM"; id: string }
  | {
      type: "SET_POINTS_SETTINGS";
      patch: Partial<{
        pointsExpiring30d: number;
        pointsValuePerPoint: number;
        pointsExpirationBuckets: PointsExpirationBucket[];
      }>;
    };

function financeReducer(state: FinanceState, action: Action): FinanceState {
  switch (action.type) {
    case "HYDRATE": {
      const p = action.payload as FinanceState & { userFirstName?: string };
      return {
        ...p,
        profile: migrateProfile(
          {
            profile: p.profile as unknown,
            userFirstName: p.userFirstName,
          } as Record<string, unknown>,
          p.profile ?? defaultProfile()
        ),
        creditCards: Array.isArray(p.creditCards)
          ? normalizeCreditCards(p.creditCards as unknown[])
          : p.creditCards,
        transactions: Array.isArray(p.transactions)
          ? normalizeTransactions(p.transactions as unknown[])
          : p.transactions,
        receivables: normalizeReceivables(
          Array.isArray(p.receivables) ? p.receivables : []
        ),
        loyaltyPrograms: normalizeLoyaltyPrograms(
          Array.isArray(p.loyaltyPrograms) ? p.loyaltyPrograms : []
        ),
        pointsExpiring30d:
          typeof p.pointsExpiring30d === "number" && Number.isFinite(p.pointsExpiring30d)
            ? roundMoney(Math.max(0, p.pointsExpiring30d))
            : 0,
        pointsValuePerPoint:
          typeof p.pointsValuePerPoint === "number" &&
          Number.isFinite(p.pointsValuePerPoint) &&
          p.pointsValuePerPoint >= 0
            ? p.pointsValuePerPoint
            : 0.02,
        pointsExpirationBuckets: normalizeExpirationBuckets(
          Array.isArray(p.pointsExpirationBuckets) ? p.pointsExpirationBuckets : []
        ),
        creditCardStatements: normalizeCreditCardStatements(
          Array.isArray(p.creditCardStatements) ? p.creditCardStatements : []
        ),
      };
    }
    case "ADD_TRANSACTION": {
      const id = action.payload.id ?? newId();
      const raw = action.payload;
      const creditCardId =
        typeof raw.creditCardId === "string" && raw.creditCardId.length > 0 ? raw.creditCardId : null;
      const benefitBucket =
        raw.benefitBucket != null && isBenefitBucket(raw.benefitBucket) ? raw.benefitBucket : null;
      const pay = sanitizeTxnPaymentFields(raw as Record<string, unknown>, {
        creditCardId,
        amount: raw.amount,
      });
      const txMerged = { ...raw, id, creditCardId, benefitBucket, ...pay } as Record<string, unknown>;
      delete txMerged.boletoAttachmentDataUrl;
      delete txMerged.boletoAttachmentName;
      const srm = coerceStatementReferenceMonthYm(raw.statementReferenceMonth);
      if (srm) txMerged.statementReferenceMonth = srm;
      else delete txMerged.statementReferenceMonth;
      const ju =
        typeof raw.justification === "string" && raw.justification.trim()
          ? raw.justification.trim().slice(0, 500)
          : null;
      if (ju) txMerged.justification = ju;
      else delete txMerged.justification;
      const tx = txMerged as Transaction;
      const { amount, accountId, goalId } = tx;
      const accId = accountId || state.defaultAccountId;
      const card = creditCardId ? state.creditCards.find((c) => c.id === creditCardId) : null;

      let goals = state.goals;
      if (goalId && amount < 0) {
        goals = goals.map((g) =>
          g.id === goalId ? { ...g, current: roundMoney(g.current + Math.abs(amount)) } : g
        );
      }

      let accounts = state.accounts;
      let creditCards = state.creditCards;

      if (card) {
        if (card.kind === "beneficios" && benefitBucket) {
          creditCards = adjustBenefitBalance(creditCards, card.id, benefitBucket, amount);
        } else if (card.kind === "credito") {
          if (tx.skipCardInvoiceDelta !== true) {
            const invDelta = amount < 0 ? Math.abs(amount) : -amount;
            creditCards = adjustCardInvoice(creditCards, card.id, invDelta);
          }
        } else {
          accounts = state.accounts.map((a) =>
            a.id === accId ? { ...a, balance: roundMoney(a.balance + amount) } : a
          );
        }
      } else {
        accounts = state.accounts.map((a) =>
          a.id === accId ? { ...a, balance: roundMoney(a.balance + amount) } : a
        );
      }

      return {
        ...state,
        transactions: [tx, ...state.transactions],
        accounts,
        creditCards,
        goals,
      };
    }
    case "PATCH_TRANSACTION": {
      const { id, patch } = action;
      const thirdPartyName =
        patch.thirdPartyName === undefined
          ? undefined
          : patch.thirdPartyName && String(patch.thirdPartyName).trim()
            ? String(patch.thirdPartyName).trim().slice(0, 120)
            : null;
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === id ? { ...t, ...(thirdPartyName !== undefined ? { thirdPartyName } : {}) } : t
        ),
      };
    }
    case "UPDATE_TRANSACTION": {
      const prev = state.transactions.find((t) => t.id === action.id);
      if (!prev) return state;
      const merged: Transaction = { ...prev, ...action.patch, id: prev.id };
      const afterDelete = financeReducer(state, { type: "DELETE_TRANSACTION", id: prev.id });
      return financeReducer(afterDelete, { type: "ADD_TRANSACTION", payload: merged });
    }
    case "DELETE_TRANSACTION": {
      const tx = state.transactions.find((t) => t.id === action.id);
      if (!tx) return state;
      let goals = state.goals;
      if (tx.goalId && tx.amount < 0) {
        goals = goals.map((g) =>
          g.id === tx.goalId
            ? { ...g, current: Math.max(0, roundMoney(g.current - Math.abs(tx.amount))) }
            : g
        );
      }

      const card =
        tx.creditCardId && String(tx.creditCardId).length > 0
          ? state.creditCards.find((c) => c.id === tx.creditCardId)
          : null;
      let accounts = state.accounts;
      let creditCards = state.creditCards;

      if (card && tx.creditCardId) {
        if (card.kind === "beneficios" && tx.benefitBucket && isBenefitBucket(tx.benefitBucket)) {
          creditCards = adjustBenefitBalance(creditCards, card.id, tx.benefitBucket, -tx.amount);
        } else if (card.kind === "credito" && tx.skipCardInvoiceDelta !== true) {
          creditCards = adjustCardInvoice(creditCards, card.id, tx.amount);
        }
      } else {
        accounts = state.accounts.map((a) =>
          a.id === tx.accountId ? { ...a, balance: roundMoney(a.balance - tx.amount) } : a
        );
      }

      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.id),
        accounts,
        creditCards,
        goals,
      };
    }
    case "ADD_GOAL": {
      const id = newId();
      const { current = 0, ...rest } = action.payload;
      return {
        ...state,
        goals: [...state.goals, { ...rest, id, current: roundMoney(current) }],
      };
    }
    case "CONTRIBUTE_GOAL": {
      const { goalId, amount } = action;
      if (amount <= 0) return state;
      const checking = state.defaultAccountId;
      const tx: Transaction = {
        id: newId(),
        date: new Date().toISOString().slice(0, 10),
        description: `Aporte — ${state.goals.find((g) => g.id === goalId)?.title ?? "Meta"}`,
        category: "Investimentos",
        amount: -amount,
        status: "confirmado",
        icon: "savings",
        accountId: checking,
        goalId,
      };
      return financeReducer(state, { type: "ADD_TRANSACTION", payload: tx });
    }
    case "ADD_RECURRING": {
      const id = action.payload.id ?? newId();
      const ccid =
        typeof action.payload.creditCardId === "string" && action.payload.creditCardId
          ? action.payload.creditCardId
          : null;
      const row: RecurringExpense = {
        ...action.payload,
        id,
        paidForMonth: action.payload.paidForMonth ?? null,
        creditCardId: ccid,
      };
      let creditCards = state.creditCards;
      const mk = currentMonthKey();
      if (
        row.paidForMonth === mk &&
        row.creditCardId &&
        getCreditoCardById(creditCards, row.creditCardId)
      ) {
        creditCards = adjustCardInvoice(creditCards, row.creditCardId, recurringChargeForCreditCard(row));
      }
      return { ...state, recurringExpenses: [...state.recurringExpenses, row], creditCards };
    }
    case "UPDATE_RECURRING": {
      const prev = state.recurringExpenses.find((r) => r.id === action.id);
      if (!prev) return state;
      const mk = currentMonthKey();
      const wasPaid = prev.paidForMonth === mk;
      const patch = { ...action.patch };
      if (patch.creditCardId !== undefined) {
        patch.creditCardId =
          typeof patch.creditCardId === "string" && patch.creditCardId ? patch.creditCardId : null;
      }
      const merged: RecurringExpense = { ...prev, ...patch };
      let creditCards = state.creditCards;
      if (wasPaid) {
        if (prev.creditCardId && getCreditoCardById(creditCards, prev.creditCardId)) {
          creditCards = adjustCardInvoice(
            creditCards,
            prev.creditCardId,
            -recurringChargeForCreditCard(prev)
          );
        }
        if (merged.creditCardId && getCreditoCardById(creditCards, merged.creditCardId)) {
          creditCards = adjustCardInvoice(
            creditCards,
            merged.creditCardId,
            recurringChargeForCreditCard(merged)
          );
        }
      }
      return {
        ...state,
        creditCards,
        recurringExpenses: state.recurringExpenses.map((r) => (r.id === action.id ? merged : r)),
      };
    }
    case "DELETE_RECURRING": {
      const del = state.recurringExpenses.find((r) => r.id === action.id);
      let creditCards = state.creditCards;
      if (
        del &&
        del.paidForMonth === currentMonthKey() &&
        del.creditCardId &&
        getCreditoCardById(creditCards, del.creditCardId)
      ) {
        creditCards = adjustCardInvoice(
          creditCards,
          del.creditCardId,
          -recurringChargeForCreditCard(del)
        );
      }
      return {
        ...state,
        creditCards,
        recurringExpenses: state.recurringExpenses.filter((r) => r.id !== action.id),
      };
    }
    case "TOGGLE_RECURRING_PAID": {
      const { id, monthKey } = action;
      const row = state.recurringExpenses.find((r) => r.id === id);
      if (!row) return state;
      const wasPaid = row.paidForMonth === monthKey;
      const willPay = !wasPaid;
      let creditCards = state.creditCards;
      if (row.creditCardId && getCreditoCardById(creditCards, row.creditCardId)) {
        const amt = recurringChargeForCreditCard(row);
        creditCards = adjustCardInvoice(creditCards, row.creditCardId, willPay ? amt : -amt);
      }
      return {
        ...state,
        creditCards,
        recurringExpenses: state.recurringExpenses.map((r) =>
          r.id === id ? { ...r, paidForMonth: willPay ? monthKey : null } : r
        ),
      };
    }
    case "SET_ACCOUNT_BALANCE": {
      const { accountId, balance } = action;
      const bal = roundMoney(balance);
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === accountId ? { ...a, balance: bal } : a
        ),
      };
    }
    case "UPDATE_ACCOUNT": {
      const { id, patch } = action;
      return {
        ...state,
        accounts: state.accounts.map((a) => {
          if (a.id !== id) return a;
          const next = { ...a, ...patch };
          if (patch.name !== undefined) next.name = patch.name.trim();
          if (patch.balance !== undefined) next.balance = roundMoney(patch.balance);
          return next;
        }),
      };
    }
    case "ADD_CREDIT_CARD": {
      const id = action.payload.id ?? newId();
      const p = action.payload;
      const digits = p.last4.replace(/\D/g, "");
      const last4 =
        digits.length >= 4 ? digits.slice(-4) : digits.length > 0 ? digits.padStart(4, "0").slice(-4) : "0000";
      const kind: CreditCardKind = p.kind === "beneficios" ? "beneficios" : "credito";
      const benefitBalances =
        p.benefitBalances && typeof p.benefitBalances === "object"
          ? {
              refeicao: roundMoney(
                Math.max(0, Number((p.benefitBalances as Record<string, number>).refeicao) || 0)
              ),
              alimentacao: roundMoney(
                Math.max(0, Number((p.benefitBalances as Record<string, number>).alimentacao) || 0)
              ),
              mobilidade: roundMoney(
                Math.max(0, Number((p.benefitBalances as Record<string, number>).mobilidade) || 0)
              ),
            }
          : defaultBenefitBalances();
      const card: CreditCard = {
        id,
        kind,
        brand: p.brand,
        name: p.name.trim(),
        last4,
        currentInvoice: roundMoney(p.currentInvoice),
        creditLimit: roundMoney(p.creditLimit),
        closingDay: clampBillingDay(p.closingDay),
        dueDay: clampBillingDay(p.dueDay),
        benefitBalances,
      };
      return { ...state, creditCards: [...state.creditCards, card] };
    }
    case "UPDATE_CREDIT_CARD": {
      const { id, patch } = action;
      return {
        ...state,
        creditCards: state.creditCards.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c, ...patch };
          if (patch.name !== undefined) next.name = patch.name.trim();
          if (patch.last4 !== undefined) {
            const digits = patch.last4.replace(/\D/g, "");
            next.last4 = digits.length >= 4 ? digits.slice(-4) : digits.padStart(4, "0").slice(-4);
            if (next.last4.length !== 4) next.last4 = c.last4;
          }
          if (patch.currentInvoice !== undefined) next.currentInvoice = roundMoney(patch.currentInvoice);
          if (patch.creditLimit !== undefined) next.creditLimit = roundMoney(patch.creditLimit);
          if (patch.kind !== undefined) next.kind = patch.kind;
          if (patch.benefitBalances !== undefined) {
            const b = patch.benefitBalances;
            next.benefitBalances = {
              refeicao: roundMoney(Math.max(0, b.refeicao)),
              alimentacao: roundMoney(Math.max(0, b.alimentacao)),
              mobilidade: roundMoney(Math.max(0, b.mobilidade)),
            };
          }
          if (patch.closingDay !== undefined) next.closingDay = clampBillingDay(patch.closingDay);
          if (patch.dueDay !== undefined) next.dueDay = clampBillingDay(patch.dueDay);
          return next;
        }),
      };
    }
    case "SYNC_CREDIT_CARD_OPEN_INVOICE": {
      const { cardId, markExpenseHistoryBefore } = action;
      const cc = state.creditCards.find((c) => c.id === cardId);
      if (!cc || cc.kind !== "credito") return state;
      let transactions = state.transactions;
      if (
        typeof markExpenseHistoryBefore === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(markExpenseHistoryBefore.trim())
      ) {
        const cut = markExpenseHistoryBefore.trim();
        transactions = transactions.map((t) => {
          if (t.creditCardId !== cardId || t.amount >= 0) return t;
          if (t.date >= cut) return t;
          return { ...t, skipCardInvoiceDelta: true };
        });
      }
      const inv = openInvoiceTotalFromCardTransactions(cardId, transactions);
      const creditCards = state.creditCards.map((c) =>
        c.id === cardId ? { ...c, currentInvoice: inv } : c,
      );
      return { ...state, transactions, creditCards };
    }
    case "DELETE_CREDIT_CARD": {
      return {
        ...state,
        creditCards: state.creditCards.filter((c) => c.id !== action.id),
        creditCardStatements: state.creditCardStatements.filter((s) => s.creditCardId !== action.id),
        recurringExpenses: state.recurringExpenses.map((r) =>
          r.creditCardId === action.id ? { ...r, creditCardId: null } : r
        ),
        transactions: state.transactions.map((t) =>
          t.creditCardId === action.id
            ? { ...t, creditCardId: null, benefitBucket: null }
            : t
        ),
      };
    }
    case "RESET_CREDIT_CARD_ACTIVITY": {
      const { cardId } = action;
      const cc = state.creditCards.find((c) => c.id === cardId);
      if (!cc) return state;
      const removeList = state.transactions.filter((t) => t.creditCardId === cardId);
      let goals = state.goals;
      for (const tx of removeList) {
        if (tx.goalId && tx.amount < 0) {
          goals = goals.map((g) =>
            g.id === tx.goalId
              ? { ...g, current: Math.max(0, roundMoney(g.current - Math.abs(tx.amount))) }
              : g
          );
        }
      }
      const transactions = state.transactions.filter((t) => t.creditCardId !== cardId);
      const creditCardStatements = state.creditCardStatements.filter((s) => s.creditCardId !== cardId);
      const creditCards = state.creditCards.map((c) => {
        if (c.id !== cardId) return c;
        if (c.kind === "credito") return { ...c, currentInvoice: 0 };
        return { ...c, currentInvoice: 0, benefitBalances: defaultBenefitBalances() };
      });
      return { ...state, transactions, creditCardStatements, creditCards, goals };
    }
    case "ADD_CREDIT_CARD_STATEMENT": {
      const id = action.payload.id ?? newId();
      const st = action.payload.status === "paga" ? ("paga" as const) : ("aberta" as const);
      const paidAt =
        st === "paga"
          ? typeof action.payload.paidAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(action.payload.paidAt)
            ? action.payload.paidAt
            : new Date().toISOString().slice(0, 10)
          : null;
      const row: CreditCardStatement = {
        id,
        creditCardId: action.payload.creditCardId,
        referenceMonth: action.payload.referenceMonth,
        amount: roundMoney(Math.max(0, action.payload.amount)),
        status: st,
        paidAt,
        note: action.payload.note?.trim().slice(0, 500) ?? "",
        attachmentDataUrl: action.payload.attachmentDataUrl ?? null,
        attachmentName: action.payload.attachmentName ?? null,
        createdAt: action.payload.createdAt ?? new Date().toISOString(),
      };
      return { ...state, creditCardStatements: [row, ...state.creditCardStatements] };
    }
    case "UPDATE_CREDIT_CARD_STATEMENT": {
      return {
        ...state,
        creditCardStatements: state.creditCardStatements.map((s) => {
          if (s.id !== action.id) return s;
          const p = action.patch;
          const next = { ...s };
          if (p.referenceMonth !== undefined && /^\d{4}-\d{2}$/.test(p.referenceMonth)) {
            next.referenceMonth = p.referenceMonth;
          }
          if (p.amount !== undefined) next.amount = roundMoney(Math.max(0, p.amount));
          if (p.note !== undefined) next.note = p.note.trim().slice(0, 500);
          if (p.attachmentDataUrl !== undefined) {
            next.attachmentDataUrl = p.attachmentDataUrl;
            next.attachmentName = p.attachmentName ?? next.attachmentName;
          }
          if (p.status !== undefined) {
            next.status = p.status;
            if (p.status === "aberta") next.paidAt = null;
            if (p.status === "paga" && !next.paidAt) {
              next.paidAt = new Date().toISOString().slice(0, 10);
            }
          }
          if (p.paidAt !== undefined) next.paidAt = p.paidAt;
          return next;
        }),
      };
    }
    case "DELETE_CREDIT_CARD_STATEMENT": {
      return {
        ...state,
        creditCardStatements: state.creditCardStatements.filter((s) => s.id !== action.id),
      };
    }
    case "UPDATE_PROFILE": {
      const { patch } = action;
      const nextName =
        patch.displayName !== undefined ? patch.displayName.trim() : state.profile.displayName;
      const nextSalary =
        patch.monthlySalary !== undefined
          ? roundMoney(Math.max(0, patch.monthlySalary))
          : state.profile.monthlySalary;
      const nextPhoto =
        patch.photoDataUrl !== undefined ? patch.photoDataUrl : state.profile.photoDataUrl;
      const nextCustomCats =
        patch.customIncomeCategories !== undefined
          ? normalizeCustomIncomeCategoriesForProfile(patch.customIncomeCategories)
          : state.profile.customIncomeCategories;
      return {
        ...state,
        profile: {
          displayName: nextName || state.profile.displayName,
          monthlySalary: nextSalary,
          photoDataUrl: nextPhoto,
          customIncomeCategories: nextCustomCats,
        },
      };
    }
    case "ADD_RECEIVABLE": {
      const id = action.payload.id ?? newId();
      const amount = roundMoney(Math.max(0, action.payload.amount));
      const installmentCount =
        typeof action.payload.installmentCount === "number" &&
        Number.isFinite(action.payload.installmentCount) &&
        action.payload.installmentCount > 0
          ? Math.min(999, Math.floor(action.payload.installmentCount))
          : null;
      const icRaw = action.payload.incomeCategory?.trim();
      const row: Receivable = {
        id,
        debtorName: action.payload.debtorName.trim(),
        ...(icRaw ? { incomeCategory: icRaw.slice(0, 80) } : {}),
        amount,
        payments: [],
        installmentMode: Boolean(action.payload.installmentMode),
        installmentCount,
        dueDate: action.payload.dueDate,
        note: action.payload.note?.trim() ?? "",
        status: "aberto",
        paidAt: null,
        createdAt: new Date().toISOString(),
      };
      return { ...state, receivables: [row, ...state.receivables] };
    }
    case "DELETE_RECEIVABLE": {
      return { ...state, receivables: state.receivables.filter((r) => r.id !== action.id) };
    }
    case "RECEIVE_RECEIVABLE": {
      const rec = state.receivables.find((r) => r.id === action.id);
      if (!rec || rec.status !== "aberto") return state;
      const prev = receivedTotal(rec);
      const remaining = roundMoney(rec.amount - prev);
      if (remaining <= 0) return state;
      const paidAt = new Date().toISOString().slice(0, 10);
      const requested =
        action.amount !== undefined ? roundMoney(Math.max(0, action.amount)) : remaining;
      const pay = roundMoney(Math.min(requested, remaining));
      if (pay <= 0) return state;
      const newPayments = [...rec.payments, { date: paidAt, amount: pay }];
      const newReceived = roundMoney(prev + pay);
      const done = newReceived >= rec.amount;
      const nextRow: Receivable = {
        ...rec,
        payments: newPayments,
        status: done ? ("pago" as const) : ("aberto" as const),
        paidAt: done ? paidAt : null,
      };
      const receivables = state.receivables.map((r) => (r.id === action.id ? nextRow : r));
      if (!action.registerIncome) {
        return { ...state, receivables };
      }
      const txId = newId();
      const txCat =
        typeof rec.incomeCategory === "string" && rec.incomeCategory.trim()
          ? rec.incomeCategory.trim().slice(0, 80)
          : "Outros";
      const tx: Transaction = {
        id: txId,
        date: paidAt,
        description: done ? `Recebimento — ${rec.debtorName}` : `Recebimento parcial — ${rec.debtorName}`,
        category: txCat,
        amount: pay,
        status: "recebido",
        icon: "payments",
        accountId: state.defaultAccountId,
      };
      const accId = state.defaultAccountId;
      const accounts = state.accounts.map((a) =>
        a.id === accId ? { ...a, balance: roundMoney(a.balance + pay) } : a
      );
      return {
        ...state,
        receivables,
        transactions: [tx, ...state.transactions],
        accounts,
      };
    }
    case "ADD_LOYALTY_PROGRAM": {
      const id = action.payload.id ?? newId();
      const row: LoyaltyProgram = {
        id,
        name: action.payload.name.trim(),
        balance: roundMoney(Math.max(0, action.payload.balance)),
        status: action.payload.status,
        accent: action.payload.accent,
        icon: action.payload.icon,
      };
      return { ...state, loyaltyPrograms: [row, ...state.loyaltyPrograms] };
    }
    case "UPDATE_LOYALTY_PROGRAM": {
      return {
        ...state,
        loyaltyPrograms: state.loyaltyPrograms.map((p) => {
          if (p.id !== action.id) return p;
          const patch = action.patch;
          return {
            ...p,
            ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
            ...(patch.balance !== undefined
              ? { balance: roundMoney(Math.max(0, patch.balance)) }
              : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.accent !== undefined ? { accent: patch.accent } : {}),
            ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
          };
        }),
      };
    }
    case "DELETE_LOYALTY_PROGRAM": {
      return {
        ...state,
        loyaltyPrograms: state.loyaltyPrograms.filter((p) => p.id !== action.id),
      };
    }
    case "SET_POINTS_SETTINGS": {
      const { patch } = action;
      return {
        ...state,
        ...(patch.pointsExpiring30d !== undefined
          ? { pointsExpiring30d: roundMoney(Math.max(0, patch.pointsExpiring30d)) }
          : {}),
        ...(patch.pointsValuePerPoint !== undefined &&
        Number.isFinite(patch.pointsValuePerPoint) &&
        patch.pointsValuePerPoint >= 0
          ? { pointsValuePerPoint: patch.pointsValuePerPoint }
          : {}),
        ...(patch.pointsExpirationBuckets !== undefined
          ? { pointsExpirationBuckets: patch.pointsExpirationBuckets }
          : {}),
      };
    }
    default:
      return state;
  }
}

export function migrateFinanceState(parsed: Record<string, unknown>, base?: FinanceState): FinanceState {
  const b = base ?? createInitialFinanceState();
  if (!Array.isArray(parsed.transactions)) return b;
  return {
    version: 2,
    profile: migrateProfile(parsed, b.profile),
    defaultAccountId:
      typeof parsed.defaultAccountId === "string" ? parsed.defaultAccountId : b.defaultAccountId,
    transactions: Array.isArray(parsed.transactions)
      ? normalizeTransactions(parsed.transactions)
      : b.transactions,
    goals: Array.isArray(parsed.goals) ? (parsed.goals as Goal[]) : b.goals,
    accounts: Array.isArray(parsed.accounts) ? (parsed.accounts as Account[]) : b.accounts,
    recurringExpenses: Array.isArray(parsed.recurringExpenses)
      ? normalizeRecurringExpenses(parsed.recurringExpenses)
      : b.recurringExpenses,
    creditCards: Array.isArray(parsed.creditCards)
      ? normalizeCreditCards(parsed.creditCards)
      : b.creditCards,
    receivables: normalizeReceivables(
      Array.isArray(parsed.receivables) ? parsed.receivables : []
    ),
    loyaltyPrograms: normalizeLoyaltyPrograms(
      Array.isArray(parsed.loyaltyPrograms) ? parsed.loyaltyPrograms : []
    ),
    pointsExpiring30d:
      typeof parsed.pointsExpiring30d === "number" && Number.isFinite(parsed.pointsExpiring30d)
        ? roundMoney(Math.max(0, parsed.pointsExpiring30d))
        : b.pointsExpiring30d,
    pointsValuePerPoint:
      typeof parsed.pointsValuePerPoint === "number" &&
      Number.isFinite(parsed.pointsValuePerPoint) &&
      parsed.pointsValuePerPoint >= 0
        ? parsed.pointsValuePerPoint
        : b.pointsValuePerPoint,
    pointsExpirationBuckets: normalizeExpirationBuckets(
      Array.isArray(parsed.pointsExpirationBuckets) ? parsed.pointsExpirationBuckets : []
    ),
    creditCardStatements: normalizeCreditCardStatements(
      Array.isArray(parsed.creditCardStatements) ? parsed.creditCardStatements : []
    ),
  };
}

type FinanceContextValue = {
  state: FinanceState;
  addTransaction: (t: Omit<Transaction, "id"> & { id?: string }) => void;
  /** Atualiza campos que não alteram saldo (ex.: terceiro no cartão). */
  patchTransaction: (id: string, patch: { thirdPartyName?: string | null }) => void;
  /** Recalcula saldos/fatura/meta: remove o efeito do lançamento antigo e aplica o novo. */
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  deleteTransaction: (id: string) => void;
  addGoal: (g: Omit<Goal, "id" | "current"> & { current?: number }) => void;
  contributeGoal: (goalId: string, amount: number) => void;
  addRecurring: (r: Omit<RecurringExpense, "id"> & { id?: string }) => void;
  updateRecurring: (id: string, patch: Partial<RecurringExpense>) => void;
  deleteRecurring: (id: string) => void;
  toggleRecurringPaid: (id: string, monthKey: string) => void;
  /** Define o saldo da conta (ex.: igual ao extrato do banco). Lançamentos não são alterados. */
  setAccountBalance: (accountId: string, balance: number) => void;
  updateAccount: (id: string, patch: Partial<Pick<Account, "name" | "balance" | "icon">>) => void;
  addCreditCard: (c: Omit<CreditCard, "id"> & { id?: string }) => void;
  updateCreditCard: (id: string, patch: Partial<Omit<CreditCard, "id">>) => void;
  /**
   * Recalcula a fatura em aberto do cartão a partir dos lançamentos (respeitando `skipCardInvoiceDelta`).
   * Com `markExpenseHistoryBefore`, marcam-se despesas com data &lt; essa data como só histórico antes do recálculo.
   */
  syncCreditCardOpenInvoice: (cardId: string, opts?: { markExpenseHistoryBefore?: string }) => void;
  deleteCreditCard: (id: string) => void;
  /** Remove lançamentos e faturas arquivadas deste cartão; zera fatura aberta / bolsas de benefício. */
  resetCreditCardActivity: (cardId: string) => void;
  addCreditCardStatement: (
    s: Omit<CreditCardStatement, "id" | "createdAt"> & { id?: string; createdAt?: string }
  ) => void;
  updateCreditCardStatement: (id: string, patch: Partial<Omit<CreditCardStatement, "id">>) => void;
  deleteCreditCardStatement: (id: string) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  addReceivable: (
    r: Omit<Receivable, "id" | "status" | "paidAt" | "createdAt"> & { id?: string }
  ) => void;
  deleteReceivable: (id: string) => void;
  /** Registra recebimento (total ou parcial); opcionalmente credita receita na conta principal. */
  receiveReceivable: (id: string, options?: { registerIncome?: boolean; amount?: number }) => void;
  addLoyaltyProgram: (p: Omit<LoyaltyProgram, "id"> & { id?: string }) => void;
  updateLoyaltyProgram: (id: string, patch: Partial<Omit<LoyaltyProgram, "id">>) => void;
  deleteLoyaltyProgram: (id: string) => void;
  setPointsSettings: (patch: {
    pointsExpiring30d?: number;
    pointsValuePerPoint?: number;
    pointsExpirationBuckets?: PointsExpirationBucket[];
  }) => void;
  resetData: () => void;
  /** Baixa um JSON com todos os dados (para copiar em outro aparelho). */
  exportBackup: () => void;
  /** Substitui o estado atual por um backup JSON (retorna erro ou null se ok). */
  restoreBackup: (jsonText: string) => string | null;
  copyBackupToClipboard: () => Promise<boolean>;
  /** Saldo apenas da conta padrão (sem cartões de benefícios). */
  defaultAccountBalance: number;
  /** Soma das bolsas de todos os cartões de benefícios. */
  benefitLiquidity: number;
  /** Conta padrão + benefícios (visão agregada do “saldo principal”). */
  primaryBalance: number;
  /** Todas as contas + benefícios. */
  totalWealth: number;
  monthlyIncome: number;
  monthlyExpense: number;
  incomeExpenseRatio: number;
  greeting: string;
  /** Ícone da saudação (sol / nuvem / lua) alinhado ao horário. */
  greetingIcon: ReturnType<typeof greetingMaterialIconForNow>;
  portfolioCompletion: number;
  vestedTotal: number;
  targetTotal: number;
  nextMilestoneGoal: Goal | null;
  nextMilestoneGap: number;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { mode, firebaseProfile } = useAuth();
  const storageScope =
    mode === "firebase" && firebaseProfile?.uid ? firebaseProfile.uid : FINANCE_STORAGE_SCOPE_DEMO;

  const storageScopeRef = useRef(storageScope);
  storageScopeRef.current = storageScope;

  const cloudSeedAttemptedRef = useRef(false);
  const cloudPushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Evita push redundante quando o JSON já está na nuvem (eco do listener ou flush duplo). */
  const lastPushedFinanceJsonRef = useRef<string | null>(null);

  const [state, dispatch] = useReducer(financeReducer, storageScope, (scope) => loadStateForScope(scope));
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    lastPushedFinanceJsonRef.current = null;
  }, [storageScope]);

  /** Upload Firestore com TS otimista (evita snapshot da própria gravação disparar HYDRATE → segundo write). */
  function enqueueFinanceCloudPush(skipIfPayloadUnchanged: boolean) {
    const scope = storageScopeRef.current;
    if (scope === FINANCE_STORAGE_SCOPE_DEMO) return;
    const json = JSON.stringify(stateRef.current);
    if (skipIfPayloadUnchanged && json === lastPushedFinanceJsonRef.current) return;
    const prevTs = getLastRemoteFinanceTs(scope);
    const t = Date.now();
    setLastRemoteFinanceTs(scope, t);
    void (async () => {
      const ok = await pushFinanceEnvelopeToCloud(scope, t, json);
      if (!ok) {
        setLastRemoteFinanceTs(scope, prevTs);
        return;
      }
      lastPushedFinanceJsonRef.current = json;
      try {
        localStorage.setItem(financeStorageKeys(scope).updatedAt, String(t));
      } catch {
        /* ignore */
      }
    })();
  }

  useEffect(() => {
    dispatch({ type: "HYDRATE", payload: loadStateForScope(storageScope) });
  }, [storageScope]);

  /** Firebase: puxa Firestore na entrada e mantém listener; último `updatedAt` vence (LWW). */
  useEffect(() => {
    if (storageScope === FINANCE_STORAGE_SCOPE_DEMO) return;
    const uid = storageScope;
    cloudSeedAttemptedRef.current = false;
    let cancelled = false;

    const applyRemoteIfNewer = (updatedAt: number, raw: string) => {
      if (cancelled) return;
      if (updatedAt <= getLastRemoteFinanceTs(uid)) return;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }
      if (!Array.isArray(parsed.transactions)) return;
      const localLoyalty = stateRef.current.loyaltyPrograms;
      const nextBase = migrateFinanceState(parsed, createEmptyFinanceState());
      const next = {
        ...nextBase,
        loyaltyPrograms: mergeLoyaltyProgramsAfterRemotePull(nextBase.loyaltyPrograms, localLoyalty),
      };
      lastPushedFinanceJsonRef.current = JSON.stringify(next);
      setLastRemoteFinanceTs(uid, updatedAt);
      dispatch({ type: "HYDRATE", payload: next });
      try {
        const keys = financeStorageKeys(uid);
        localStorage.setItem(keys.state, JSON.stringify(next));
        localStorage.setItem(keys.updatedAt, String(updatedAt));
      } catch {
        /* ignore */
      }
    };

    const pullRemote = () => {
      void (async () => {
        const env = await fetchFinanceEnvelopeFromCloud(uid);
        if (cancelled || !env) return;
        if (env.updatedAt > getLastRemoteFinanceTs(uid)) {
          applyRemoteIfNewer(env.updatedAt, env.raw);
        }
      })();
    };

    pullRemote();

    /** Volta à aba / outro PC pode ter gravado depois do primeiro getDoc. */
    function onVisibilityPull() {
      if (document.visibilityState !== "visible" || cancelled) return;
      pullRemote();
    }
    document.addEventListener("visibilitychange", onVisibilityPull);

    /** Segundo pull após o debounce de upload no outro aparelho (~1s + margem). */
    const delayedResync = window.setTimeout(() => pullRemote(), 2500);

    const unsub = subscribeFinanceCloud(
      uid,
      (env) => {
        if (cancelled) return;
        if (env) {
          if (env.updatedAt > getLastRemoteFinanceTs(uid)) {
            applyRemoteIfNewer(env.updatedAt, env.raw);
          }
          return;
        }
        if (cloudSeedAttemptedRef.current) return;
        const s = stateRef.current;
        const hasData =
          s.transactions.length > 0 ||
          s.creditCards.length > 0 ||
          s.goals.length > 0 ||
          s.recurringExpenses.length > 0 ||
          s.creditCardStatements.length > 0 ||
          s.receivables.length > 0 ||
          s.loyaltyPrograms.length > 0;
        if (!hasData) return;
        cloudSeedAttemptedRef.current = true;
        const t = Date.now();
        const json = JSON.stringify(s);
        void (async () => {
          const ok = await pushFinanceEnvelopeToCloud(uid, t, json);
          if (ok && !cancelled) {
            setLastRemoteFinanceTs(uid, t);
            lastPushedFinanceJsonRef.current = json;
          }
        })();
      },
      (err) => {
        console.warn("paytrackr: listener Firestore (finanças). Publique regras em firestore.rules.", err);
      },
    );

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityPull);
      window.clearTimeout(delayedResync);
      unsub();
    };
  }, [storageScope]);

  useEffect(() => {
    const keys = financeStorageKeys(storageScope);
    try {
      const t = Date.now();
      localStorage.setItem(keys.state, JSON.stringify(state));
      localStorage.setItem(keys.updatedAt, String(t));
    } catch {
      /* quota exceeded or private mode */
    }
  }, [state, storageScope]);

  /** Em dev: LAN sync só no modo demo local (não mistura com conta Firebase). */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (storageScope !== FINANCE_STORAGE_SCOPE_DEMO) return;
    const demoKeys = financeStorageKeys(FINANCE_STORAGE_SCOPE_DEMO);
    const demoBase = createInitialFinanceState();
    let cancelled = false;
    (async () => {
      const localT = getLocalUpdatedAtForScope(FINANCE_STORAGE_SCOPE_DEMO);
      const server = await pullLanDevSync();
      if (cancelled) return;
      let toPush: FinanceState = stateRef.current;
      if (server && server.updatedAt > localT) {
        const next = migrateFinanceState(server.state as Record<string, unknown>, demoBase);
        dispatch({ type: "HYDRATE", payload: next });
        toPush = next;
        try {
          localStorage.setItem(demoKeys.state, JSON.stringify(next));
          localStorage.setItem(demoKeys.updatedAt, String(server.updatedAt));
        } catch {
          /* ignore */
        }
      }
      await pushLanDevSync({ updatedAt: Date.now(), state: toPush });
    })();
    return () => {
      cancelled = true;
    };
  }, [storageScope]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (storageScope !== FINANCE_STORAGE_SCOPE_DEMO) return;
    const demoKeys = financeStorageKeys(FINANCE_STORAGE_SCOPE_DEMO);
    const demoBase = createInitialFinanceState();
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const localT = getLocalUpdatedAtForScope(FINANCE_STORAGE_SCOPE_DEMO);
      const server = await pullLanDevSync();
      if (server && server.updatedAt > localT) {
        const next = migrateFinanceState(server.state as Record<string, unknown>, demoBase);
        dispatch({ type: "HYDRATE", payload: next });
        try {
          localStorage.setItem(demoKeys.state, JSON.stringify(next));
          localStorage.setItem(demoKeys.updatedAt, String(server.updatedAt));
        } catch {
          /* ignore */
        }
      }
    }, 4000);
    return () => clearInterval(id);
  }, [storageScope]);

  const pushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (storageScope !== FINANCE_STORAGE_SCOPE_DEMO) return;
    if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
    pushDebounceRef.current = setTimeout(() => {
      pushDebounceRef.current = null;
      void pushLanDevSync({ updatedAt: Date.now(), state: stateRef.current });
    }, 800);
    return () => {
      if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
    };
  }, [state, storageScope]);

  /** Firebase: envia estado ao Firestore (debounce) para outros aparelhos. */
  useEffect(() => {
    if (storageScope === FINANCE_STORAGE_SCOPE_DEMO) return;
    if (cloudPushDebounceRef.current) clearTimeout(cloudPushDebounceRef.current);
    cloudPushDebounceRef.current = setTimeout(() => {
      cloudPushDebounceRef.current = null;
      enqueueFinanceCloudPush(true);
    }, 1200);
    return () => {
      if (cloudPushDebounceRef.current) clearTimeout(cloudPushDebounceRef.current);
    };
  }, [state, storageScope]);

  /** Grava de novo ao trocar de aba/fechar (celular costuma “congelar” antes do efeito rodar). */
  useEffect(() => {
    function flush() {
      try {
        const t = Date.now();
        const scope = storageScopeRef.current;
        const keys = financeStorageKeys(scope);
        localStorage.setItem(keys.state, JSON.stringify(stateRef.current));
        localStorage.setItem(keys.updatedAt, String(t));
        if (scope !== FINANCE_STORAGE_SCOPE_DEMO) {
          enqueueFinanceCloudPush(true);
        }
      } catch {
        /* ignore */
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const addTransaction = useCallback((t: Omit<Transaction, "id"> & { id?: string }) => {
    dispatch({ type: "ADD_TRANSACTION", payload: t });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    dispatch({ type: "DELETE_TRANSACTION", id });
  }, []);

  const patchTransaction = useCallback(
    (id: string, patch: { thirdPartyName?: string | null }) => {
      dispatch({ type: "PATCH_TRANSACTION", id, patch });
    },
    []
  );

  const updateTransaction = useCallback((id: string, patch: Partial<Omit<Transaction, "id">>) => {
    dispatch({ type: "UPDATE_TRANSACTION", id, patch });
  }, []);

  const addGoal = useCallback((g: Omit<Goal, "id" | "current"> & { current?: number }) => {
    dispatch({ type: "ADD_GOAL", payload: g });
  }, []);

  const contributeGoal = useCallback((goalId: string, amount: number) => {
    dispatch({ type: "CONTRIBUTE_GOAL", goalId, amount });
  }, []);

  const addRecurring = useCallback((r: Omit<RecurringExpense, "id"> & { id?: string }) => {
    dispatch({ type: "ADD_RECURRING", payload: r });
  }, []);

  const updateRecurring = useCallback((id: string, patch: Partial<RecurringExpense>) => {
    dispatch({ type: "UPDATE_RECURRING", id, patch });
  }, []);

  const deleteRecurring = useCallback((id: string) => {
    dispatch({ type: "DELETE_RECURRING", id });
  }, []);

  const toggleRecurringPaid = useCallback((id: string, monthKey: string) => {
    dispatch({ type: "TOGGLE_RECURRING_PAID", id, monthKey });
  }, []);

  const setAccountBalance = useCallback((accountId: string, balance: number) => {
    dispatch({ type: "SET_ACCOUNT_BALANCE", accountId, balance });
  }, []);

  const updateAccount = useCallback((id: string, patch: Partial<Pick<Account, "name" | "balance" | "icon">>) => {
    dispatch({ type: "UPDATE_ACCOUNT", id, patch });
  }, []);

  const addCreditCard = useCallback((c: Omit<CreditCard, "id"> & { id?: string }) => {
    dispatch({ type: "ADD_CREDIT_CARD", payload: c });
  }, []);

  const updateCreditCard = useCallback((id: string, patch: Partial<Omit<CreditCard, "id">>) => {
    dispatch({ type: "UPDATE_CREDIT_CARD", id, patch });
  }, []);

  const syncCreditCardOpenInvoice = useCallback(
    (cardId: string, opts?: { markExpenseHistoryBefore?: string }) => {
      dispatch({
        type: "SYNC_CREDIT_CARD_OPEN_INVOICE",
        cardId,
        ...(opts?.markExpenseHistoryBefore
          ? { markExpenseHistoryBefore: opts.markExpenseHistoryBefore }
          : {}),
      });
    },
    [],
  );

  const deleteCreditCard = useCallback((id: string) => {
    dispatch({ type: "DELETE_CREDIT_CARD", id });
  }, []);

  const resetCreditCardActivity = useCallback((cardId: string) => {
    dispatch({ type: "RESET_CREDIT_CARD_ACTIVITY", cardId });
  }, []);

  const addCreditCardStatement = useCallback(
    (s: Omit<CreditCardStatement, "id" | "createdAt"> & { id?: string; createdAt?: string }) => {
      dispatch({ type: "ADD_CREDIT_CARD_STATEMENT", payload: s });
    },
    []
  );

  const updateCreditCardStatement = useCallback(
    (id: string, patch: Partial<Omit<CreditCardStatement, "id">>) => {
      dispatch({ type: "UPDATE_CREDIT_CARD_STATEMENT", id, patch });
    },
    []
  );

  const deleteCreditCardStatement = useCallback((id: string) => {
    dispatch({ type: "DELETE_CREDIT_CARD_STATEMENT", id });
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    dispatch({ type: "UPDATE_PROFILE", patch });
  }, []);

  const resetData = useCallback(() => {
    const scope = storageScopeRef.current;
    const payload =
      scope === FINANCE_STORAGE_SCOPE_DEMO ? createInitialFinanceState() : createEmptyFinanceState();
    dispatch({ type: "HYDRATE", payload });
  }, []);

  const addReceivable = useCallback(
    (r: Omit<Receivable, "id" | "status" | "paidAt" | "createdAt"> & { id?: string }) => {
      dispatch({ type: "ADD_RECEIVABLE", payload: r });
    },
    []
  );

  const deleteReceivable = useCallback((id: string) => {
    dispatch({ type: "DELETE_RECEIVABLE", id });
  }, []);

  const receiveReceivable = useCallback(
    (id: string, options?: { registerIncome?: boolean; amount?: number }) => {
      dispatch({
        type: "RECEIVE_RECEIVABLE",
        id,
        registerIncome: options?.registerIncome !== false,
        amount: options?.amount,
      });
    },
    []
  );

  const addLoyaltyProgram = useCallback((p: Omit<LoyaltyProgram, "id"> & { id?: string }) => {
    dispatch({ type: "ADD_LOYALTY_PROGRAM", payload: p });
  }, []);

  const updateLoyaltyProgram = useCallback((id: string, patch: Partial<Omit<LoyaltyProgram, "id">>) => {
    dispatch({ type: "UPDATE_LOYALTY_PROGRAM", id, patch });
  }, []);

  const deleteLoyaltyProgram = useCallback((id: string) => {
    dispatch({ type: "DELETE_LOYALTY_PROGRAM", id });
  }, []);

  const setPointsSettings = useCallback(
    (patch: {
      pointsExpiring30d?: number;
      pointsValuePerPoint?: number;
      pointsExpirationBuckets?: PointsExpirationBucket[];
    }) => {
      dispatch({ type: "SET_POINTS_SETTINGS", patch });
    },
    []
  );

  const exportBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paytrackr-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const restoreBackup = useCallback((jsonText: string): string | null => {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      if (!Array.isArray(parsed.transactions)) {
        return "Arquivo inválido: não parece um backup do PayTrackr.";
      }
      const base =
        storageScopeRef.current === FINANCE_STORAGE_SCOPE_DEMO
          ? createInitialFinanceState()
          : createEmptyFinanceState();
      const next = migrateFinanceState(parsed, base);
      dispatch({ type: "HYDRATE", payload: next });
      try {
        const keys = financeStorageKeys(storageScopeRef.current);
        localStorage.setItem(keys.state, JSON.stringify(next));
        localStorage.setItem(keys.updatedAt, String(Date.now()));
      } catch {
        /* ignore */
      }
      return null;
    } catch {
      return "Não foi possível ler o JSON.";
    }
  }, []);

  const copyBackupToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
      return true;
    } catch {
      return false;
    }
  }, [state]);

  const value = useMemo(() => {
    const checking = state.accounts.find((a) => a.id === state.defaultAccountId);
    const defaultAccountBalance = checking?.balance ?? 0;
    const benefitLiquidity = totalBenefitLiquidity(state.creditCards);
    const accountsTotal = roundMoney(state.accounts.reduce((s, a) => s + a.balance, 0));
    const primaryBalance = roundMoney(defaultAccountBalance + benefitLiquidity);
    const totalWealth = roundMoney(accountsTotal + benefitLiquidity);

    let monthlyIncome = 0;
    let monthlyExpense = 0;
    for (const t of state.transactions) {
      if (!isInCurrentMonth(t.date)) continue;
      if (t.amount > 0) monthlyIncome += t.amount;
      else monthlyExpense += Math.abs(t.amount);
    }
    monthlyIncome = roundMoney(monthlyIncome);
    monthlyExpense = roundMoney(monthlyExpense);

    const denom = monthlyIncome + monthlyExpense;
    const incomeExpenseRatio = denom > 0 ? Math.min(100, roundMoney((monthlyIncome / denom) * 100)) : 0;

    const targetTotal = roundMoney(state.goals.reduce((s, g) => s + g.target, 0));
    const vestedTotal = roundMoney(state.goals.reduce((s, g) => s + g.current, 0));
    const portfolioCompletion =
      targetTotal > 0 ? Math.min(100, roundMoney((vestedTotal / targetTotal) * 100)) : 0;

    let nextMilestoneGoal: Goal | null = null;
    let nextMilestoneGap = Infinity;
    for (const g of state.goals) {
      const gap = g.target - g.current;
      if (gap > 0 && gap < nextMilestoneGap) {
        nextMilestoneGap = gap;
        nextMilestoneGoal = g;
      }
    }
    if (nextMilestoneGap === Infinity) {
      nextMilestoneGap = 0;
    }

    const now = new Date();
    return {
      state,
      addTransaction,
      patchTransaction,
      updateTransaction,
      deleteTransaction,
      addGoal,
      contributeGoal,
      addRecurring,
      updateRecurring,
      deleteRecurring,
      toggleRecurringPaid,
      setAccountBalance,
      updateAccount,
      addCreditCard,
      updateCreditCard,
      syncCreditCardOpenInvoice,
      deleteCreditCard,
      resetCreditCardActivity,
      addCreditCardStatement,
      updateCreditCardStatement,
      deleteCreditCardStatement,
      updateProfile,
      addReceivable,
      deleteReceivable,
      receiveReceivable,
      addLoyaltyProgram,
      updateLoyaltyProgram,
      deleteLoyaltyProgram,
      setPointsSettings,
      resetData,
      exportBackup,
      restoreBackup,
      copyBackupToClipboard,
      defaultAccountBalance,
      benefitLiquidity,
      primaryBalance,
      totalWealth,
      monthlyIncome,
      monthlyExpense,
      incomeExpenseRatio,
      greeting: greetingForNow(now),
      greetingIcon: greetingMaterialIconForNow(now),
      portfolioCompletion,
      vestedTotal,
      targetTotal,
      nextMilestoneGoal,
      nextMilestoneGap,
    };
  }, [
    state,
    addTransaction,
    patchTransaction,
    updateTransaction,
    deleteTransaction,
    addGoal,
    contributeGoal,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    toggleRecurringPaid,
    setAccountBalance,
    updateAccount,
    addCreditCard,
    updateCreditCard,
    syncCreditCardOpenInvoice,
    deleteCreditCard,
    resetCreditCardActivity,
    addCreditCardStatement,
    updateCreditCardStatement,
    deleteCreditCardStatement,
    updateProfile,
    addReceivable,
    deleteReceivable,
    receiveReceivable,
    addLoyaltyProgram,
    updateLoyaltyProgram,
    deleteLoyaltyProgram,
    setPointsSettings,
    resetData,
    exportBackup,
    restoreBackup,
    copyBackupToClipboard,
  ]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}

export { formatBRL };
