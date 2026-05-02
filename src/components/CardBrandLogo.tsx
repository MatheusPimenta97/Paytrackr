import type { CreditCardBrand } from "../domain/types";

/** Logos oficiais / Wikimedia; “outro” usa ícone genérico */
const CARD_BRAND_LOGO_URL: Record<CreditCardBrand, string | null> = {
  visa: "https://download.logo.wine/logo/Visa_Inc./Visa_Inc.-Logo.wine.png",
  master: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg",
  elo: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Elo_logo.png",
  amex: "https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_2018.svg",
  outro: null,
};

const CARD_BRAND_ALT: Record<CreditCardBrand, string> = {
  visa: "Visa",
  master: "Mastercard",
  elo: "Elo",
  amex: "American Express",
  outro: "Cartão",
};

type Props = {
  brand: CreditCardBrand;
  /** Container extra (largura fixa do slot do logo) */
  className?: string;
  /** Classes na imagem */
  imgClassName?: string;
};

export function CardBrandLogo({ brand, className = "", imgClassName }: Props) {
  const src = CARD_BRAND_LOGO_URL[brand];
  const alt = CARD_BRAND_ALT[brand];

  if (!src) {
    return (
      <div
        className={`flex h-9 w-14 shrink-0 items-center justify-center rounded-md border border-outline-variant/20 bg-surface-container-high/80 ${className}`}
        title={alt}
      >
        <span className="material-symbols-outlined text-xl text-on-surface-variant">credit_card</span>
      </div>
    );
  }

  return (
    <div
      className={`flex h-9 w-14 shrink-0 items-center justify-center rounded-md border border-outline-variant/15 bg-white px-1 py-0.5 shadow-sm ${className}`}
      title={alt}
    >
      <img
        src={src}
        alt={alt}
        className={
          imgClassName ??
          "max-h-7 w-full max-w-[3.25rem] object-contain object-center [filter:none]"
        }
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
