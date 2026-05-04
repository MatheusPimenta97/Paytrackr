import { newId } from "../domain/id";
import type { CreditCard, FinanceState, RecurringExpense, Transaction, UserProfile } from "../domain/types";

export function defaultProfile(): UserProfile {
  return { displayName: "", monthlySalary: 0, photoDataUrl: null, customIncomeCategories: [] };
}

/** Estado inicial para conta Firebase nova — sem lançamentos/cartões de exemplo. */
export function createEmptyFinanceState(): FinanceState {
  const defaultAccountId = newId();
  return {
    version: 2,
    profile: defaultProfile(),
    defaultAccountId,
    transactions: [],
    goals: [],
    accounts: [
      {
        id: defaultAccountId,
        name: "Conta principal",
        balance: 0,
        icon: "account_balance",
      },
    ],
    recurringExpenses: [],
    creditCards: [],
    creditCardStatements: [],
    receivables: [],
    loyaltyPrograms: [],
    pointsExpiring30d: 0,
    pointsValuePerPoint: 0.02,
    pointsExpirationBuckets: [],
  };
}

function t(p: Omit<Transaction, "id"> & { id?: string }): Transaction {
  return { ...p, id: p.id ?? newId() };
}

export function defaultRecurringExpenses(): RecurringExpense[] {
  return [
    {
      id: "r-aluguel",
      name: "Aluguel Residencial",
      subtitle: "Imobiliária São José",
      category: "Moradia",
      amount: 2800,
      dueDay: 10,
      cadence: "mensal",
      icon: "home",
      paidMonths: [],
      creditCardId: null,
    },
    {
      id: "r-netflix",
      name: "Netflix",
      subtitle: "Plano Premium 4K",
      category: "Entretenimento",
      amount: 55.9,
      dueDay: 15,
      cadence: "mensal",
      icon: "movie",
      paidMonths: ["2026-04"],
      creditCardId: null,
    },
    {
      id: "r-internet",
      name: "Internet Fibra",
      subtitle: "Vivo 600 Mega",
      category: "Serviços",
      amount: 120,
      dueDay: 5,
      cadence: "mensal",
      icon: "wifi",
      paidMonths: ["2026-04"],
      creditCardId: null,
    },
    {
      id: "r-prime",
      name: "Amazon Prime",
      subtitle: "Assinatura Anual",
      category: "Compras",
      amount: 14.9,
      dueDay: 22,
      cadence: "mensal",
      icon: "shopping_bag",
      paidMonths: [],
      creditCardId: null,
    },
  ];
}

/** Cartões de exemplo (Gestão de Cartões); podem ser removidos pelo usuário. */
export function defaultCreditCards(): CreditCard[] {
  return [
    {
      id: "c-seed-visa",
      kind: "credito",
      brand: "visa",
      name: "Infinite Black",
      last4: "8821",
      currentInvoice: 8240.5,
      closingDay: 7,
      dueDay: 8,
      creditLimit: 25000,
      benefitBalances: { refeicao: 0, alimentacao: 0, mobilidade: 0 },
    },
    {
      id: "c-seed-master",
      kind: "credito",
      brand: "master",
      name: "Corporate Gold",
      last4: "4410",
      currentInvoice: 1120,
      closingDay: 18,
      dueDay: 25,
      creditLimit: 5000,
      benefitBalances: { refeicao: 0, alimentacao: 0, mobilidade: 0 },
    },
  ];
}

/** Seed aligned with UI mocks; dates relative to “today” in app usage */
export function createInitialFinanceState(): FinanceState {
  const defaultAccountId = "a-checking";
  const transactions: Transaction[] = [
    t({
      id: "seed-1",
      date: "2026-04-01",
      description: "Apple Store - MacBook Pro",
      category: "Eletrônicos",
      amount: -14500,
      status: "confirmado",
      icon: "shopping_bag",
      accountId: defaultAccountId,
    }),
    t({
      id: "seed-2",
      date: "2026-03-28",
      description: "Pagamento Dividendos - PETR4",
      category: "Investimentos",
      amount: 2140.5,
      status: "recebido",
      icon: "payments",
      accountId: defaultAccountId,
    }),
    t({
      id: "seed-3",
      date: "2026-03-26",
      description: "Restaurante Fasano",
      category: "Lazer",
      amount: -850,
      status: "confirmado",
      icon: "restaurant",
      accountId: defaultAccountId,
    }),
    t({
      id: "seed-4",
      date: "2026-03-22",
      description: "Latam Airlines - GIG/JFK",
      category: "Viagem",
      amount: -4200,
      status: "pendente",
      icon: "flight",
      accountId: defaultAccountId,
    }),
    t({
      id: "seed-5",
      date: "2026-03-15",
      description: "Aporte Fundo de Emergência",
      category: "Investimentos",
      amount: -1500,
      status: "confirmado",
      icon: "savings",
      accountId: defaultAccountId,
      goalId: "g-emergency",
    }),
    t({
      id: "seed-6",
      date: "2026-03-10",
      description: "Aporte Aposentadoria",
      category: "Investimentos",
      amount: -4200,
      status: "confirmado",
      icon: "potted_plant",
      accountId: defaultAccountId,
      goalId: "g-wealth",
    }),
    t({
      id: "seed-7",
      date: "2026-03-05",
      description: "Reserva Imóvel Litoral",
      category: "Investimentos",
      amount: -2000,
      status: "confirmado",
      icon: "apartment",
      accountId: defaultAccountId,
      goalId: "g-coastal",
    }),
    t({
      id: "seed-8",
      date: "2026-03-01",
      description: "Supermercado",
      category: "Alimentação",
      amount: -320.4,
      status: "confirmado",
      icon: "shopping_cart",
      accountId: defaultAccountId,
    }),
  ];

  return {
    version: 2,
    recurringExpenses: defaultRecurringExpenses(),
    creditCards: defaultCreditCards(),
    profile: { displayName: "Marcus", monthlySalary: 0, photoDataUrl: null, customIncomeCategories: [] },
    defaultAccountId,
    receivables: [],
    creditCardStatements: [],
    loyaltyPrograms: [],
    pointsExpiring30d: 0,
    pointsValuePerPoint: 0.02,
    pointsExpirationBuckets: [],
    transactions,
    goals: [
      {
        id: "g-emergency",
        title: "Emergency Fund",
        subtitle: "6 Months Expenses Safety Net",
        icon: "shield",
        target: 50000,
        current: 48800,
        kind: "on_track",
        trendLabel: "+2.4% este mês",
      },
      {
        id: "g-wealth",
        title: "Wealth Accumulation",
        subtitle: "Target Retirement Age: 55",
        icon: "potted_plant",
        target: 1_100_000,
        current: 820_150,
        kind: "long_term",
        trendLabel: "218 meses restantes",
      },
      {
        id: "g-coastal",
        title: "Coastal Property",
        subtitle: "Down Payment Fund",
        icon: "apartment",
        target: 150_000,
        current: 59_500,
        kind: "attention",
        trendLabel: "Abaixo do planejado",
      },
    ],
    accounts: [
      { id: "a-checking", name: "Conta Corrente", balance: 42850, icon: "account_balance" },
      { id: "a-emergency", name: "Reserva de Emergência", balance: 85000, icon: "savings" },
      { id: "a-invest", name: "Investimentos", balance: 14730, icon: "show_chart" },
    ],
  };
}
