import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  suggestedName: string;
  onComplete: (name: string) => void;
};

/** Primeiro acesso com Firebase: pede como quer ser chamado antes do restante da jornada. */
export function WelcomeOnboardingModal({ open, suggestedName, onComplete }: Props) {
  const [name, setName] = useState(suggestedName);

  useEffect(() => {
    if (open) setName(suggestedName);
  }, [open, suggestedName]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    onComplete(trimmed.length >= 2 ? trimmed : suggestedName.trim() || "Amigo");
  }

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-[#001430]/55 p-4 backdrop-blur-[2px] dark:bg-black/60">
      <div
        className="welcome-pop relative w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#002855] to-[#001430] p-8 shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="welcome-title"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-secondary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-sky-400/15 blur-3xl" />

        <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-secondary">PayTrackr</p>
        <h2 id="welcome-title" className="relative mt-3 font-headline text-2xl font-extrabold text-white">
          Bem-vindo!
        </h2>
        <p className="relative mt-2 text-sm leading-relaxed text-white/85">
          Vamos personalizar sua experiência. Como você quer ser chamado no app?
        </p>

        <form className="relative mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="welcome-name" className="mb-1 block text-xs font-semibold text-white/70">
              Seu nome ou apelido
            </label>
            <input
              id="welcome-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Matheus"
              className="h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-base font-medium text-white outline-none placeholder:text-white/40 focus:border-secondary focus:ring-2 focus:ring-secondary/40"
            />
          </div>
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-secondary font-headline text-base font-bold text-on-secondary shadow-lg transition hover:opacity-95 active:scale-[0.99]"
          >
            Continuar
          </button>
        </form>

        <style>{`
          @keyframes welcome-pop-in {
            from {
              opacity: 0;
              transform: scale(0.94) translateY(12px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          .welcome-pop {
            animation: welcome-pop-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }
        `}</style>
      </div>
    </div>
  );
}
