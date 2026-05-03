import { useEffect, useState } from "react";
import type { CreditCard, CreditCardBrand, CreditCardKind } from "../domain/types";
import { defaultBenefitBalances } from "../domain/cardWallet";
import { parseMoneyInput } from "../domain/money";
import { CardBrandLogo } from "./CardBrandLogo";
import { useFinance } from "../context/FinanceContext";

const BRAND_OPTIONS: { value: CreditCardBrand; label: string }[] = [
  { value: "visa", label: "Visa" },
  { value: "master", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "outro", label: "Outro" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** null = novo cartão */
  editing: CreditCard | null;
};

export function ManageCreditCardModal({ open, onClose, editing }: Props) {
  const { addCreditCard, updateCreditCard } = useFinance();
  const [kind, setKind] = useState<CreditCardKind>("credito");
  const [brand, setBrand] = useState<CreditCardBrand>("visa");
  const [name, setName] = useState("");
  const [last4, setLast4] = useState("");
  const [invoiceRaw, setInvoiceRaw] = useState("");
  const [limitRaw, setLimitRaw] = useState("");
  const [refRaw, setRefRaw] = useState("");
  const [aliRaw, setAliRaw] = useState("");
  const [mobRaw, setMobRaw] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setKind(editing.kind);
      setBrand(editing.brand);
      setName(editing.name);
      setLast4(editing.last4);
      setInvoiceRaw(String(editing.currentInvoice).replace(".", ","));
      setLimitRaw(String(editing.creditLimit).replace(".", ","));
      setRefRaw(String(editing.benefitBalances.refeicao).replace(".", ","));
      setAliRaw(String(editing.benefitBalances.alimentacao).replace(".", ","));
      setMobRaw(String(editing.benefitBalances.mobilidade).replace(".", ","));
      setClosingDay(String(editing.closingDay));
      setDueDay(String(editing.dueDay));
    } else {
      setKind("credito");
      setBrand("visa");
      setName("");
      setLast4("");
      setInvoiceRaw("");
      setLimitRaw("");
      setRefRaw("");
      setAliRaw("");
      setMobRaw("");
      setClosingDay("");
      setDueDay("");
    }
  }, [open, editing]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome do cartão.");
      return;
    }
    const digits = last4.replace(/\D/g, "");
    if (digits.length < 4) {
      setError("Informe os 4 últimos dígitos.");
      return;
    }

    if (kind === "beneficios") {
      const refeicao = parseMoneyInput(refRaw) ?? 0;
      const alimentacao = parseMoneyInput(aliRaw) ?? 0;
      const mobilidade = parseMoneyInput(mobRaw) ?? 0;
      if (refeicao < 0 || alimentacao < 0 || mobilidade < 0) {
        setError("Saldos das bolsas não podem ser negativos.");
        return;
      }
      const benefitBalances = {
        refeicao,
        alimentacao,
        mobilidade,
      };
      if (editing) {
        updateCreditCard(editing.id, {
          kind: "beneficios",
          brand,
          name: name.trim(),
          last4: digits.slice(-4),
          currentInvoice: 0,
          creditLimit: 0,
          closingDay: 1,
          dueDay: 1,
          benefitBalances,
        });
      } else {
        addCreditCard({
          kind: "beneficios",
          brand,
          name: name.trim(),
          last4: digits.slice(-4),
          currentInvoice: 0,
          creditLimit: 0,
          closingDay: 1,
          dueDay: 1,
          benefitBalances,
        });
      }
      onClose();
      return;
    }

    const closeD = parseInt(closingDay.replace(/\D/g, ""), 10);
    const dueD = parseInt(dueDay.replace(/\D/g, ""), 10);
    if (!Number.isFinite(closeD) || closeD < 1 || closeD > 31) {
      setError("Fechamento: informe o dia do mês (1 a 31).");
      return;
    }
    if (!Number.isFinite(dueD) || dueD < 1 || dueD > 31) {
      setError("Vencimento: informe o dia do mês (1 a 31).");
      return;
    }

    const invoice = parseMoneyInput(invoiceRaw);
    const limit = parseMoneyInput(limitRaw);
    if (invoice === null || invoice < 0) {
      setError("Fatura atual inválida.");
      return;
    }
    if (limit === null || limit <= 0) {
      setError("Limite total deve ser maior que zero.");
      return;
    }
    if (invoice > limit) {
      setError("A fatura não pode ser maior que o limite.");
      return;
    }

    if (editing) {
      updateCreditCard(editing.id, {
        kind: "credito",
        brand,
        name: name.trim(),
        last4: digits.slice(-4),
        currentInvoice: invoice,
        creditLimit: limit,
        closingDay: closeD,
        dueDay: dueD,
        benefitBalances: editing.benefitBalances ?? defaultBenefitBalances(),
      });
    } else {
      addCreditCard({
        kind: "credito",
        brand,
        name: name.trim(),
        last4: digits.slice(-4),
        currentInvoice: invoice,
        creditLimit: limit,
        closingDay: closeD,
        dueDay: dueD,
        benefitBalances: defaultBenefitBalances(),
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 className="mb-4 font-headline text-lg font-bold text-primary">
          {editing ? "Editar cartão" : "Incluir cartão"}
        </h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Tipo</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CreditCardKind)}
              className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-primary"
            >
              <option value="credito">Cartão de crédito (fatura)</option>
              <option value="beneficios">Cartão de benefícios (pré-pago)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Bandeira</label>
            <div className="flex items-center gap-3">
              <CardBrandLogo brand={brand} />
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value as CreditCardBrand)}
                className="min-w-0 flex-1 rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-primary"
              >
                {BRAND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Nome do cartão</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "beneficios" ? "Ex.: Alelo Alimentação" : "Ex.: Platinum Nubank"}
              className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Últimos 4 dígitos</label>
            <input
              value={last4}
              onChange={(e) => setLast4(e.target.value)}
              inputMode="numeric"
              maxLength={19}
              placeholder="8821"
              className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 font-mono text-sm"
            />
          </div>

          {kind === "credito" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">Fatura atual (R$)</label>
                <input
                  value={invoiceRaw}
                  onChange={(e) => setInvoiceRaw(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">Limite total (R$)</label>
                <input
                  value={limitRaw}
                  onChange={(e) => setLimitRaw(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-outline-variant/20 bg-surface-container-high/30 p-4">
              <p className="text-xs font-bold text-primary">Saldos por bolsa (R$)</p>
              <p className="text-[11px] leading-snug text-on-surface-variant">
                Informe quanto você tem hoje em cada categoria do cartão. Recargas e gastos nos lançamentos
                atualizam esses valores; não entram na conta corrente.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-on-surface-variant">Refeição</label>
                  <input
                    value={refRaw}
                    onChange={(e) => setRefRaw(e.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-on-surface-variant">Alimentação</label>
                  <input
                    value={aliRaw}
                    onChange={(e) => setAliRaw(e.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-on-surface-variant">Mobilidade</label>
                  <input
                    value={mobRaw}
                    onChange={(e) => setMobRaw(e.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {kind === "credito" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                  Dia do fechamento
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                  placeholder="Ex.: 3"
                  className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[10px] leading-snug text-on-surface-variant">
                  Último dia em que entram compras nessa fatura. O ciclo é do dia{" "}
                  <strong className="text-on-surface">(fechamento + 1)</strong> do mês anterior até o{" "}
                  <strong className="text-on-surface">dia do fechamento</strong> deste mês (ex.: fechamento 7 → de 8
                  do mês anterior a 7 do mês de referência).
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                  Dia do vencimento
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="Ex.: 10"
                  className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[10px] text-on-surface-variant">Dia do mês em que vence o pagamento.</p>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">
              {editing ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
