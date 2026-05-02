import type { BenefitBucket, CreditCard } from "./types";
import { roundMoney } from "./money";

export const BENEFIT_BUCKETS: BenefitBucket[] = ["refeicao", "alimentacao", "mobilidade"];

export const BENEFIT_BUCKET_LABEL: Record<BenefitBucket, string> = {
  refeicao: "Refeição",
  alimentacao: "Alimentação",
  mobilidade: "Mobilidade",
};

export function defaultBenefitBalances(): Record<BenefitBucket, number> {
  return { refeicao: 0, alimentacao: 0, mobilidade: 0 };
}

export function adjustBenefitBalance(
  cards: CreditCard[],
  cardId: string,
  bucket: BenefitBucket,
  delta: number
): CreditCard[] {
  return cards.map((c) => {
    if (c.id !== cardId) return c;
    const b = { ...c.benefitBalances };
    b[bucket] = roundMoney(Math.max(0, b[bucket] + delta));
    return { ...c, benefitBalances: b };
  });
}

export function isBenefitBucket(v: unknown): v is BenefitBucket {
  return v === "refeicao" || v === "alimentacao" || v === "mobilidade";
}

/** Total em todas as bolsas de todos os cartões de benefícios. */
export function totalBenefitLiquidity(cards: CreditCard[]): number {
  let s = 0;
  for (const c of cards) {
    if (c.kind !== "beneficios") continue;
    s += c.benefitBalances.refeicao + c.benefitBalances.alimentacao + c.benefitBalances.mobilidade;
  }
  return roundMoney(s);
}
