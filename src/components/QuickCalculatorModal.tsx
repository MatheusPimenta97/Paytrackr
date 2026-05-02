import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

function applyOp(a: number, b: number, op: string): number {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? 0 : a / b;
    default:
      return b;
  }
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded).replace(".", ",");
}

function parseDisplay(s: string): number {
  const normalized = s.replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function QuickCalculatorModal({ open, onClose }: Props) {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  const resetAll = useCallback(() => {
    setDisplay("0");
    setPrev(null);
    setOp(null);
    setFresh(true);
  }, []);

  const digit = useCallback(
    (d: string) => {
      if (d === ",") {
        if (fresh) {
          setDisplay("0,");
          setFresh(false);
          return;
        }
        setDisplay((x) => (x.includes(",") ? x : `${x},`));
        return;
      }
      if (fresh) {
        setDisplay(d);
        setFresh(false);
      } else {
        setDisplay((x) => (x === "0" ? d : x + d));
      }
    },
    [fresh]
  );

  const pressOperator = useCallback(
    (nextOp: string) => {
      const n = parseDisplay(display);
      if (prev !== null && op !== null && !fresh) {
        const r = applyOp(prev, n, op);
        setDisplay(formatNum(r));
        setPrev(r);
      } else {
        setPrev(n);
      }
      setOp(nextOp);
      setFresh(true);
    },
    [display, fresh, op, prev]
  );

  const equals = useCallback(() => {
    if (op === null || prev === null) return;
    const n = parseDisplay(display);
    const r = applyOp(prev, n, op);
    setDisplay(formatNum(r));
    setPrev(null);
    setOp(null);
    setFresh(true);
  }, [display, op, prev]);

  const backspace = useCallback(() => {
    if (fresh) return;
    setDisplay((x) => (x.length <= 1 ? "0" : x.slice(0, -1)));
  }, [fresh]);

  useEffect(() => {
    if (open) resetAll();
  }, [open, resetAll]);

  const apiRef = useRef({
    digit,
    pressOperator,
    equals,
    backspace,
    resetAll,
    onClose,
  });
  apiRef.current = { digit, pressOperator, equals, backspace, resetAll, onClose };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const a = apiRef.current;

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        a.digit(e.key);
        return;
      }

      if (e.key === "," || e.key === "." || e.code === "NumpadDecimal") {
        e.preventDefault();
        a.digit(",");
        return;
      }

      if (e.key === "+" || e.code === "NumpadAdd") {
        e.preventDefault();
        a.pressOperator("+");
        return;
      }
      if (e.key === "-" || e.code === "NumpadSubtract") {
        e.preventDefault();
        a.pressOperator("−");
        return;
      }
      if (e.key === "*" || e.code === "NumpadMultiply") {
        e.preventDefault();
        a.pressOperator("×");
        return;
      }
      if (e.key === "/" || e.code === "NumpadDivide") {
        e.preventDefault();
        a.pressOperator("÷");
        return;
      }

      if (e.key === "Enter" || e.code === "NumpadEnter" || e.key === "=") {
        e.preventDefault();
        a.equals();
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        a.backspace();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        a.onClose();
        return;
      }

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        a.resetAll();
        return;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!open) return null;

  const btn =
    "flex min-h-[48px] items-center justify-center rounded-xl text-lg font-bold transition-colors active:scale-[0.98]";
  const num = `${btn} bg-white/10 text-white hover:bg-white/20`;
  const fn = `${btn} bg-[#255dad] text-white hover:bg-[#1e4a8a]`;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-primary/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div
        className="relative w-full max-w-[280px] overflow-hidden rounded-2xl border border-outline-variant/20 bg-[#1a1f2e] p-3 shadow-2xl"
        role="dialog"
        aria-modal
        aria-label="Calculadora rápida"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 px-1 text-[10px] leading-tight text-white/40">
          Use o teclado (incl. numérico): dígitos, + − * /, Enter, vírgula/ponto, Backspace, C, Esc.
        </p>
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-white/50">Calculadora</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Fechar calculadora"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="mb-3 min-h-[52px] rounded-xl bg-black/30 px-3 py-2 text-right font-mono text-3xl font-semibold tabular-nums text-white">
          {display}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button type="button" className={`${num} text-amber-300`} onClick={resetAll}>
            C
          </button>
          <button type="button" className={num} onClick={backspace}>
            ⌫
          </button>
          <button type="button" className={fn} onClick={() => pressOperator("÷")}>
            ÷
          </button>
          <button type="button" className={fn} onClick={() => pressOperator("×")}>
            ×
          </button>

          {(["7", "8", "9"] as const).map((d) => (
            <button key={d} type="button" className={num} onClick={() => digit(d)}>
              {d}
            </button>
          ))}
          <button type="button" className={fn} onClick={() => pressOperator("−")}>
            −
          </button>

          {(["4", "5", "6"] as const).map((d) => (
            <button key={d} type="button" className={num} onClick={() => digit(d)}>
              {d}
            </button>
          ))}
          <button type="button" className={fn} onClick={() => pressOperator("+")}>
            +
          </button>

          {(["1", "2", "3"] as const).map((d) => (
            <button key={d} type="button" className={num} onClick={() => digit(d)}>
              {d}
            </button>
          ))}
          <button type="button" className={`${btn} bg-[#1b6d24] text-white hover:bg-[#155c1d]`} onClick={equals}>
            =
          </button>

          <button type="button" className={`${num} col-span-2`} onClick={() => digit("0")}>
            0
          </button>
          <button type="button" className={num} onClick={() => digit(",")}>
            ,
          </button>
        </div>
      </div>
    </div>
  );
}
