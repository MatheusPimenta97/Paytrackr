import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ContributeGoalModal } from "../components/ContributeGoalModal";
import { GoalFormModal } from "../components/GoalFormModal";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { formatDateShort } from "../domain/money";

function kindBadge(kind: string) {
  switch (kind) {
    case "long_term":
      return {
        className:
          "rounded-[9999px] bg-surface-container-high px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant",
        label: "Long Term",
      };
    case "attention":
      return {
        className:
          "rounded-[9999px] bg-error-container px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-error-container",
        label: "Attention",
      };
    default:
      return {
        className:
          "rounded-[9999px] bg-secondary-container px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-secondary-container",
        label: "On Track",
      };
  }
}

export function MetasPage() {
  const {
    state,
    portfolioCompletion,
    vestedTotal,
    targetTotal,
    nextMilestoneGoal,
    nextMilestoneGap,
  } = useFinance();
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);

  const goalTx = useMemo(
    () =>
      state.transactions
        .filter((t) => t.goalId && t.amount < 0)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [state.transactions]
  );

  return (
    <>
      <GoalFormModal open={goalFormOpen} onClose={() => setGoalFormOpen(false)} />
      <ContributeGoalModal
        open={!!contributeGoalId}
        goalId={contributeGoalId}
        onClose={() => setContributeGoalId(null)}
      />

      <header className="mx-auto mb-12 max-w-7xl px-6 md:px-12">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="mb-2 block text-sm font-bold uppercase tracking-[0.2em] text-on-surface-variant/70">
              Strategic Capital
            </span>
            <h1 className="font-headline text-5xl font-extrabold tracking-tight text-primary">
              Financial Metas
            </h1>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl bg-surface-container-high px-6 py-3 font-bold text-primary transition-all hover:bg-surface-container-highest"
            >
              <span className="material-symbols-outlined">filter_list</span>
              Filter
            </button>
            <button
              type="button"
              onClick={() => setGoalFormOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container px-6 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="material-symbols-outlined">add</span>
              New Goal
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="group relative overflow-hidden rounded-full bg-surface-container-low p-8 md:col-span-8 md:rounded-xl">
            <div className="absolute right-0 top-0 p-8 opacity-10 transition-opacity group-hover:opacity-20">
              <span className="material-symbols-outlined text-[120px] text-primary">
                account_balance_wallet
              </span>
            </div>
            <div className="relative z-10">
              <h2 className="mb-1 font-headline text-2xl font-bold text-primary">Portfolio Completion</h2>
              <p className="mb-8 font-medium text-on-surface-variant">
                You are currently at{" "}
                <span className="font-bold text-secondary">{portfolioCompletion.toFixed(1)}%</span> of your
                total financial milestones.
              </p>
              <div className="flex flex-wrap gap-12">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
                    Total Target
                  </p>
                  <p className="font-headline text-3xl font-extrabold text-primary">
                    {formatBRL(targetTotal)}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
                    Currently Vested
                  </p>
                  <p className="font-headline text-3xl font-extrabold text-secondary">
                    {formatBRL(vestedTotal)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl bg-secondary p-8 text-on-secondary shadow-xl shadow-secondary/10 md:col-span-4">
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                <span className="material-symbols-outlined filled text-white">celebration</span>
              </div>
              <h3 className="mb-2 font-headline text-xl font-bold">Next Milestone</h3>
              <p className="text-sm leading-relaxed text-white/80">
                {nextMilestoneGoal ? (
                  <>
                    Sua meta &quot;{nextMilestoneGoal.title}&quot; está a{" "}
                    <span className="font-bold">{formatBRL(nextMilestoneGap)}</span> do alvo.
                  </>
                ) : (
                  "Todas as metas atingidas ou sem metas cadastradas."
                )}
              </p>
            </div>
            <button
              type="button"
              disabled={!nextMilestoneGoal}
              onClick={() => nextMilestoneGoal && setContributeGoalId(nextMilestoneGoal.id)}
              className="mt-8 rounded-lg bg-white px-4 py-3 text-sm font-bold text-secondary transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Complete Now
            </button>
          </div>

          {state.goals.map((g) => {
            const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
            const badge = kindBadge(g.kind);
            const barClass =
              g.kind === "attention" ? "bg-error" : g.kind === "long_term" ? "bg-primary opacity-80" : "bg-secondary";
            return (
              <div
                key={g.id}
                className="rounded-xl bg-surface-container-lowest p-6 transition-all hover:-translate-y-1 md:col-span-4"
              >
                <div className="mb-8 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container text-primary">
                    <span className="material-symbols-outlined filled">{g.icon}</span>
                  </div>
                  <span className={badge.className}>{badge.label}</span>
                </div>
                <h4 className="mb-1 font-headline text-xl font-extrabold text-primary">{g.title}</h4>
                <p className="mb-6 text-xs font-medium text-on-surface-variant">{g.subtitle}</p>
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <p className="font-headline text-2xl font-bold text-primary">{formatBRL(g.current)}</p>
                    <p className="text-xs font-bold text-on-surface-variant/60">
                      Target: {formatBRL(g.target)}
                    </p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                    <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p
                    className={`flex items-center gap-1 text-[10px] font-bold ${
                      g.kind === "attention"
                        ? "text-error"
                        : g.kind === "long_term"
                          ? "text-on-surface-variant"
                          : "text-secondary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {g.kind === "attention" ? "warning" : g.kind === "long_term" ? "update" : "trending_up"}
                    </span>
                    {g.trendLabel}
                  </p>
                  <button
                    type="button"
                    onClick={() => setContributeGoalId(g.id)}
                    className="w-full rounded-lg border border-outline-variant/30 py-2 text-xs font-bold text-primary hover:bg-surface-container-low"
                  >
                    Aportar
                  </button>
                </div>
              </div>
            );
          })}

          <div className="mt-12 md:col-span-12">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-headline text-2xl font-bold text-primary">
                Transaction History for Goals
              </h3>
              <Link
                to="/lancamentos"
                className="text-sm font-bold text-primary underline decoration-2 underline-offset-4 hover:opacity-80"
              >
                View All Ledger Logs
              </Link>
            </div>
            <div className="overflow-hidden rounded-2xl bg-surface-container-low">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="bg-surface-container-high/50">
                      <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/80 md:px-8">
                        Date
                      </th>
                      <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/80 md:px-8">
                        Assigned Goal
                      </th>
                      <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/80 md:px-8">
                        Source Account
                      </th>
                      <th className="px-6 py-5 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/80 md:px-8">
                        Contribution
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {goalTx.map((row) => {
                      const gMeta = row.goalId ? state.goals.find((x) => x.id === row.goalId) : undefined;
                      const dot =
                        row.goalId === "g-emergency"
                          ? "bg-secondary"
                          : row.goalId === "g-wealth"
                            ? "bg-primary"
                            : "bg-error";
                      const gTitle = gMeta?.title ?? row.goalId ?? "";
                      return (
                        <tr
                          key={row.id}
                          className="transition-colors hover:bg-surface-container-highest"
                        >
                          <td className="px-6 py-6 text-sm font-medium text-primary md:px-8">
                            {formatDateShort(row.date)}
                          </td>
                          <td className="px-6 py-6 md:px-8">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 shrink-0 rounded-[9999px] ${dot}`} />
                              <span className="text-sm font-bold text-primary">{gTitle}</span>
                            </div>
                          </td>
                          <td className="px-6 py-6 text-sm text-on-surface-variant md:px-8">
                            Checking •••• 4291
                          </td>
                          <td className="px-6 py-6 text-right font-headline text-sm font-extrabold text-secondary md:px-8">
                            {formatBRL(Math.abs(row.amount), { showSign: true })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {goalTx.length === 0 && (
                  <p className="py-10 text-center text-sm text-on-surface-variant">
                    Nenhum aporte vinculado a metas. Use &quot;Novo lançamento&quot; com meta ou
                    &quot;Aportar&quot;.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
