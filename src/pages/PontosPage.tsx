import { useMemo, useState } from "react";
import { LoyaltyProgramModal } from "../components/LoyaltyProgramModal";
import { useFinance } from "../context/FinanceContext";
import { LOYALTY_PRESET } from "../domain/loyaltyPoints";
import { parseMoneyInput } from "../domain/money";
import type { LoyaltyProgram, PointsExpirationBucket } from "../domain/types";
import { newId } from "../domain/id";

const TRAVEL_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAzQr7J7L3A3csHAaUQerdE274TpAQTtv4BbAvPYCdQ_Y3tija8yPVh5Jtc6zM2itKc9n-cvZ0Wpp2S6HaOGs8ewEnNuzdBdJ6es6sXp4kzWzrtX3nzgKdXA0vOuo-HfgK8MCBH8Dexnr7c7NDlVVeLOm7aampbQzDPmMxgQG87JKUdW_oFLoDs5WSwM7LBMSwNOD9deAiijhNeFOOHRezSSapkqDw7tqP_xFi_B0KeX_7fGXhtvXuQrz7J4PdEj5UnH82EOvKvHMM";

function formatPts(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export function PontosPage() {
  const { state, greeting, setPointsSettings, deleteLoyaltyProgram } = useFinance();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LoyaltyProgram | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expRaw, setExpRaw] = useState("");
  const [vppRaw, setVppRaw] = useState("");
  const [bucketOpen, setBucketOpen] = useState(false);
  const [bucketLabel, setBucketLabel] = useState("");
  const [bucketPts, setBucketPts] = useState("");
  const [bucketBar, setBucketBar] = useState("50");
  const [bucketCrit, setBucketCrit] = useState(false);

  const programs = state.loyaltyPrograms;
  const totalPts = useMemo(
    () => programs.reduce((s, p) => s + p.balance, 0),
    [programs]
  );
  const estimatedBrl = totalPts * state.pointsValuePerPoint;

  const openSettings = () => {
    setExpRaw(String(state.pointsExpiring30d).replace(".", ","));
    setVppRaw(String(state.pointsValuePerPoint).replace(".", ","));
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    const exp = parseMoneyInput(expRaw);
    const vpp = parseMoneyInput(vppRaw);
    setPointsSettings({
      pointsExpiring30d: exp !== null ? exp : 0,
      pointsValuePerPoint: vpp !== null && vpp >= 0 ? vpp : 0.02,
    });
    setSettingsOpen(false);
  };

  const addBucket = () => {
    const pts = parseMoneyInput(bucketPts);
    const bar = Math.min(100, Math.max(0, parseInt(bucketBar, 10) || 0));
    if (!bucketLabel.trim() || pts === null) return;
    const row: PointsExpirationBucket = {
      id: newId(),
      label: bucketLabel.trim(),
      points: pts,
      barWidthPct: bar,
      critical: bucketCrit,
    };
    setPointsSettings({ pointsExpirationBuckets: [...state.pointsExpirationBuckets, row] });
    setBucketLabel("");
    setBucketPts("");
    setBucketBar("50");
    setBucketCrit(false);
    setBucketOpen(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 pb-12 md:px-12">
      <LoyaltyProgramModal
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      {settingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fechar"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
            <h3 className="mb-4 font-headline text-lg font-bold text-primary">Resumo de pontos</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                  Pontos a vencer (30 dias)
                </label>
                <input
                  value={expRaw}
                  onChange={(e) => setExpRaw(e.target.value)}
                  className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                  R$ por ponto (estimativa)
                </label>
                <input
                  value={vppRaw}
                  onChange={(e) => setVppRaw(e.target.value)}
                  placeholder="0,02"
                  className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveSettings}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {bucketOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fechar"
            onClick={() => setBucketOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
            <h3 className="mb-4 font-headline text-lg font-bold text-primary">Período de vencimento</h3>
            <div className="space-y-3">
              <input
                value={bucketLabel}
                onChange={(e) => setBucketLabel(e.target.value)}
                placeholder="Ex.: Outubro (crítico)"
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              />
              <input
                value={bucketPts}
                onChange={(e) => setBucketPts(e.target.value)}
                placeholder="Pontos"
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              />
              <input
                value={bucketBar}
                onChange={(e) => setBucketBar(e.target.value)}
                placeholder="Largura barra % (0-100)"
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bucketCrit}
                  onChange={(e) => setBucketCrit(e.target.checked)}
                />
                Crítico
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBucketOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={addBucket}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="mb-10 flex flex-col items-end justify-between gap-6 md:flex-row">
        <div>
          <h1 className="mb-2 font-headline text-4xl font-extrabold tracking-tight text-primary">
            {greeting}, {state.profile.displayName}!
          </h1>
          <p className="max-w-md text-on-surface-variant">
            Controle manual dos seus pontos e milhas. Atualize os saldos quando acumular ou resgatar.
          </p>
        </div>
        <div className="flex flex-wrap items-stretch justify-end gap-2 gap-y-3">
          <div className="flex min-w-[180px] flex-col justify-between rounded-xl bg-surface-container-lowest p-5 shadow-[0px_10px_30px_rgba(7,30,39,0.04)]">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Saldo total
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline text-2xl font-extrabold text-primary">{formatPts(totalPts)}</span>
              <span className="text-xs font-medium text-on-surface-variant">pts</span>
            </div>
          </div>
          <div className="flex min-w-[180px] flex-col justify-between rounded-xl border-l-4 border-error/30 bg-surface-container-lowest p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              A vencer (30d)
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline text-2xl font-extrabold text-error">
                {formatPts(state.pointsExpiring30d)}
              </span>
              <span className="text-xs font-medium text-on-surface-variant">pts</span>
            </div>
          </div>
          <div className="flex min-w-[180px] flex-col justify-between rounded-xl bg-primary p-5 text-white">
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">Estim. valor</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xs font-medium text-white/80">R$</span>
              <span className="font-headline text-2xl font-extrabold">
                {estimatedBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="rounded-xl border border-outline-variant/30 px-4 py-3 text-xs font-bold text-primary hover:bg-surface-container-low"
          >
            Ajustar resumo
          </button>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-4 lg:col-span-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-headline text-xl font-bold text-primary">Programas</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  alert(
                    "Atualize os saldos de cada programa com o botão editar ou inclua um novo programa."
                  )
                }
                className="flex items-center gap-1 text-sm font-bold text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-sm">sync</span>
                Dica
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white"
              >
                Novo programa
              </button>
            </div>
          </div>

          {programs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest/80 p-10 text-center">
              <p className="mb-4 text-on-surface-variant">
                Nenhum programa cadastrado. Adicione Livelo, Esfera, milhas etc.
              </p>
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white"
              >
                Adicionar programa
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {programs.map((p) => {
                const preset = LOYALTY_PRESET[p.accent];
                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-4 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 transition-colors hover:bg-surface-container-low sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full ${preset.bg}`}
                      >
                        {preset.logoUrl ? (
                          <img
                            src={preset.logoUrl}
                            alt=""
                            className="h-full w-full object-contain p-1.5"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span
                            className={`material-symbols-outlined ${preset.text}`}
                            style={
                              p.status === "sincronizando"
                                ? { fontVariationSettings: "'FILL' 1" }
                                : undefined
                            }
                          >
                            {p.icon}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-primary">{p.name}</h3>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              p.status === "sincronizando" ? "animate-pulse bg-outline-variant" : "bg-secondary"
                            }`}
                          />
                          <span
                            className={`text-xs font-semibold uppercase tracking-tighter ${
                              p.status === "sincronizando" ? "text-on-surface-variant" : "text-secondary"
                            }`}
                          >
                            {p.status === "sincronizando" ? "Sincronizando…" : "Ativo"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 sm:text-right">
                      <span className="font-headline text-xl font-extrabold text-primary">
                        {formatPts(p.balance)} <span className="text-xs font-normal text-on-surface-variant">pts</span>
                      </span>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              "https://www.google.com/search?q=resgatar+pontos+" + encodeURIComponent(p.name),
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="rounded-lg px-4 py-1.5 text-xs font-bold text-primary hover:bg-primary/5"
                        >
                          Resgatar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              "https://www.google.com/search?q=transferir+pontos+" + encodeURIComponent(p.name),
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white transition-all hover:shadow-lg"
                        >
                          Transferir
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                          className="text-xs font-bold text-on-surface-variant hover:text-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remover "${p.name}"?`)) deleteLoyaltyProgram(p.id);
                          }}
                          className="text-error hover:underline"
                          aria-label="Excluir"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="col-span-12 space-y-6 lg:col-span-4">
          <div className="relative overflow-hidden rounded-xl bg-primary p-6 text-white">
            <div className="pointer-events-none absolute -right-4 -top-4 opacity-10">
              <span className="material-symbols-outlined text-[7rem]">auto_awesome</span>
            </div>
            <h3 className="mb-4 flex items-center gap-2 font-headline text-lg font-bold">
              <span className="material-symbols-outlined text-secondary-fixed">rocket_launch</span>
              Dicas de bônus
            </h3>
            <div className="relative z-10 space-y-4">
              <div className="cursor-pointer rounded-lg border border-white/10 bg-white/10 p-4 transition-all hover:bg-white/20">
                <div className="mb-1 flex justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary-fixed">
                    Transferência
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-white">
                    Dica
                  </span>
                </div>
                <p className="text-sm font-semibold">Compare bônus entre programas</p>
                <p className="mt-1 text-xs text-white/60">
                  Antes de transferir, confira promoções no site de cada programa.
                </p>
              </div>
              <div className="cursor-pointer rounded-lg border border-white/5 bg-white/10 p-4 transition-all hover:bg-white/20">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-white/60">Planejamento</p>
                <p className="text-sm font-semibold">Milhas para viagem</p>
                <p className="mt-1 text-xs text-white/60">
                  Defina meta de destino e acompanhe o saldo aqui.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-headline font-bold text-primary">
                <span className="material-symbols-outlined text-on-surface-variant">calendar_month</span>
                Vencimentos
              </h3>
              <button
                type="button"
                onClick={() => setBucketOpen(true)}
                className="text-xs font-bold text-secondary hover:underline"
              >
                + período
              </button>
            </div>
            {state.pointsExpirationBuckets.length === 0 ? (
              <div className="space-y-3 rounded-lg border border-outline-variant/20 bg-surface-container-high/30 p-4">
                <p className="text-sm text-on-surface-variant">
                  Nenhum detalhe por mês. Use &quot;Ajustar resumo&quot; para pontos em 30 dias ou adicione
                  períodos.
                </p>
                <div className="relative pt-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded-full bg-error-container px-2 py-1 text-[10px] font-bold uppercase text-error">
                      Próximos 30 dias
                    </span>
                    <span className="text-xs font-bold text-primary">{formatPts(state.pointsExpiring30d)} pts</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-surface-container-low text-xs">
                    <div
                      className="flex flex-col justify-center bg-error"
                      style={{ width: `${Math.min(100, state.pointsExpiring30d > 0 ? 85 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {state.pointsExpirationBuckets.map((b) => (
                  <div key={b.id} className="relative pt-1">
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                          b.critical
                            ? "bg-error-container text-error"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        {b.label}
                      </span>
                      <span className="text-xs font-bold text-primary">{formatPts(b.points)} pts</span>
                    </div>
                    <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-surface-container-low">
                      <div
                        className={b.critical ? "bg-error" : "bg-primary-container"}
                        style={{ width: `${b.barWidthPct}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      className="text-[10px] font-bold text-error hover:underline"
                      onClick={() =>
                        setPointsSettings({
                          pointsExpirationBuckets: state.pointsExpirationBuckets.filter((x) => x.id !== b.id),
                        })
                      }
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="group relative h-40 cursor-pointer overflow-hidden rounded-xl">
            <img
              alt=""
              src={TRAVEL_IMG}
              className="h-full w-full object-cover brightness-50 grayscale transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-primary/40 mix-blend-multiply" />
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-white">Meta de viagem</p>
              <h4 className="text-lg font-bold text-white">Sua próxima classe executiva</h4>
              <div className="mt-2 h-1 w-full rounded-full bg-white/20">
                <div className="h-full w-3/4 rounded-full bg-secondary-fixed" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
