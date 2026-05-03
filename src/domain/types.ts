export type TxnStatus = "confirmado" | "pendente" | "recebido";

export type TxnPaymentMethod = "conta" | "pix" | "boleto";

export function isTxnPaymentMethod(v: unknown): v is TxnPaymentMethod {
  return v === "conta" || v === "pix" || v === "boleto";
}

export type CreditCardKind = "credito" | "beneficios";

/** Bolsa do cartão pré-pago (benefícios) */
export type BenefitBucket = "refeicao" | "alimentacao" | "mobilidade";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  status: TxnStatus;
  icon: string;
  accountId: string;
  goalId?: string;
  /** Lançamento no cartão: não altera saldo da conta; crédito = fatura, benefícios = bolsa */
  creditCardId?: string | null;
  /** Obrigatório se creditCardId for cartão de benefícios */
  benefitBucket?: BenefitBucket | null;
  /** Despesa pela conta (sem cartão): forma de pagamento */
  paymentMethod?: TxnPaymentMethod | null;
  /** Comprovante (PDF/imagem), opcional — PIX ou boleto */
  paymentAttachmentDataUrl?: string | null;
  paymentAttachmentName?: string | null;
  /** Quem usou o cartão (emprestado / outra pessoa), opcional */
  thirdPartyName?: string | null;
  /**
   * Se true: o lançamento fica vinculado ao cartão (histórico) mas **não** soma em
   * `currentInvoice` (ex.: linhas de fatura passada importadas pela IA).
   */
  skipCardInvoiceDelta?: boolean;
  /**
   * Mês YYYY-MM da fatura informado ao importar por IA — usado no gráfico "Histórico de faturas"
   * e no detalhe do mês, para não espalhar linhas do ciclo em vários meses quando o usuário
   * escolheu explicitamente o mês de referência daquela fatura.
   */
  statementReferenceMonth?: string | null;
};

export type GoalKind = "on_track" | "long_term" | "attention";

export type Goal = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  target: number;
  current: number;
  kind: GoalKind;
  trendLabel: string;
};

export type Account = {
  id: string;
  name: string;
  balance: number;
  icon: "account_balance" | "savings" | "show_chart";
};

export type CreditCardBrand = "visa" | "master" | "elo" | "amex" | "outro";

export type CreditCard = {
  id: string;
  brand: CreditCardBrand;
  kind: CreditCardKind;
  /** Nome exibido, ex.: Infinite Black */
  name: string;
  last4: string;
  /** Cartão de crédito: fatura em aberto. Benefícios: manter 0. */
  currentInvoice: number;
  /** Dia do mês em que a fatura costuma fechar (1–31). Benefícios: usar 1. */
  closingDay: number;
  /** Dia do mês do vencimento da fatura (1–31). Benefícios: usar 1. */
  dueDay: number;
  /** Cartão de crédito: limite. Benefícios: pode ser 0. */
  creditLimit: number;
  /** Saldos por bolsa (só para kind === "beneficios") */
  benefitBalances: Record<BenefitBucket, number>;
};

/** Registro manual de fatura / fechamento por cartão */
export type CreditCardStatementStatus = "aberta" | "paga";

export type CreditCardStatement = {
  id: string;
  creditCardId: string;
  /** Mês de referência YYYY-MM */
  referenceMonth: string;
  amount: number;
  status: CreditCardStatementStatus;
  /** Data do pagamento quando status === paga */
  paidAt: string | null;
  note: string;
  attachmentDataUrl: string | null;
  attachmentName: string | null;
  createdAt: string;
};

export type RecurringCadence = "mensal" | "anual";

/** Dados pessoais editáveis em Meu perfil */
export type UserProfile = {
  /** Nome ou apelido usado nas saudações */
  displayName: string;
  /** Salário mensal declarado (0 = não informado) */
  monthlySalary: number;
  /** Foto em data URL (JPEG comprimido) ou null */
  photoDataUrl: string | null;
};

/** paidForMonth: "YYYY-MM" quando quitado no mês */
export type RecurringExpense = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  amount: number;
  dueDay: number;
  cadence: RecurringCadence;
  icon: string;
  paidForMonth: string | null;
  /** Se definido, ao marcar pago no mês o valor entra em currentInvoice do cartão */
  creditCardId: string | null;
};

/** Valores que outras pessoas devem a você */
export type ReceivableStatus = "aberto" | "pago";

/** Cada entrada (parcial ou quitação) registrada na cobrança */
export type ReceivablePayment = {
  date: string;
  amount: number;
};

export type Receivable = {
  id: string;
  debtorName: string;
  /** Valor total combinado (ex.: compra no cartão parcelado) */
  amount: number;
  /** Entradas já registradas (parcelas / valores parciais) */
  payments: ReceivablePayment[];
  /** Devedor está quitando em parcelas no cartão (só referência na UI) */
  installmentMode: boolean;
  /** Nº de parcelas previstas, se souber (opcional) */
  installmentCount: number | null;
  /** Vencimento (YYYY-MM-DD) */
  dueDate: string;
  note: string;
  status: ReceivableStatus;
  /** Data da quitação total (YYYY-MM-DD); null se ainda em aberto ou só parciais */
  paidAt: string | null;
  createdAt: string;
};

export type LoyaltyProgramAccent =
  | "livelo"
  | "esfera"
  | "smiles"
  | "latam"
  | "azul"
  | "itau"
  | "custom";

/** Programa de pontos / milhas (controle manual) */
export type LoyaltyProgram = {
  id: string;
  name: string;
  balance: number;
  status: "ativo" | "sincronizando";
  accent: LoyaltyProgramAccent;
  /** Ícone Material Symbols (ex.: flight) */
  icon: string;
};

export type PointsExpirationBucket = {
  id: string;
  label: string;
  points: number;
  /** 0–100 largura visual da barra */
  barWidthPct: number;
  critical?: boolean;
};

export type FinanceState = {
  version: 2;
  profile: UserProfile;
  defaultAccountId: string;
  transactions: Transaction[];
  goals: Goal[];
  accounts: Account[];
  recurringExpenses: RecurringExpense[];
  creditCards: CreditCard[];
  /** Histórico de faturas registradas manualmente por cartão */
  creditCardStatements: CreditCardStatement[];
  /** Cobranças / valores a receber */
  receivables: Receivable[];
  /** Programas de fidelidade */
  loyaltyPrograms: LoyaltyProgram[];
  /** Pontos a vencer em ~30 dias (resumo manual) */
  pointsExpiring30d: number;
  /** Estimativa em R$ = totalPontos × este valor (ex.: 0,02) */
  pointsValuePerPoint: number;
  /** Linha do tempo de vencimento (opcional) */
  pointsExpirationBuckets: PointsExpirationBucket[];
};
