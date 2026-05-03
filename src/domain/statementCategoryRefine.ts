/**
 * Refino de categoria pós-IA (cliente). Duplicado em `api/statement.ts` inline — a Vercel
 * não empacota `src/` nem arquivos irmãos em `api/` com a rota; mantenha as regras iguais.
 */
import { CATEGORY_OPTIONS } from "./categories";

export function normalizeStatementCategory(raw: string, allowed: readonly string[]): string {
  const t = raw.trim();
  if (allowed.includes(t)) return t;
  const f = allowed.find((a) => a.toLowerCase() === t.toLowerCase());
  return f ?? "Outros";
}

function foldAscii(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function refineStatementTransactionCategory(
  description: string,
  category: string,
  allowed: readonly string[] = CATEGORY_OPTIONS,
): string {
  let cat = normalizeStatementCategory(category, allowed);
  if (cat !== "Outros") return cat;
  const d = foldAscii(description);
  if (/\b(pagamento\s+via\s+conta)\b/.test(d)) {
    return cat;
  }
  if (
    /\b(iof|encargo|refinanc|juros\s*de\s*mora|multa|repasse\s*de\s*iof|tarifa|anuidade|seguro\s+cart|rotativo)\b/.test(
      d,
    )
  ) {
    return normalizeStatementCategory("Juros e encargos", allowed);
  }
  const rules: Array<[RegExp, string]> = [
    [
      /carrefour|atacad|pao\s*de\s*acucar|extra\b|supermercado|ifood|rappi|ze\s*delivery|mcdonald|subway|padaria|restaurante|assai|sendas|bakery|lanchonete/,
      "Alimentação",
    ],
    [
      /youtube|netflix|spotify|disney|prime\s*video|streaming|totalpass|totpass|smartfit|academia|ingresso|steam|playstation|xbox|deezer|twitch/,
      "Lazer",
    ],
    [/cursor|github|openai|google\s*cloud|aws|azure|digitalocean|hostinger|notion|slack|figma|adobe|jetbrains/, "Eletrônicos"],
    [/uber|99pop|99\s*taxi|cabify|bolt|shell|ipiranga|petrobras|posto|combust|metro|onibus|bilhete/, "Transporte"],
    [/latam|voegol|gol\s*linhas|azul\s*linhas|booking|airbnb|hotels|decolar|123milhas/, "Viagem"],
    [/drogaria|farmacia|drogasil|pacheco|hospital|clinica|dentista|odont|saude|hemolab/, "Saúde"],
    [
      /zara|renner|cea\b|c&a|hering|riachuelo|dafiti|netshoes|nike\s*store|adidas|calvin|levis|magazine\s*luiza\s*moda|lojas?\s*americanas|vestuario|roupa|calcado|sapataria/,
      "Vestuário",
    ],
    [/enel|cpfl|light|energia|esgoto|condominio|aluguel|iptu|virtua|oi\s*fibra/, "Moradia"],
    [/rico\b|xp\s|clear\s*corretora|btg|nuinvest|investimento|cei\s*b3/, "Investimentos"],
  ];
  for (const [re, guess] of rules) {
    if (re.test(d)) return normalizeStatementCategory(guess, allowed);
  }
  return cat;
}
