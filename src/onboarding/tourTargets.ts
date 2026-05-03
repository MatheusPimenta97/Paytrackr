/** Primeiro elemento que casa com `selector` e está visível no viewport (mobile vs desktop duplicado). */
export function queryVisibleTourTarget(selector: string): Element | undefined {
  const list = document.querySelectorAll(selector);
  for (let i = 0; i < list.length; i++) {
    const el = list[i];
    if (!(el instanceof HTMLElement)) continue;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return undefined;
}
