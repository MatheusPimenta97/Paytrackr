import { CardBrandLogo } from "./CardBrandLogo";
import type { CreditCard } from "../domain/types";
import { formatBRL, roundMoney } from "../domain/money";

type Props = {
  open: boolean;
  onClose: () => void;
  cards: CreditCard[];
};

export function CreditCardLimitsModal({ open, onClose, cards }: Props) {
  if (!open) return null;

  const creditoOnly = cards.filter((c) => c.kind === "credito");
  const totalLimit = roundMoney(creditoOnly.reduce((s, c) => s + c.creditLimit, 0));
  const totalInvoice = roundMoney(creditoOnly.reduce((s, c) => s + c.currentInvoice, 0));
  const totalAvailable = roundMoney(totalLimit - totalInvoice);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 className="mb-4 font-headline text-lg font-bold text-primary">Limites dos cartões</h2>
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg bg-surface-container-high/50 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Limite total</p>
            <p className="font-headline font-black text-primary">{formatBRL(totalLimit)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Em fatura</p>
            <p className="font-headline font-black text-error">{formatBRL(totalInvoice)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Disponível</p>
            <p className="font-headline font-black text-secondary">{formatBRL(totalAvailable)}</p>
          </div>
        </div>
        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {creditoOnly.map((c) => {
            const avail = roundMoney(c.creditLimit - c.currentInvoice);
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant/20 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <CardBrandLogo brand={c.brand} className="!h-8 !w-12" />
                  <span className="truncate font-semibold text-primary">{c.name}</span>
                </div>
                <span className="text-on-surface-variant">
                  {formatBRL(c.creditLimit)} · disp. {formatBRL(avail)}
                </span>
              </li>
            );
          })}
          {creditoOnly.length === 0 && (
            <li className="text-sm text-on-surface-variant">Nenhum cartão de crédito cadastrado.</li>
          )}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
