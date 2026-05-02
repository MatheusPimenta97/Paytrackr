import { newId } from "./id";
import { roundMoney } from "./money";
import type { LoyaltyProgram, LoyaltyProgramAccent, PointsExpirationBucket } from "./types";

export const LOYALTY_PRESET: Record<
  LoyaltyProgramAccent,
  { bg: string; text: string; defaultIcon: string; logoUrl?: string }
> = {
  livelo: {
    bg: "bg-white ring-1 ring-[#ff0066]/20",
    text: "text-[#ff0066]",
    defaultIcon: "circle",
    logoUrl:
      "https://www.mercadoeeventos.com.br/wp-content/uploads/2023/08/livelo-1-1024x680.png",
  },
  esfera: { bg: "bg-error/10", text: "text-error", defaultIcon: "public" },
  smiles: { bg: "bg-[#ff6600]/10", text: "text-[#ff6600]", defaultIcon: "flight" },
  latam: { bg: "bg-primary/10", text: "text-primary", defaultIcon: "connecting_airports" },
  azul: { bg: "bg-[#003087]/10", text: "text-[#003087]", defaultIcon: "flight_takeoff" },
  itau: {
    bg: "bg-white ring-1 ring-[#ec7000]/25",
    text: "text-[#ec7000]",
    defaultIcon: "credit_card",
    logoUrl:
      "https://designconceitual.com.br/wp-content/uploads/2023/12/Ita%C3%BA-novo-logotipo-2023-1000x600.jpg",
  },
  custom: { bg: "bg-surface-container-high", text: "text-primary", defaultIcon: "loyalty" },
};

export function defaultIconForAccent(accent: LoyaltyProgramAccent): string {
  return LOYALTY_PRESET[accent].defaultIcon;
}

export function normalizeLoyaltyPrograms(raw: unknown): LoyaltyProgram[] {
  if (!Array.isArray(raw)) return [];
  const accents: LoyaltyProgramAccent[] = [
    "livelo",
    "esfera",
    "smiles",
    "latam",
    "azul",
    "itau",
    "custom",
  ];
  const out: LoyaltyProgram[] = [];
  for (const x of raw) {
    const r = x as Partial<LoyaltyProgram>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name) continue;
    const balance =
      typeof r.balance === "number" && Number.isFinite(r.balance) ? roundMoney(Math.max(0, r.balance)) : 0;
    const accent = accents.includes(r.accent as LoyaltyProgramAccent)
      ? (r.accent as LoyaltyProgramAccent)
      : "custom";
    const status = r.status === "sincronizando" ? "sincronizando" : "ativo";
    const icon =
      typeof r.icon === "string" && r.icon.length > 0 ? r.icon : defaultIconForAccent(accent);
    const id = typeof r.id === "string" && r.id.length > 0 ? r.id : newId();
    out.push({ id, name, balance, status, accent, icon });
  }
  return out;
}

export function normalizeExpirationBuckets(raw: unknown): PointsExpirationBucket[] {
  if (!Array.isArray(raw)) return [];
  const out: PointsExpirationBucket[] = [];
  for (const x of raw) {
    const b = x as Partial<PointsExpirationBucket>;
    const label = typeof b.label === "string" ? b.label.trim() : "";
    if (!label) continue;
    const points =
      typeof b.points === "number" && Number.isFinite(b.points) ? roundMoney(Math.max(0, b.points)) : 0;
    let barWidthPct =
      typeof b.barWidthPct === "number" && Number.isFinite(b.barWidthPct)
        ? Math.min(100, Math.max(0, b.barWidthPct))
        : 50;
    const id = typeof b.id === "string" && b.id.length > 0 ? b.id : newId();
    out.push({
      id,
      label,
      points,
      barWidthPct,
      critical: Boolean(b.critical),
    });
  }
  return out;
}
