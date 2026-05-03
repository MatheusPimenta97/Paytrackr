import { useEffect, useRef, useState } from "react";
import {
  formatStatementInvoiceCyclePt,
  parseMoneyInput,
  statementInvoiceCycleIsoRange,
} from "../domain/money";
import type { CreditCardStatement, CreditCardStatementStatus } from "../domain/types";
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";
import { StatementAiPreviewModal } from "./StatementAiPreviewModal";
import {
  analyzeCreditCardStatementDocument,
  resolveStatementAssistantEndpoint,
  type StatementAiSuggestedTxn,
} from "../services/statementAi";

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
  /** Cartão de crédito: habilita extração de lançamentos por IA no anexo */
  enableStatementAi?: boolean;
  editing: CreditCardStatement | null;
  /** Preenche mês e valor ao abrir (ex.: fatura atual do cartão) */
  prefill?: { referenceMonth: string; amount: number } | null;
  /** Último dia do ciclo (ex.: 7 → compras do dia 8 do mês anterior até o 7 deste mês). */
  invoiceClosingDay?: number;
  onClose: () => void;
  onSave: (data: CreditCardStatementFormData) => void;
};

export function CreditCardStatementModal({
  open,
  creditCardId,
  enableStatementAi = false,
  editing,
  prefill,
  invoiceClosingDay = 7,
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

  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [aiMarkdown, setAiMarkdown] = useState("");
  const [aiGuess, setAiGuess] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<StatementAiSuggestedTxn[]>([]);
  const [attachmentPreviewOpen, setAttachmentPreviewOpen] = useState(false);

  const statementAiAvailable =
    enableStatementAi &&
    Boolean(attachmentDataUrl) &&
    Boolean(resolveStatementAssistantEndpoint());

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
    setAiErr(null);
    setAiPreviewOpen(false);
    setAiMarkdown("");
    setAiGuess(null);
    setAiSuggestions([]);
    setAttachmentPreviewOpen(false);
  }, [open, editing, prefill]);

  if (!open) return null;

  const cycleForMonth = statementInvoiceCycleIsoRange(month, invoiceClosingDay);

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

  async function runStatementAi() {
    if (!attachmentDataUrl || !statementAiAvailable) return;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setAiErr("Defina um mês de referência válido antes de usar a IA.");
      return;
    }
    setAiErr(null);
    setAiBusy(true);
    try {
      const out = await analyzeCreditCardStatementDocument(attachmentDataUrl, { referenceMonth: month });
      if (out.demoMode) {
        setAiErr("Configure o endpoint da IA (mesmo do comprovante) para usar esta função.");
        return;
      }
      setAiMarkdown(out.markdown);
      setAiGuess(out.statementTotalGuess);
      setAiSuggestions(out.suggestedTransactions);
      setAiPreviewOpen(true);
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "Falha ao analisar a fatura.");
    } finally {
      setAiBusy(false);
    }
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
      <AttachmentPreviewModal
        open={attachmentPreviewOpen}
        onClose={() => setAttachmentPreviewOpen(false)}
        dataUrl={attachmentDataUrl}
        fileName={attachmentName}
      />
      <StatementAiPreviewModal
        open={aiPreviewOpen}
        creditCardId={creditCardId}
        statementReferenceMonth={month}
        invoiceClosingDay={invoiceClosingDay}
        markdown={aiMarkdown}
        statementTotalGuess={aiGuess}
        suggestedTransactions={aiSuggestions}
        onClose={() => setAiPreviewOpen(false)}
      />
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
          <div className="rounded-lg border border-primary/20 bg-primary-fixed/15 px-3 py-2 dark:border-blue-900/40 dark:bg-slate-800/80">
            <p className="text-[11px] font-bold text-primary dark:text-blue-200">1. Mês de referência da fatura</p>
            <p className="mt-0.5 text-[10px] leading-snug text-on-surface-variant dark:text-slate-400">
              Escolha o mês <strong className="text-on-surface dark:text-slate-200">desta</strong> fatura (fechamento)
              antes de anexar o PDF e usar a IA — assim os lançamentos caem no ciclo certo.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Mês de referência</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
            {cycleForMonth ? (
              <p className="mt-1.5 rounded-lg border border-outline-variant/20 bg-surface-container/60 px-2 py-1.5 text-[10px] leading-snug text-on-surface-variant dark:border-slate-700 dark:bg-slate-800/60">
                <span className="font-bold text-primary dark:text-slate-200">Período:</span>{" "}
                {formatStatementInvoiceCyclePt(cycleForMonth)}
              </p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">
              2. Comprovante (opcional) e extração por IA
            </label>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" className="text-xs" onChange={onFile} />
            {attachmentName && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-on-surface-variant">
                <span className="truncate">Anexo: {attachmentName}</span>
                {attachmentDataUrl ? (
                  <button
                    type="button"
                    className="shrink-0 font-bold text-primary hover:underline dark:text-blue-300"
                    onClick={() => setAttachmentPreviewOpen(true)}
                  >
                    Ver
                  </button>
                ) : null}
                <button
                  type="button"
                  className="shrink-0 font-bold text-error"
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
            {statementAiAvailable && (
              <div className="mt-2">
                <button
                  type="button"
                  disabled={aiBusy || !/^\d{4}-\d{2}$/.test(month)}
                  onClick={() => void runStatementAi()}
                  className="rounded-lg border border-secondary/40 bg-secondary-container/20 px-3 py-2 text-xs font-bold text-secondary hover:bg-secondary-container/35 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                >
                  {aiBusy ? "Analisando fatura…" : "Extrair lançamentos com IA"}
                </button>
                <p className="mt-1 text-[10px] text-on-surface-variant">
                  {!/^\d{4}-\d{2}$/.test(month)
                    ? "Defina o mês de referência acima para habilitar a extração."
                    : "PDF ou imagem. Revise cada linha antes de importar."}
                </p>
              </div>
            )}
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
          {aiErr && <p className="text-xs font-semibold text-error">{aiErr}</p>}
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
