import { useEffect, useRef, useState } from "react";
import { parseMoneyInput } from "../domain/money";
import type { CreditCardStatement, CreditCardStatementStatus } from "../domain/types";

const MAX_FILE = 900 * 1024;

export type CreditCardStatementFormData = {
  referenceMonth: string;
  amount: number;
  status: CreditCardStatementStatus;
  paidAt: string | null;
  note: string;
  attachmentDataUrl: string | null;
  attachmentName: string | null;
};

type Props = {
  open: boolean;
  creditCardId: string;
  editing: CreditCardStatement | null;
  /** Preenche mês e valor ao abrir (ex.: fatura atual do cartão) */
  prefill?: { referenceMonth: string; amount: number } | null;
  onClose: () => void;
  onSave: (data: CreditCardStatementFormData) => void;
};

export function CreditCardStatementModal({
  open,
  creditCardId: _creditCardId,
  editing,
  prefill,
  onClose,
  onSave,
}: Props) {
  const [month, setMonth] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [status, setStatus] = useState<CreditCardStatementStatus>("aberta");
  const [paidAt, setPaidAt] = useState("");
  const [note, setNote] = useState("");
  const [attachmentDataUrl, setAttachmentDataUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setMonth(editing.referenceMonth);
      setAmountRaw(String(editing.amount).replace(".", ","));
      setStatus(editing.status);
      setPaidAt(editing.paidAt ?? "");
      setNote(editing.note);
      setAttachmentDataUrl(editing.attachmentDataUrl);
      setAttachmentName(editing.attachmentName);
    } else if (prefill) {
      setMonth(prefill.referenceMonth);
      setAmountRaw(String(prefill.amount).replace(".", ","));
      setStatus("aberta");
      setPaidAt(new Date().toISOString().slice(0, 10));
      setNote("");
      setAttachmentDataUrl(null);
      setAttachmentName(null);
    } else {
      setMonth(new Date().toISOString().slice(0, 7));
      setAmountRaw("");
      setStatus("aberta");
      setPaidAt(new Date().toISOString().slice(0, 10));
      setNote("");
      setAttachmentDataUrl(null);
      setAttachmentName(null);
    }
    if (fileRef.current) fileRef.current.value = "";
  }, [open, editing, prefill]);

  if (!open) return null;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE) {
      setError("Arquivo muito grande (máx. ~900 KB).");
      e.target.value = "";
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const res = r.result;
      if (typeof res !== "string" || res.length > 2_500_000) {
        setError("Arquivo inválido ou muito grande.");
        return;
      }
      if (
        !res.startsWith("data:application/pdf") &&
        !res.startsWith("data:image/png") &&
        !res.startsWith("data:image/jpeg") &&
        !res.startsWith("data:image/webp")
      ) {
        setError("Use PDF ou imagem (PNG, JPEG, WebP).");
        return;
      }
      setAttachmentDataUrl(res);
      setAttachmentName(f.name);
    };
    r.readAsDataURL(f);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setError("Mês de referência inválido.");
      return;
    }
    const amt = parseMoneyInput(amountRaw);
    if (amt === null || amt < 0) {
      setError("Informe o valor da fatura.");
      return;
    }
    const paid =
      status === "paga" && paidAt && /^\d{4}-\d{2}-\d{2}$/.test(paidAt) ? paidAt : null;
    onSave({
      referenceMonth: month,
      amount: amt,
      status,
      paidAt: status === "paga" ? paid ?? new Date().toISOString().slice(0, 10) : null,
      note: note.trim(),
      attachmentDataUrl,
      attachmentName,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface-container-lowest p-6 shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="st-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="st-title" className="mb-4 font-headline text-lg font-bold text-primary">
          {editing ? "Editar fatura" : "Registrar fatura"}
        </h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Mês de referência</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Valor total (R$)</label>
            <input
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Situação</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CreditCardStatementStatus)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            >
              <option value="aberta">Em aberto</option>
              <option value="paga">Paga</option>
            </select>
          </div>
          {status === "paga" && (
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Data do pagamento</label>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Observação</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Comprovante (opcional)</label>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" className="text-xs" onChange={onFile} />
            {attachmentName && (
              <p className="mt-1 text-[11px] text-on-surface-variant">
                Anexo: {attachmentName}{" "}
                <button
                  type="button"
                  className="font-bold text-error"
                  onClick={() => {
                    setAttachmentDataUrl(null);
                    setAttachmentName(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  remover
                </button>
              </p>
            )}
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
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
