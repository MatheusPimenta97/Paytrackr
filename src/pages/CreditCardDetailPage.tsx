import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { CardBrandLogo } from "../components/CardBrandLogo";
import { CreditCardStatementModal } from "../components/CreditCardStatementModal";
import { CreditCardThirdPartyModal } from "../components/CreditCardThirdPartyModal";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { BENEFIT_BUCKET_LABEL } from "../domain/cardWallet";
import type { BenefitBucket } from "../domain/types";
import {
  creditCardDueStatus,
  daysUntilCreditCardDue,
  formatCardBillingDayLabel,
  formatDateShort,
} from "../domain/money";
import type { CreditCardStatement, Transaction } from "../domain/types";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function CreditCardDetailPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const {
    state,
    patchTransaction,
    addCreditCardStatement,
    updateCreditCardStatement,
    deleteCreditCardStatement,
  } = useFinance();

  const card = cardId ? state.creditCards.find((c) => c.id === cardId) : undefined;
  const [thirdPartyTxn, setThirdPartyTxn] = useState<Transaction | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementEditing, setStatementEditing] = useState<CreditCardStatement | null>(null);
  const [statementPrefill, setStatementPrefill] = useState<{
    referenceMonth: string;
    amount: number;
  } | null>(null);

  const cardTxns = useMemo(() => {
    if (!cardId) return [];
    return [...state.transactions]
      .filter((t) => t.creditCardId === cardId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [state.transactions, cardId]);

  const statements = useMemo(() => {
    if (!cardId) return [];
    return [...state.creditCardStatements]
      .filter((s) => s.creditCardId === cardId)
      .sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth));
  }, [state.creditCardStatements, cardId]);

  if (!cardId || !card) {
    return <Navigate to="/" replace />;
  }

  const isCredito = card.kind === "credito";
  const due = isCredito ? creditCardDueStatus(card.dueDay) : null;
  const available = isCredito ? Math.max(0, card.creditLimit - card.currentInvoice) : 0;
  const usedPct =
    isCredito && card.creditLimit > 0
      ? Math.min(100, Math.round((card.currentInvoice / card.creditLimit) * 100))
      : 0;
  const dDue = isCredito ? daysUntilCreditCardDue(card.dueDay) : 0;
  const dueHint =
    dDue < 0
      ? `${Math.abs(dDue)} dia(s) de atraso`
      : dDue === 0
        ? "Vence hoje"
        : `Faltam ${dDue} dia(s) para o vencimento`;

  return (
    <div className="mx-auto max-w-7xl px-6 pb-12 md:px-12">
      <CreditCardThirdPartyModal
        open={thirdPartyTxn !== null}
        transaction={thirdPartyTxn}
        onClose={() => setThirdPartyTxn(null)}
        onSave={(name) => {
          if (thirdPartyTxn) patchTransaction(thirdPartyTxn.id, { thirdPartyName: name });
        }}
      />
      <CreditCardStatementModal
        open={statementOpen}
        creditCardId={card.id}
        editing={statementEditing}
        prefill={statementEditing ? null : statementPrefill}
        onClose={() => {
          setStatementOpen(false);
          setStatementEditing(null);
          setStatementPrefill(null);
        }}
        onSave={(data) => {
          if (statementEditing) {
            updateCreditCardStatement(statementEditing.id, data);
          } else {
            addCreditCardStatement({
              creditCardId: card.id,
              ...data,
            });
          }
        }}
      />

      <p className="mb-4">
        <Link
          to="/"
          className="text-sm font-bold text-secondary underline-offset-2 hover:underline"
        >
          ← Voltar ao painel
        </Link>
      </p>

      <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-primary md:text-4xl">
            Detalhes do cartão
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-on-surface-variant">
            <CardBrandLogo brand={card.brand} className="!h-8 !w-14" imgClassName="max-h-6 object-contain" />
            <span className="font-medium">
              {card.name} ·••• {card.last4}
            </span>
            {isCredito ? (
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                Crédito
              </span>
            ) : (
              <span className="rounded-full bg-tertiary-fixed/40 px-2 py-0.5 text-[10px] font-bold uppercase text-tertiary">
                Benefícios
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`/lancamentos?novo=1&cartao=${card.id}`)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-container"
          >
            <span className="material-symbols-outlined text-[20px]">add_card</span>
            Novo lançamento
          </button>
          {isCredito && (
            <button
              type="button"
              onClick={() => navigate(`/lancamentos?novo=1&cartao=${card.id}`)}
              className="flex items-center gap-2 rounded-xl bg-surface-container-high px-5 py-2.5 text-sm font-bold text-primary hover:bg-surface-container-highest"
            >
              <span className="material-symbols-outlined text-[20px]">payments</span>
              Registrar pagamento
            </button>
          )}
          <button
            type="button"
            onClick={() => alert("Exporte o backup em Configurações para guardar todos os dados.")}
            className="flex items-center gap-2 rounded-xl border border-outline-variant/30 px-5 py-2.5 text-sm font-bold text-primary"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            Dados / backup
          </button>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:col-span-8">
          {isCredito ? (
            <>
              <div className="flex min-h-[140px] flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-[0px_20px_40px_rgba(7,30,39,0.06)]">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Fatura atual
                </span>
                <div>
                  <span className="font-headline text-3xl font-extrabold text-primary">
                    {formatBRL(card.currentInvoice)}
                  </span>
                  <p
                    className={`mt-1 text-xs font-bold ${due === "overdue" ? "text-error" : "text-secondary"}`}
                  >
                    {dueHint}
                  </p>
                </div>
              </div>
              <div className="flex min-h-[140px] flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-[0px_20px_40px_rgba(7,30,39,0.06)]">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Limite disponível
                </span>
                <div>
                  <span className="font-headline text-3xl font-extrabold text-primary">
                    {formatBRL(available)}
                  </span>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                    <div className="h-full bg-primary transition-all" style={{ width: `${usedPct}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex min-h-[140px] flex-col justify-between rounded-xl border-l-4 border-secondary bg-surface-container-lowest p-6 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Próximo fechamento
                </span>
                <div>
                  <span className="font-headline text-2xl font-extrabold text-secondary">
                    {formatCardBillingDayLabel(card.closingDay)}
                  </span>
                  <p className="mt-1 text-xs text-on-surface-variant">Início do próximo ciclo da fatura</p>
                </div>
              </div>
            </>
          ) : (
            (["refeicao", "alimentacao", "mobilidade"] as BenefitBucket[]).map((b) => (
              <div
                key={b}
                className="flex min-h-[120px] flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-sm"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  {BENEFIT_BUCKET_LABEL[b]}
                </span>
                <span className="font-headline text-2xl font-extrabold text-primary">
                  {formatBRL(card.benefitBalances[b])}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="relative min-h-[160px] overflow-hidden rounded-xl bg-primary p-6 text-white md:col-span-4">
          <div className="relative z-10">
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">Resumo</span>
            <h3 className="mt-1 font-headline text-xl font-bold">Movimentação no cartão</h3>
            <p className="mt-2 text-sm text-white/80">
              {cardTxns.length} lançamento(s) registrados. Vincule compras a terceiros e mantenha o histórico de
              faturas ao lado.
            </p>
          </div>
          <div className="pointer-events-none absolute bottom-0 right-0 opacity-20">
            <span className="material-symbols-outlined text-[8rem]">account_balance</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-headline text-xl font-extrabold text-primary">Lançamentos neste cartão</h2>
            <span className="text-sm text-on-surface-variant">{cardTxns.length} item(ns)</span>
          </div>
          {cardTxns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest/80 p-10 text-center text-on-surface-variant">
              Nenhum lançamento ainda. Use &quot;Novo lançamento&quot; ou cadastre no menu Lançamentos.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-surface-container-low">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-high/50">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Data
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Descrição
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Terceiro
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {cardTxns.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-container-lowest/80">
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium">
                        {formatDateShort(t.date)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-primary">{t.description}</span>
                          <span className="text-[11px] text-on-surface-variant">
                            {t.category}
                            {t.benefitBucket ? ` · ${BENEFIT_BUCKET_LABEL[t.benefitBucket]}` : ""}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {t.thirdPartyName ? (
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-xs font-bold text-on-secondary-container">
                              {t.thirdPartyName.slice(0, 2).toUpperCase()}
                            </span>
                            <button
                              type="button"
                              onClick={() => setThirdPartyTxn(t)}
                              className="text-left text-xs font-bold text-primary hover:underline"
                            >
                              {t.thirdPartyName}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setThirdPartyTxn(t)}
                            className="group flex items-center gap-2 text-[11px] font-bold text-on-surface-variant hover:text-primary"
                          >
                            <span className="material-symbols-outlined text-lg group-hover:scale-110">
                              person_add
                            </span>
                            Atribuir pessoa
                          </button>
                        )}
                      </td>
                      <td
                        className={`px-4 py-4 text-right font-headline text-sm font-bold ${
                          t.amount < 0 ? "text-primary" : "text-secondary"
                        }`}
                      >
                        {formatBRL(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="lg:col-span-4">
          {isCredito && (
            <>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-headline text-xl font-extrabold text-primary">Histórico de faturas</h2>
                <button
                  type="button"
                  onClick={() => {
                    setStatementEditing(null);
                    setStatementPrefill(null);
                    setStatementOpen(true);
                  }}
                  className="text-xs font-bold text-secondary hover:underline"
                >
                  + Registrar
                </button>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatementEditing(null);
                    setStatementPrefill({
                      referenceMonth: new Date().toISOString().slice(0, 7),
                      amount: card.currentInvoice,
                    });
                    setStatementOpen(true);
                  }}
                  className="rounded-lg border border-outline-variant/30 px-3 py-2 text-xs font-bold text-primary hover:bg-surface-container-low"
                >
                  Usar fatura atual ({formatBRL(card.currentInvoice)})
                </button>
              </div>
              <p className="mb-4 text-xs text-on-surface-variant">
                Registre o valor de cada fechamento para acompanhar o passado. Opcional: anexe o PDF da fatura.
              </p>
              <div className="space-y-4">
                {statements.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">Nenhuma fatura arquivada ainda.</p>
                ) : (
                  statements.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm"
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            {monthLabel(s.referenceMonth)}
                          </p>
                          <h3 className="mt-1 font-headline text-lg font-bold text-primary">
                            {formatBRL(s.amount)}
                          </h3>
                        </div>
                        <span
                          className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase ${
                            s.status === "paga"
                              ? "bg-secondary-container text-on-secondary-container"
                              : "bg-surface-container-highest text-primary"
                          }`}
                        >
                          {s.status === "paga" ? "Paga" : "Aberta"}
                        </span>
                      </div>
                      {s.note ? <p className="mb-2 text-xs text-on-surface-variant">{s.note}</p> : null}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/10 pt-3">
                        <div className="flex flex-wrap gap-2">
                          {s.attachmentDataUrl ? (
                            <a
                              href={s.attachmentDataUrl}
                              download={s.attachmentName ?? "fatura"}
                              className="flex items-center text-[11px] font-bold text-primary hover:underline"
                            >
                              <span className="material-symbols-outlined mr-1 text-base">attach_file</span>
                              Ver anexo
                            </a>
                          ) : (
                            <span className="text-[11px] text-on-surface-variant">Sem anexo</span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setStatementPrefill(null);
                              setStatementEditing(s);
                              setStatementOpen(true);
                            }}
                            className="text-[11px] font-bold text-primary hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Remover este registro de fatura?")) deleteCreditCardStatement(s.id);
                            }}
                            className="text-[11px] font-bold text-error hover:underline"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
          {!isCredito && (
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-6">
              <h2 className="mb-2 font-headline text-lg font-bold text-primary">Cartão de benefícios</h2>
              <p className="text-sm text-on-surface-variant">
                O histórico de faturas em fechamento aplica-se a cartões de crédito. Aqui você acompanha bolsas e
                lançamentos à esquerda.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
