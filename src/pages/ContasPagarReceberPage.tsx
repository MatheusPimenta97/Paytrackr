import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ReceivableFormModal } from "../components/ReceivableFormModal";
import { ReceivablePartialModal } from "../components/ReceivablePartialModal";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { isSalaryIncomeCategory } from "../domain/incomeCategories";
import { formatDateShort, roundMoney } from "../domain/money";
import {
  currentMonthKey,
  daysUntilDue,
  displayStatus,
  dueLabel,
  isPaidThisMonth,
} from "../domain/recurring";
import {
  isReceivableOverdue,
  receivableRemaining,
  receivableUrgentLabel,
  receivedTotal,
  recoveryBarPercent,
  sumOpenReceivables,
  sumOverdueReceivables,
  sumRecoveredInMonth,
} from "../domain/receivables";
import type { CreditCard, RecurringExpense, Receivable } from "../domain/types";

type MainTab = "pagar" | "receber";
type TableFilter = "todos" | "pendentes" | "agendados" | "liquidados";

function recurringPaymentShort(cards: CreditCard[], creditCardId: string | null): string | null {
  if (!creditCardId) return null;
  const c = cards.find((x) => x.id === creditCardId);
  return c ? `${c.name} ·••• ${c.last4}` : null;
}

function pendingRecurringMonthTotal(rows: RecurringExpense[], mk: string): number {
  let s = 0;
  for (const r of rows) {
    if (isPaidThisMonth(r, mk)) continue;
    s += r.cadence === "anual" ? r.amount / 12 : r.amount;
  }
  return roundMoney(s);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function cobrarWhatsApp(r: Receivable) {
  const rest = receivableRemaining(r);
  const parcela = r.installmentMode
    ? r.installmentCount
      ? ` Está pagando em parcelas no cartão (até ${r.installmentCount}x).`
      : " Está quitando em parcelas no cartão."
    : "";
  const msg = `Olá! Passando para lembrar: falta ${formatBRL(rest)} de ${formatBRL(r.amount)} no total, vencimento em ${formatDateShort(r.dueDate)}.${parcela}${r.note ? ` Obs.: ${r.note}` : ""} Obrigado!`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
}

function formatRelativePaid(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const now = new Date();
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return `Há ${diff} dias`;
  return formatDateShort(iso);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Recorrente não pago: urgente vs ainda distante no mês */
function recurringFilterSlot(r: RecurringExpense, mk: string): Exclude<TableFilter, "todos" | "liquidados"> {
  if (isPaidThisMonth(r, mk)) return "agendados";
  const st = displayStatus(r);
  const d = daysUntilDue(r.dueDay);
  if (st === "vencendo" || d <= 7) return "pendentes";
  return "agendados";
}

function receivableFilterSlot(r: Receivable): Exclude<TableFilter, "todos" | "liquidados"> {
  if (r.status !== "aberto") return "agendados";
  if (isReceivableOverdue(r)) return "pendentes";
  const due = startOfDay(new Date(r.dueDate + "T12:00:00"));
  const t = startOfDay(new Date());
  const ahead = Math.round((due.getTime() - t.getTime()) / 86_400_000);
  if (ahead >= 0 && ahead <= 7) return "pendentes";
  return "agendados";
}

function downloadTableCsv(filename: string, header: string[], lines: string[][]) {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const body = [header, ...lines].map((row) => row.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff", body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const tabBtn =
  "relative pb-2 text-xs font-bold transition-colors border-b-2 border-transparent text-on-surface-variant hover:text-primary";
const tabBtnActive = "border-primary text-primary";

export function ContasPagarReceberPage() {
  const {
    state,
    greeting,
    receiveReceivable,
    deleteReceivable,
    toggleRecurringPaid,
  } = useFinance();
  const [mainTab, setMainTab] = useState<MainTab>("pagar");
  const [tableFilter, setTableFilter] = useState<TableFilter>("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [partialFor, setPartialFor] = useState<Receivable | null>(null);
  const list = state.receivables;
  const mk = currentMonthKey();

  useEffect(() => {
    setTableFilter("todos");
  }, [mainTab]);

  /** Só não pagas no mês — usada nos filtros Pendentes/Agendados e nos totais “pendente”. */
  const unpaidRecurring = useMemo(() => {
    return state.recurringExpenses
      .filter((r) => !isPaidThisMonth(r, mk))
      .sort((a, b) => a.dueDay - b.dueDay);
  }, [state.recurringExpenses, mk]);

  const paidRecurringThisMonth = useMemo(() => {
    return state.recurringExpenses
      .filter((r) => isPaidThisMonth(r, mk))
      .sort((a, b) => a.dueDay - b.dueDay);
  }, [state.recurringExpenses, mk]);

  const filteredRecurring = useMemo(() => {
    if (tableFilter === "liquidados") return [];
    if (tableFilter === "todos") return [...unpaidRecurring, ...paidRecurringThisMonth];
    return unpaidRecurring.filter((r) => recurringFilterSlot(r, mk) === tableFilter);
  }, [unpaidRecurring, paidRecurringThisMonth, tableFilter, mk]);

  const openSorted = useMemo(() => {
    const open = list.filter((r) => r.status === "aberto");
    return [...open].sort((a, b) => {
      const oa = isReceivableOverdue(a) ? 0 : 1;
      const ob = isReceivableOverdue(b) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [list]);

  const paidSorted = useMemo(() => {
    const paid = list.filter((r) => r.status === "pago");
    return [...paid].sort((a, b) => {
      const da = a.paidAt ?? a.dueDate;
      const db = b.paidAt ?? b.dueDate;
      return db.localeCompare(da) || b.dueDate.localeCompare(a.dueDate);
    });
  }, [list]);

  const filteredReceivables = useMemo(() => {
    if (tableFilter === "liquidados") return paidSorted;
    if (tableFilter === "todos") return [...openSorted, ...paidSorted];
    return openSorted.filter((r) => receivableFilterSlot(r) === tableFilter);
  }, [openSorted, paidSorted, tableFilter]);

  const countPagarPend = useMemo(
    () => unpaidRecurring.filter((r) => recurringFilterSlot(r, mk) === "pendentes").length,
    [unpaidRecurring, mk]
  );
  const countPagarAgend = useMemo(
    () => unpaidRecurring.filter((r) => recurringFilterSlot(r, mk) === "agendados").length,
    [unpaidRecurring, mk]
  );
  const countReceberPend = useMemo(
    () => openSorted.filter((r) => receivableFilterSlot(r) === "pendentes").length,
    [openSorted]
  );
  const countReceberAgend = useMemo(
    () => openSorted.filter((r) => receivableFilterSlot(r) === "agendados").length,
    [openSorted]
  );
  const countReceberLiquid = paidSorted.length;

  /** Cobranças quitadas + receitas lançadas direto na conta (histórico mais completo na lateral). */
  const recentIncomingFeed = useMemo(() => {
    type Row = {
      key: string;
      title: string;
      amount: number;
      date: string;
      source: "cobrança" | "conta";
    };
    const rows: Row[] = [];
    const seenRecv = new Set<string>();

    function recvDedupeKey(date: string, amount: number, name: string): string {
      return `${date}|${roundMoney(amount)}|${name.trim().toLowerCase()}`;
    }

    for (const r of list) {
      if (!Array.isArray(r.payments)) continue;
      for (let i = 0; i < r.payments.length; i++) {
        const p = r.payments[i];
        seenRecv.add(recvDedupeKey(p.date, p.amount, r.debtorName));
        rows.push({
          key: `rec-${r.id}-${p.date}-${i}-${p.amount}`,
          title: r.debtorName,
          amount: p.amount,
          date: p.date,
          source: "cobrança",
        });
      }
    }

    for (const t of state.transactions) {
      if (t.amount <= 0) continue;
      if (t.creditCardId) continue;
      if (t.status !== "recebido" && t.status !== "confirmado") continue;
      const amt = roundMoney(t.amount);
      const desc = (t.description ?? "").trim();
      if (/^Recebimento\b/i.test(desc)) {
        const nome = desc.replace(/^Recebimento\s*[—\-]\s*/i, "").trim();
        const k = recvDedupeKey(t.date, amt, nome || desc);
        if (seenRecv.has(k)) continue;
      }
      rows.push({
        key: `tx-${t.id}`,
        title: desc || t.category,
        amount: amt,
        date: t.date,
        source: "conta",
      });
    }

    return rows
      .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)
      .slice(0, 12);
  }, [list, state.transactions]);

  const totalRecorrentePendente = useMemo(
    () => pendingRecurringMonthTotal(state.recurringExpenses, mk),
    [state.recurringExpenses, mk]
  );

  const totalPendenteReceber = sumOpenReceivables(list);
  const totalAtraso = sumOverdueReceivables(list);
  const recuperadoMes = sumRecoveredInMonth(list);
  const barPct = recoveryBarPercent(list);
  const overdueCount = list.filter((r) => r.status === "aberto" && isReceivableOverdue(r)).length;

  function exportPagarCsv() {
    downloadTableCsv(
      `paytrackr-contas-a-pagar-${mk}.csv`,
      ["Descrição", "Categoria", "Vencimento", "Valor (mês)", "Pagamento", "Situação"],
      filteredRecurring.map((r) => {
        const st = displayStatus(r);
        const stLabel = st === "pago" ? "Pago" : st === "vencendo" ? "Vencendo" : "Pendente";
        const card = recurringPaymentShort(state.creditCards, r.creditCardId);
        return [
          r.name,
          r.category,
          dueLabel(r),
          String(roundMoney(r.cadence === "anual" ? r.amount / 12 : r.amount)),
          card ?? "Conta",
          stLabel,
        ];
      })
    );
  }

  function exportReceberCsv() {
    downloadTableCsv(
      `paytrackr-contas-a-receber-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Descrição", "Categoria", "Vencimento", "Total", "A receber", "Situação"],
      filteredReceivables.map((r) => {
        const rest = receivableRemaining(r);
        const badge = receivableUrgentLabel(r);
        const sit =
          r.status === "pago"
            ? `Liquidado${r.paidAt ? ` (${formatDateShort(r.paidAt)})` : ""}`
            : badge || (isReceivableOverdue(r) ? "Atraso" : "Em dia");
        return [
          r.debtorName,
          r.incomeCategory ?? "",
          formatDateShort(r.dueDate),
          String(r.amount),
          String(rest),
          sit,
        ];
      })
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 pb-12 md:px-12">
      <ReceivableFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <ReceivablePartialModal
        open={partialFor !== null}
        receivable={partialFor}
        onClose={() => setPartialFor(null)}
        onConfirm={({ amount, registerIncome, paymentDate }) => {
          if (!partialFor) return;
          receiveReceivable(partialFor.id, { amount, registerIncome, paymentDate });
        }}
      />

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div className="min-w-0">
          <h1 className="mb-1 font-headline text-3xl font-extrabold tracking-tight text-primary">
            Contas a pagar e receber
          </h1>
          <p className="font-medium text-on-surface-variant">
            {greeting}, {state.profile.displayName}! Visualize compromissos fixos e entradas esperadas em formato de
            tabela. Para marcar{" "}
            <span className="text-on-surface">meses anteriores</span> de uma conta fixa (ex.: luz), abra{" "}
            <span className="font-semibold text-primary">Gastos recorrentes</span> → menu (⋮) →{" "}
            <span className="font-semibold text-primary">Histórico por mês</span>.
          </p>
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] sm:gap-2 sm:justify-end sm:pb-0">
          <Link
            to="/gastos-recorrentes"
            className="flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-xs font-bold text-primary shadow-sm transition-all hover:bg-surface-container-high sm:px-3.5"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">calendar_month</span>
            Gastos recorrentes
          </Link>
          <Link
            to="/gastos-recorrentes?novo=1"
            className="flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-bold text-primary sm:px-3.5"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">add</span>
            Incluir despesa
          </Link>
          <button
            type="button"
            onClick={() => {
              setMainTab("receber");
              setFormOpen(true);
            }}
            className="flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-gradient-to-br from-primary to-primary-container px-3.5 py-2 text-xs font-bold text-white shadow-md transition-all hover:shadow-primary/20 active:scale-[0.98] sm:px-4"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">add</span>
            Nova receita
          </button>
        </div>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3 print:hidden">
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">A pagar (mês)</p>
          <p className="mt-1 font-headline text-2xl font-extrabold text-primary">{formatBRL(totalRecorrentePendente)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{unpaidRecurring.length} fixo(s) pendente(s)</p>
        </div>
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">A receber (aberto)</p>
          <p className="mt-1 font-headline text-2xl font-extrabold text-primary">{formatBRL(totalPendenteReceber)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{openSorted.length} entrada(s)</p>
        </div>
        <div className="rounded-xl border border-error/15 bg-error-container/15 p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-error">Receitas em atraso</p>
          <p className="mt-1 font-headline text-2xl font-extrabold text-error">{formatBRL(totalAtraso)}</p>
          <p className="mt-1 text-xs text-error/90">
            {overdueCount > 0 ? `${overdueCount} vencida(s)` : "Nada vencido"}
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-[0px_8px_40px_rgba(7,30,39,0.06)]">
            {/* Abas */}
            <div className="flex border-b border-outline-variant/15 px-3 pt-3 sm:px-5">
              <button
                type="button"
                onClick={() => setMainTab("pagar")}
                className={`${tabBtn} mr-6 ${mainTab === "pagar" ? tabBtnActive : ""}`}
              >
                A pagar
              </button>
              <button
                type="button"
                onClick={() => setMainTab("receber")}
                className={`${tabBtn} ${mainTab === "receber" ? tabBtnActive : ""}`}
              >
                A receber
              </button>
            </div>

            {/* Barra filtro + ações */}
            <div className="flex flex-col gap-2 border-b border-outline-variant/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-on-surface-variant">Filtrar</span>
                <button
                  type="button"
                  onClick={() => setTableFilter("pendentes")}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                    tableFilter === "pendentes"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant/40 bg-surface-container-high/50 text-on-surface-variant hover:border-primary/40"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-error" aria-hidden />
                  Pendentes
                  <span className="text-[10px] font-semibold opacity-70">
                    ({mainTab === "pagar" ? countPagarPend : countReceberPend})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter("agendados")}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                    tableFilter === "agendados"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant/40 bg-surface-container-high/50 text-on-surface-variant hover:border-primary/40"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[#eab308]" aria-hidden />
                  Agendados
                  <span className="text-[10px] font-semibold opacity-70">
                    ({mainTab === "pagar" ? countPagarAgend : countReceberAgend})
                  </span>
                </button>
                {mainTab === "receber" ? (
                  <button
                    type="button"
                    onClick={() => setTableFilter("liquidados")}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                      tableFilter === "liquidados"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-outline-variant/40 bg-surface-container-high/50 text-on-surface-variant hover:border-primary/40"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-secondary" aria-hidden />
                    Liquidados
                    <span className="text-[10px] font-semibold opacity-70">({countReceberLiquid})</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setTableFilter("todos")}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    tableFilter === "todos"
                      ? "bg-primary text-white"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  Todos
                </button>
              </div>
              <div className="flex items-center gap-1 border-outline-variant/20 sm:border-l sm:pl-4">
                {mainTab === "pagar" ? (
                  <Link
                    to="/gastos-recorrentes"
                    title="Gerenciar gastos fixos"
                    className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-[20px]">settings</span>
                  </Link>
                ) : (
                  <span className="rounded-md p-1.5 text-outline-variant/30" title="—">
                    <span className="material-symbols-outlined text-[20px]">settings</span>
                  </span>
                )}
                <button
                  type="button"
                  title="Baixar tabela (CSV)"
                  className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                  onClick={() => (mainTab === "pagar" ? exportPagarCsv() : exportReceberCsv())}
                >
                  <span className="material-symbols-outlined text-[20px]">download</span>
                </button>
                <button
                  type="button"
                  title="Imprimir"
                  className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-primary print:hidden"
                  onClick={() => window.print()}
                >
                  <span className="material-symbols-outlined text-[20px]">print</span>
                </button>
              </div>
            </div>

            {/* Tabela + empty */}
            <div className="p-3 sm:p-4">
              {mainTab === "pagar" ? (
                state.recurringExpenses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                    <span className="material-symbols-outlined mb-4 text-6xl text-outline-variant/50">thumb_up</span>
                    <p className="font-headline text-lg font-bold text-primary">Nenhuma despesa fixa cadastrada.</p>
                    <p className="mt-2 max-w-md text-sm text-on-surface-variant">
                      Cadastre em gastos recorrentes (TIM, luz, etc.). Depois elas aparecem aqui; pode marcar como paga no
                      mês sem sumir da lista em “Todos”.
                    </p>
                    <Link
                      to="/gastos-recorrentes?novo=1"
                      className="mt-6 text-sm font-bold text-primary underline-offset-4 hover:underline"
                    >
                      Incluir despesa
                    </Link>
                  </div>
                ) : filteredRecurring.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                    <span className="material-symbols-outlined mb-4 text-6xl text-outline-variant/50">filter_alt</span>
                    <p className="font-headline text-lg font-bold text-primary">Nada neste filtro.</p>
                    <p className="mt-2 max-w-md text-sm text-on-surface-variant">
                      Troque para <strong className="text-on-surface">Todos</strong> para ver todas as fixas do mês
                      (pagas e não pagas), ou ajuste Pendentes / Agendados.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTableFilter("todos")}
                      className="mt-6 text-sm font-bold text-primary underline-offset-4 hover:underline"
                    >
                      Ver todos
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-outline-variant/10">
                    <table className="w-full min-w-[600px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-outline-variant/15 bg-surface-container-high/40">
                          <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                            Descrição
                          </th>
                          <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                            Cat.
                          </th>
                          <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                            Venc.
                          </th>
                          <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                            Valor
                          </th>
                          <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                            Pagto.
                          </th>
                          <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                            Sit.
                          </th>
                          <th className="px-2 py-1.5 text-right font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecurring.map((r) => {
                          const st = displayStatus(r);
                          const paidMonth = isPaidThisMonth(r, mk);
                          const cardHint = recurringPaymentShort(state.creditCards, r.creditCardId);
                          const dueSoon = daysUntilDue(r.dueDay);
                          const stLabel = st === "pago" ? "Pago" : st === "vencendo" ? "Vencendo" : "Pendente";
                          return (
                            <tr
                              key={r.id}
                              className={`border-b border-outline-variant/10 transition-colors hover:bg-surface-container-low/70 ${paidMonth ? "bg-surface-container-high/25" : ""}`}
                            >
                              <td className="max-w-[140px] truncate px-2 py-1.5 font-semibold text-primary">{r.name}</td>
                              <td className="max-w-[72px] truncate px-2 py-1.5 text-on-surface-variant">{r.category}</td>
                              <td className="whitespace-nowrap px-2 py-1.5 text-on-surface-variant">
                                <span className="block leading-tight">{dueLabel(r)}</span>
                                {!paidMonth && dueSoon <= 7 ? (
                                  <span className="text-[10px] font-semibold leading-tight text-primary">
                                    {dueSoon === 0 ? "hoje" : `${dueSoon}d`}
                                  </span>
                                ) : null}
                              </td>
                              <td className="whitespace-nowrap px-2 py-1.5 font-bold text-primary">
                                {formatBRL(r.cadence === "anual" ? r.amount / 12 : r.amount)}
                                {r.cadence === "anual" ? (
                                  <span className="font-normal text-on-surface-variant">/m</span>
                                ) : null}
                              </td>
                              <td className="max-w-[100px] truncate px-2 py-1.5 text-[10px] text-on-surface-variant">
                                {cardHint ?? "—"}
                              </td>
                              <td className="px-2 py-1.5">
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none ${
                                    st === "vencendo"
                                      ? "bg-error-container text-error"
                                      : st === "pago"
                                        ? "bg-secondary-container text-on-secondary-container"
                                        : "bg-tertiary-fixed/30 text-on-tertiary-fixed-variant"
                                  }`}
                                >
                                  {stLabel}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => toggleRecurringPaid(r.id, mk)}
                                  className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                                    paidMonth
                                      ? "border border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                                      : "bg-secondary text-on-secondary-container hover:bg-secondary/90"
                                  }`}
                                >
                                  {paidMonth ? "Desmarcar" : "Marcar pago"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : filteredReceivables.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <span className="material-symbols-outlined mb-4 text-6xl text-outline-variant/50">payments</span>
                  <p className="font-headline text-lg font-bold text-primary">
                    {tableFilter === "liquidados"
                      ? "Nenhuma conta liquidada."
                      : "Nenhuma conta a receber."}
                  </p>
                  <p className="mt-2 max-w-md text-sm text-on-surface-variant">
                    {tableFilter === "liquidados"
                      ? "Quando você liquidar ou quitar uma entrada, ela aparece aqui ou em “Todos”."
                      : "Registre salário, aluguel, dividendos ou cobranças. Ajuste o filtro ou inclua uma nova receita."}
                  </p>
                  {tableFilter === "liquidados" ? (
                    <button
                      type="button"
                      onClick={() => setTableFilter("todos")}
                      className="mt-6 text-sm font-bold text-primary underline-offset-4 hover:underline"
                    >
                      Ver todos
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFormOpen(true)}
                      className="mt-6 text-sm font-bold text-primary underline-offset-4 hover:underline"
                    >
                      Nova receita
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-outline-variant/10">
                  <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-outline-variant/15 bg-surface-container-high/40">
                        <th className="w-8 px-1 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant" />
                        <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                          Descrição
                        </th>
                        <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                          Cat.
                        </th>
                        <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                          Venc.
                        </th>
                        <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                          Total
                        </th>
                        <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                          Aberto
                        </th>
                        <th className="px-2 py-1.5 font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                          Sit.
                        </th>
                        <th className="px-1 py-1.5 text-right font-bold text-[10px] uppercase tracking-wide text-on-surface-variant">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReceivables.map((r) => {
                        const isPaid = r.status === "pago";
                        const overdue = isReceivableOverdue(r);
                        const badge = receivableUrgentLabel(r);
                        const recv = receivedTotal(r);
                        const rest = receivableRemaining(r);
                        const pct = r.amount > 0 ? Math.min(100, Math.round((recv / r.amount) * 100)) : 0;
                        return (
                          <tr
                            key={r.id}
                            className={`border-b border-outline-variant/10 transition-colors hover:bg-surface-container-low/70 ${isPaid ? "bg-surface-container-high/25" : ""}`}
                          >
                            <td className="px-1 py-1 align-middle">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[9px] font-bold text-primary">
                                {initials(r.debtorName)}
                              </div>
                            </td>
                            <td className="max-w-[120px] px-2 py-1 align-middle">
                              <span className="line-clamp-2 font-semibold leading-tight text-primary">{r.debtorName}</span>
                              {r.installmentMode ? (
                                <span className="block truncate text-[9px] leading-tight text-on-surface-variant">
                                  Cartão{r.installmentCount ? ` ${r.installmentCount}x` : ""}
                                </span>
                              ) : null}
                            </td>
                            <td className="max-w-[68px] truncate px-2 py-1 align-middle text-on-surface-variant">
                              {r.incomeCategory ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 align-middle text-on-surface-variant">
                              {formatDateShort(r.dueDate)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 align-middle font-medium text-on-surface">
                              {formatBRL(r.amount)}
                            </td>
                            <td className="px-2 py-1 align-middle">
                              <div className="font-bold leading-none text-primary">{formatBRL(rest)}</div>
                              <div className="mt-0.5 h-0.5 max-w-[72px] overflow-hidden rounded-full bg-surface-container-high">
                                <div className="h-full rounded-full bg-secondary" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[9px] leading-none text-on-surface-variant">{pct}%</span>
                            </td>
                            <td className="px-2 py-1 align-middle">
                              {isPaid ? (
                                <div className="max-w-[80px]">
                                  <span
                                    className="inline-block max-w-[76px] truncate rounded px-1 py-0.5 text-[9px] font-bold uppercase leading-none bg-secondary-container text-on-secondary-container"
                                    title="Liquidado"
                                  >
                                    Liquidado
                                  </span>
                                  {r.paidAt ? (
                                    <span className="mt-0.5 block text-[9px] leading-tight text-on-surface-variant">
                                      {formatDateShort(r.paidAt)}
                                    </span>
                                  ) : null}
                                </div>
                              ) : badge ? (
                                <span
                                  className={`inline-block max-w-[72px] truncate rounded px-1 py-0.5 text-[9px] font-bold uppercase leading-none ${
                                    overdue ? "bg-error-container text-error" : "bg-surface-container-high text-on-surface-variant"
                                  }`}
                                  title={badge}
                                >
                                  {badge}
                                </span>
                              ) : (
                                <span className="text-on-surface-variant">—</span>
                              )}
                            </td>
                            <td className="px-1 py-1 align-middle">
                              <div className="flex flex-nowrap justify-end gap-px">
                                {isSalaryIncomeCategory(r.incomeCategory ?? "") && r.payslipAttachmentDataUrl ? (
                                  <a
                                    href={r.payslipAttachmentDataUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Holerite"
                                    className="rounded p-1 text-primary hover:bg-surface-container-high"
                                  >
                                    <span className="material-symbols-outlined text-[17px]">description</span>
                                  </a>
                                ) : null}
                                {!isPaid ? (
                                  <>
                                    <button
                                      type="button"
                                      title="WhatsApp"
                                      className="rounded p-1 text-primary hover:bg-surface-container-high"
                                      onClick={() => cobrarWhatsApp(r)}
                                    >
                                      <span className="material-symbols-outlined text-[17px]">send</span>
                                    </button>
                                    <button
                                      type="button"
                                      title="Parcial"
                                      className="rounded p-1 text-secondary hover:bg-surface-container-high"
                                      onClick={() => setPartialFor(r)}
                                    >
                                      <span className="material-symbols-outlined text-[17px]">payments</span>
                                    </button>
                                    <button
                                      type="button"
                                      title="Liquidar na conta (data = vencimento)"
                                      className="rounded p-1 text-primary hover:bg-surface-container-high"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Registrar ${formatBRL(rest)} na conta principal com data ${formatDateShort(r.dueDate)} (vencimento)?`
                                          )
                                        ) {
                                          receiveReceivable(r.id, { registerIncome: true });
                                        }
                                      }}
                                    >
                                      <span className="material-symbols-outlined text-[17px]">check_circle</span>
                                    </button>
                                    <button
                                      type="button"
                                      title="Quitar sem lançamento (data = vencimento)"
                                      className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Marcar ${formatBRL(rest)} como recebidos em ${formatDateShort(r.dueDate)} sem lançamento na conta?`
                                          )
                                        ) {
                                          receiveReceivable(r.id, { registerIncome: false });
                                        }
                                      }}
                                    >
                                      <span className="material-symbols-outlined text-[17px]">done_all</span>
                                    </button>
                                  </>
                                ) : null}
                                <button
                                  type="button"
                                  title="Excluir"
                                  className="rounded p-1 text-error hover:bg-error-container/20"
                                  onClick={() => {
                                    if (window.confirm("Excluir esta entrada?")) deleteReceivable(r.id);
                                  }}
                                >
                                  <span className="material-symbols-outlined text-[17px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {mainTab === "receber" && (
            <div className="mt-6 rounded-xl border border-secondary/15 bg-secondary-container/15 p-4 print:hidden">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                Recuperado no mês
              </p>
              <p className="mt-1 font-headline text-2xl font-extrabold text-on-secondary-container">
                {formatBRL(recuperadoMes)}
              </p>
              <div className="mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-secondary-container/40">
                <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${barPct}%` }} />
              </div>
              <p className="mt-1 text-[10px] font-bold uppercase text-on-secondary-container/70">{barPct}% do mês</p>
            </div>
          )}
        </div>

        <aside className="w-full shrink-0 rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 lg:w-[300px] print:hidden">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-headline font-bold text-primary">Últimas entradas</h3>
            <span className="material-symbols-outlined text-on-surface-variant">history</span>
          </div>
          {recentIncomingFeed.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              Nada aqui ainda: aparece ao liquidar uma{" "}
              <strong className="text-on-surface">conta a receber</strong> ou ao incluir uma{" "}
              <strong className="text-on-surface">receita nos lançamentos</strong>.
            </p>
          ) : (
            <div className="space-y-5">
              {recentIncomingFeed.map((row) => (
                <div key={row.key} className="relative border-l-2 border-secondary/25 pl-5">
                  <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-secondary ring-2 ring-white dark:ring-slate-800" />
                  <p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
                    {row.source === "cobrança" ? "Cobrança" : "Conta corrente"}
                  </p>
                  <p className="text-xs font-bold text-primary">{row.title}</p>
                  <p className="font-headline text-base font-bold text-secondary">{formatBRL(row.amount)}</p>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">{formatRelativePaid(row.date)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 border-t border-outline-variant/10 pt-5">
            <p className="text-xs font-bold text-primary">Dica</p>
            <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
              Filtros <strong className="text-on-surface">Pendentes</strong> destacam vencimentos próximos ou em atraso;{" "}
              <strong className="text-on-surface">Agendados</strong> são os demais em aberto.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
