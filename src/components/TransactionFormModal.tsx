import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_OPTIONS } from "../domain/categories";
import { BENEFIT_BUCKET_LABEL, BENEFIT_BUCKETS } from "../domain/cardWallet";
import { parseMoneyInput } from "../domain/money";
import type { BenefitBucket, TxnPaymentMethod, TxnStatus } from "../domain/types";
import { useFinance } from "../context/FinanceContext";

const MAX_RECEIPT_FILE_BYTES = 900 * 1024;
const PAYMENT_OPTIONS: { value: TxnPaymentMethod; label: string }[] = [
  { value: "conta", label: "Conta corrente" },
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
];

const ICONS = [
  "shopping_bag",
  "payments",
  "restaurant",
  "flight",
  "shopping_cart",
  "home",
  "directions_car",
  "local_hospital",
  "savings",
  "potted_plant",
  "apartment",
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Pré-seleciona o cartão (ex.: `?novo=1&cartao=id` em Lançamentos) */
  initialCreditCardId?: string | null;
};

export function TransactionFormModal({ open, onClose, initialCreditCardId = null }: Props) {
  const { addTransaction, state } = useFinance();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0]);
  const [amountRaw, setAmountRaw] = useState("");
  const [flow, setFlow] = useState<"expense" | "income">("expense");
  const [status, setStatus] = useState<TxnStatus>("confirmado");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [icon, setIcon] = useState<string>("shopping_bag");
  const [goalId, setGoalId] = useState<string>("");
  const [creditCardId, setCreditCardId] = useState<string>("");
  const [benefitBucket, setBenefitBucket] = useState<BenefitBucket>("refeicao");
  const [paymentMethod, setPaymentMethod] = useState<TxnPaymentMethod>("conta");
  const [paymentAttachmentDataUrl, setPaymentAttachmentDataUrl] = useState<string | null>(null);
  const [paymentAttachmentName, setPaymentAttachmentName] = useState<string | null>(null);
  const [thirdPartyName, setThirdPartyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const receiptFileRef = useRef<HTMLInputElement>(null);

  const selectedCard = useMemo(
    () => (creditCardId ? state.creditCards.find((c) => c.id === creditCardId) : null),
    [creditCardId, state.creditCards]
  );

  useEffect(() => {
    if (!open) return;
    setPaymentMethod("conta");
    setPaymentAttachmentDataUrl(null);
    setPaymentAttachmentName(null);
    setThirdPartyName("");
    if (receiptFileRef.current) receiptFileRef.current.value = "";
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialCreditCardId && state.creditCards.some((c) => c.id === initialCreditCardId)) {
      setCreditCardId(initialCreditCardId);
    } else if (!initialCreditCardId) {
      setCreditCardId("");
    } else {
      setCreditCardId("");
    }
  }, [open, initialCreditCardId, state.creditCards]);

  if (!open) return null;

  function onReceiptFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_RECEIPT_FILE_BYTES) {
      setError("Arquivo muito grande. Use até ~900 KB (PDF ou imagem).");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r !== "string") return;
      if (r.length > 2_500_000) {
        setError("Arquivo muito grande após leitura. Tente outro PDF ou imagem menor.");
        setPaymentAttachmentDataUrl(null);
        setPaymentAttachmentName(null);
        return;
      }
      setPaymentAttachmentDataUrl(r);
      setPaymentAttachmentName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function clearReceiptAttachment() {
    setPaymentAttachmentDataUrl(null);
    setPaymentAttachmentName(null);
    if (receiptFileRef.current) receiptFileRef.current.value = "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = parseMoneyInput(amountRaw);
    if (!n || n <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    if (!description.trim()) {
      setError("Informe a descrição.");
      return;
    }
    const ccid = creditCardId || null;
    const card = ccid ? state.creditCards.find((c) => c.id === ccid) : null;
    if (card?.kind === "beneficios") {
      const bal = card.benefitBalances[benefitBucket];
      if (flow === "expense" && bal < n) {
        setError(
          `Saldo insuficiente em ${BENEFIT_BUCKET_LABEL[benefitBucket]} (${bal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`
        );
        return;
      }
    }
    const signed = flow === "expense" ? -n : n;
    let st: TxnStatus = status;
    if (flow === "income") st = "recebido";
    const tp =
      flow === "expense" && card?.kind === "credito" && thirdPartyName.trim()
        ? thirdPartyName.trim().slice(0, 120)
        : null;
    addTransaction({
      date,
      description: description.trim(),
      category,
      amount: signed,
      status: st,
      icon,
      accountId: state.defaultAccountId,
      goalId: goalId && flow === "expense" && !ccid ? goalId : undefined,
      creditCardId: ccid,
      benefitBucket: card?.kind === "beneficios" ? benefitBucket : null,
      thirdPartyName: tp,
      paymentMethod: flow === "expense" && !ccid ? paymentMethod : null,
      paymentAttachmentDataUrl:
        flow === "expense" && !ccid && (paymentMethod === "boleto" || paymentMethod === "pix")
          ? paymentAttachmentDataUrl
          : null,
      paymentAttachmentName:
        flow === "expense" && !ccid && (paymentMethod === "boleto" || paymentMethod === "pix")
          ? paymentAttachmentName
          : null,
    });
    setDescription("");
    setAmountRaw("");
    setGoalId("");
    setCreditCardId("");
    setThirdPartyName("");
    setPaymentMethod("conta");
    clearReceiptAttachment();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-xl bg-surface-container-lowest p-6 shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="txn-form-title"
      >
        <h2 id="txn-form-title" className="mb-4 font-headline text-xl font-bold text-primary">
          Novo lançamento
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Descrição</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Tipo</label>
              <select
                value={flow}
                onChange={(e) => {
                  const f = e.target.value as "expense" | "income";
                  setFlow(f);
                  if (f === "income") {
                    setPaymentMethod("conta");
                    clearReceiptAttachment();
                  }
                }}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Valor (R$)</label>
            <input
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TxnStatus)}
                disabled={flow === "income"}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="confirmado">Confirmado</option>
                <option value="pendente">Pendente</option>
                <option value="recebido">Recebido</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">
              Cartão (opcional)
            </label>
            <select
              value={creditCardId}
              onChange={(e) => {
                const v = e.target.value;
                setCreditCardId(v);
                if (v) {
                  setPaymentMethod("conta");
                  clearReceiptAttachment();
                }
              }}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            >
              <option value="">Nenhum — movimenta conta corrente</option>
              {state.creditCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ·••• {c.last4}
                  {c.kind === "beneficios" ? " (benefícios)" : " (crédito)"}
                </option>
              ))}
            </select>
            {creditCardId && selectedCard?.kind === "credito" && (
              <p className="mt-1 text-[11px] text-on-surface-variant">
                Despesa aumenta a fatura; receita abate a fatura. O saldo da conta corrente não muda.
              </p>
            )}
            {creditCardId && selectedCard?.kind === "beneficios" && (
              <p className="mt-1 text-[11px] text-on-surface-variant">
                Use receita para recarga mensal e despesa para gastos. Escolha a bolsa abaixo.
              </p>
            )}
          </div>
          {flow === "expense" && creditCardId && selectedCard?.kind === "credito" && (
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                Quem usou o cartão (opcional)
              </label>
              <input
                value={thirdPartyName}
                onChange={(e) => setThirdPartyName(e.target.value)}
                placeholder="Ex.: João, colega, família…"
                maxLength={120}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-on-surface-variant">
                Útil quando alguém pediu o cartão emprestado — aparece nos detalhes do cartão.
              </p>
            </div>
          )}
          {selectedCard?.kind === "beneficios" && (
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Bolsa</label>
              <select
                value={benefitBucket}
                onChange={(e) => setBenefitBucket(e.target.value as BenefitBucket)}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              >
                {BENEFIT_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {BENEFIT_BUCKET_LABEL[b]} —{" "}
                    {selectedCard.benefitBalances[b].toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </option>
                ))}
              </select>
            </div>
          )}
          {flow === "expense" && !creditCardId && (
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                Forma de pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const v = e.target.value as TxnPaymentMethod;
                  setPaymentMethod(v);
                  if (v === "conta") clearReceiptAttachment();
                }}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              >
                {PAYMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {(paymentMethod === "boleto" || paymentMethod === "pix") && (
                <div className="mt-3 rounded-lg border border-outline-variant/25 bg-surface-container-high/40 p-3">
                  <p className="mb-2 text-[11px] text-on-surface-variant">
                    Comprovante (opcional): PDF ou imagem. Fica salvo só neste aparelho com o lançamento.
                  </p>
                  <input
                    ref={receiptFileRef}
                    id="txn-receipt-file"
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp,.pdf"
                    className="sr-only"
                    onChange={onReceiptFileChange}
                  />
                  <div className="flex flex-nowrap items-center gap-2 overflow-hidden">
                    <label
                      htmlFor="txn-receipt-file"
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90"
                    >
                      <span className="material-symbols-outlined text-base">attach_file</span>
                      Escolher arquivo
                    </label>
                    {paymentAttachmentName && (
                      <>
                        <span
                          className="min-w-0 flex-1 truncate text-xs font-medium text-primary"
                          title={paymentAttachmentName}
                        >
                          {paymentAttachmentName}
                        </span>
                        <button
                          type="button"
                          onClick={clearReceiptAttachment}
                          className="shrink-0 text-xs font-bold text-error hover:underline"
                        >
                          Remover
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {flow === "expense" && !creditCardId && (
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                Aportar em meta (opcional)
              </label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              >
                <option value="">Não vincular</option>
                {state.goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Ícone</label>
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            >
              {ICONS.map((ic) => (
                <option key={ic} value={ic}>
                  {ic}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm font-semibold text-error">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
