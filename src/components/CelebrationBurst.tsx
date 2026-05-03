type Props = {
  active: boolean;
};

/** Celebração breve após confirmar renda (primeiro acesso). */
export function CelebrationBurst({ active }: Props) {
  if (!active) return null;

  const particles = Array.from({ length: 28 }, (_, i) => ({
    key: i,
    delay: `${(i * 37) % 400}ms`,
    left: `${5 + ((i * 17) % 90)}%`,
    hue: 155 + ((i * 11) % 80),
  }));

  return (
    <div
      className="celebration-root fixed inset-0 z-[205] flex items-center justify-center overflow-hidden bg-[#001430]/35 backdrop-blur-[1px]"
      aria-hidden
    >
      {particles.map((p) => (
        <span
          key={p.key}
          className="celebration-dot pointer-events-none absolute bottom-[40%] h-2 w-2 rounded-full opacity-90"
          style={{
            left: p.left,
            backgroundColor: `hsl(${p.hue} 75% 52%)`,
            animationDelay: p.delay,
          }}
        />
      ))}
      <div className="celebration-core relative z-10 flex flex-col items-center gap-3 rounded-3xl bg-white/95 px-10 py-8 shadow-2xl ring-2 ring-secondary/40 dark:bg-slate-900 dark:ring-secondary/30">
        <span className="material-symbols-outlined filled text-6xl text-secondary drop-shadow-sm">
          celebration
        </span>
        <p className="font-headline text-lg font-bold text-[#00224D] dark:text-slate-100">
          Tudo certo!
        </p>
      </div>
      <style>{`
        @keyframes celebration-rise {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-380px) scale(0.35);
            opacity: 0;
          }
        }
        @keyframes celebration-pop {
          0% {
            transform: scale(0.85);
            opacity: 0;
          }
          55% {
            transform: scale(1.06);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .celebration-dot {
          animation: celebration-rise 1.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .celebration-core {
          animation: celebration-pop 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>
    </div>
  );
}
