import { useFinance } from "../context/FinanceContext";

/** Ícone (sol / tarde nublada / lua) alinhado à saudação do dia. */
export function GreetingTimeIcon({ className = "" }: { className?: string }) {
  const { greetingIcon } = useFinance();
  return (
    <span
      className={`material-symbols-outlined ${greetingIcon.filled ? "filled" : ""} ${greetingIcon.className} ${className}`.trim()}
      aria-hidden
    >
      {greetingIcon.name}
    </span>
  );
}
