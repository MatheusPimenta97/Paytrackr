/** Categorias sugeridas para contas a receber / nova receita (salário, aluguel, dividendos…). */
export const DEFAULT_INCOME_CATEGORIES = [
  "Salário",
  "Aluguel",
  "Lucros",
  "Pró-labore",
  "Receitas de Investimentos/Juros",
  "Receitas de Investimentos/Rendimento",
  "Outras Receitas",
] as const;

const MAX_CUSTOM = 48;
const MAX_LABEL_LEN = 60;

export function normalizeCustomIncomeCategoriesForProfile(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, MAX_LABEL_LEN);
    if (!t) continue;
    const fold = t.toLocaleLowerCase("pt-BR");
    if (seen.has(fold)) continue;
    seen.add(fold);
    out.push(t);
    if (out.length >= MAX_CUSTOM) break;
  }
  return out;
}

/** Lista para `<select>`: padrões na ordem fixa + categorias extras do usuário (sem repetir as padrão). */
export function mergedIncomeCategorySelectOptions(custom: string[]): string[] {
  const norm = normalizeCustomIncomeCategoriesForProfile(custom);
  const defaultSet = new Set<string>(DEFAULT_INCOME_CATEGORIES as unknown as string[]);
  const extras = norm.filter((c) => !defaultSet.has(c));
  return [...DEFAULT_INCOME_CATEGORIES, ...extras];
}
