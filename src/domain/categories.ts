export const CATEGORY_OPTIONS = [
  "Eletrônicos",
  "Investimentos",
  "Lazer",
  "Viagem",
  "Alimentação",
  "Moradia",
  "Material de construção",
  "Transporte",
  "Mobilidade",
  "Saúde",
  "Vestuário",
  "Juros e encargos",
  "Outros",
] as const;

/** Material Symbols name aligned with `CATEGORY_OPTIONS`. */
export function iconForCategory(category: string): string {
  switch (category) {
    case "Eletrônicos":
      return "shopping_cart";
    case "Investimentos":
      return "savings";
    case "Lazer":
      return "restaurant";
    case "Viagem":
      return "flight";
    case "Alimentação":
      return "restaurant";
    case "Moradia":
      return "apartment";
    case "Transporte":
      return "directions_car";
    case "Mobilidade":
      return "electric_scooter";
    case "Material de construção":
      return "construction";
    case "Saúde":
      return "local_hospital";
    case "Vestuário":
      return "checkroom";
    case "Juros e encargos":
      return "percent";
    default:
      return "shopping_bag";
  }
}

export function categoryPillClass(category: string): string {
  if (category === "Investimentos") {
    return "rounded-[9999px] bg-secondary-container/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container";
  }
  return "rounded-[9999px] bg-surface-container-high px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary";
}

export function iconWrapForCategory(category: string, amount: number): string {
  if (category === "Investimentos" || amount > 0) {
    return "bg-secondary/5 text-secondary";
  }
  return "bg-primary/5 text-primary";
}

export function statusUi(status: string): {
  dot: string;
  text: string;
  label: string;
} {
  switch (status) {
    case "recebido":
      return { dot: "bg-secondary", text: "text-secondary", label: "Recebido" };
    case "pendente":
      return { dot: "bg-outline", text: "text-outline", label: "Pendente" };
    default:
      return { dot: "bg-secondary", text: "text-secondary", label: "Confirmado" };
  }
}
