import { useState } from "react";
import type { GoalKind } from "../domain/types";
import { parseMoneyInput } from "../domain/money";
import { useFinance } from "../context/FinanceContext";

type Props = {
  open: boolean;
  onClose: () => void;
};

const GOAL_ICONS = ["shield", "potted_plant", "apartment", "savings", "flight", "trending_up"] as const;

export function GoalFormModal({ open, onClose }: Props) {
  const { addGoal } = useFinance();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [targetRaw, setTargetRaw] = useState("");
  const [kind, setKind] = useState<GoalKind>("on_track");
  const [icon, setIcon] = useState<string>("shield");
  const [trendLabel, setTrendLabel] = useState("No caminho");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const target = parseMoneyInput(targetRaw);
    if (!target || target <= 0) {
      setError("Meta inválida.");
      return;
    }
    if (!title.trim()) {
      setError("Informe o nome da meta.");
      return;
    }
    addGoal({
      title: title.trim(),
      subtitle: subtitle.trim() || "—",
      target,
      icon,
      kind,
      trendLabel: trendLabel.trim() || "—",
    });
    setTitle("");
    setSubtitle("");
    setTargetRaw("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-xl bg-surface-container-lowest p-6 shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="goal-form-title"
      >
        <h2 id="goal-form-title" className="mb-4 font-headline text-xl font-bold text-primary">
          Nova meta
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Nome</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Descrição</label>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Valor alvo (R$)</label>
            <input
              value={targetRaw}
              onChange={(e) => setTargetRaw(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Tipo</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as GoalKind)}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              >
                <option value="on_track">No prazo</option>
                <option value="long_term">Longo prazo</option>
                <option value="attention">Atenção</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-on-surface-variant">Ícone</label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
              >
                {GOAL_ICONS.map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-on-surface-variant">Nota de progresso</label>
            <input
              value={trendLabel}
              onChange={(e) => setTrendLabel(e.target.value)}
              className="w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm"
            />
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
              Criar meta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
