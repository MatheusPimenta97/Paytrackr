import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { useTheme } from "../context/ThemeContext";
import { imageFileToProfilePhotoDataUrl } from "../domain/profilePhoto";
import { parseMoneyInput } from "../domain/money";

export function ProfilePage() {
  const { state, updateProfile } = useFinance();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [salaryRaw, setSalaryRaw] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    setDisplayName(state.profile.displayName);
    setSalaryRaw(
      state.profile.monthlySalary > 0
        ? String(state.profile.monthlySalary).replace(".", ",")
        : ""
    );
  }, [state.profile.displayName, state.profile.monthlySalary]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = displayName.trim();
    if (!name) {
      setError("Informe como quer ser chamado(a).");
      return;
    }
    const sal = salaryRaw.trim() ? parseMoneyInput(salaryRaw) : 0;
    if (salaryRaw.trim() && (sal === null || sal < 0)) {
      setError("Salário inválido.");
      return;
    }
    updateProfile({
      displayName: name,
      monthlySalary: sal === null ? 0 : sal,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(null);
    setPhotoBusy(true);
    try {
      const dataUrl = await imageFileToProfilePhotoDataUrl(f);
      updateProfile({ photoDataUrl: dataUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível usar esta imagem.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto() {
    setError(null);
    updateProfile({ photoDataUrl: null });
  }

  return (
    <div className="mx-auto max-w-lg px-6 pb-12 md:px-12">
      <p className="mb-4">
        <Link
          to="/"
          className="text-sm font-semibold text-secondary underline-offset-2 hover:underline"
        >
          ← Voltar ao painel
        </Link>
        <span className="mx-2 text-on-surface-variant">·</span>
        <Link
          to="/settings"
          className="text-sm font-semibold text-on-surface-variant underline-offset-2 hover:underline"
        >
          Configurações
        </Link>
      </p>
      <h1 className="mb-2 font-headline text-3xl font-extrabold text-primary">Meu perfil</h1>
      <p className="mb-8 text-sm text-on-surface-variant">
        Seu nome aparece nas saudações do app. O salário mensal é só referência sua (não altera
        lançamentos); útil para comparar com a receita registrada no mês. A foto é salva neste
        aparelho (dados locais).
      </p>

      <div className="mb-6 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 dark:border-slate-600/40 dark:bg-slate-800/80">
        <h2 className="mb-3 font-headline text-lg font-bold text-primary">Aparência</h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          Tema claro ou escuro em todo o app. A preferência fica salva neste navegador.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors ${
              theme === "light"
                ? "border-secondary bg-secondary-container/40 text-on-secondary-container"
                : "border-outline-variant/40 bg-surface-container-high text-on-surface-variant hover:border-outline-variant"
            } dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-200 dark:hover:bg-slate-700`}
          >
            <span className="material-symbols-outlined text-[20px]">light_mode</span>
            Claro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors ${
              theme === "dark"
                ? "border-secondary bg-secondary-container/40 text-on-secondary-container"
                : "border-outline-variant/40 bg-surface-container-high text-on-surface-variant hover:border-outline-variant"
            } dark:border-teal-700/60 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600`}
          >
            <span className="material-symbols-outlined text-[20px]">dark_mode</span>
            Escuro
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 dark:border-slate-600/40 dark:bg-slate-800/80">
        <h2 className="mb-4 font-headline text-lg font-bold text-primary">Foto do perfil</h2>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 border-[#5eead4] bg-gradient-to-b from-zinc-600 to-zinc-950 shadow-md">
            {state.profile.photoDataUrl ? (
              <img
                src={state.profile.photoDataUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center text-white">
                <span className="material-symbols-outlined text-4xl opacity-90">person</span>
              </div>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onPhotoSelected}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => fileRef.current?.click()}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary/90 disabled:opacity-60"
              >
                {photoBusy ? "Processando…" : "Escolher foto"}
              </button>
              {state.profile.photoDataUrl && (
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={removePhoto}
                  className="rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-surface-container disabled:opacity-60"
                >
                  Remover foto
                </button>
              )}
            </div>
            <p className="text-xs text-on-surface-variant">
              JPG, PNG ou WebP. A imagem é redimensionada para caber no armazenamento local do
              navegador.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="space-y-5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6"
      >
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Nome ou apelido
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ex.: Matheus"
            className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2.5 text-primary outline-none ring-primary/30 focus:ring-2"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Salário mensal (R$)
          </label>
          <input
            value={salaryRaw}
            onChange={(e) => setSalaryRaw(e.target.value)}
            placeholder="Opcional — ex.: 8.500,00"
            inputMode="decimal"
            className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2.5 text-primary outline-none ring-primary/30 focus:ring-2"
          />
          <p className="mt-2 text-xs text-on-surface-variant">
            Valor atual salvo:{" "}
            <span className="font-semibold text-primary">
              {state.profile.monthlySalary > 0
                ? formatBRL(state.profile.monthlySalary)
                : "não informado"}
            </span>
          </p>
        </div>
        {error && <p className="text-sm font-medium text-error">{error}</p>}
        {saved && (
          <p className="text-sm font-medium text-secondary" role="status">
            Alterações salvas.
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary/90 sm:w-auto sm:px-8"
        >
          Salvar perfil
        </button>
      </form>
    </div>
  );
}
