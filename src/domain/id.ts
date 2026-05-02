/**
 * Gera ID estilo UUID. `crypto.randomUUID()` não existe em HTTP na rede local
 * (só HTTPS ou localhost); este helper funciona em qualquer contexto.
 */
export function newId(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = (n: number) => n.toString(16).padStart(2, "0");
  let s = "";
  for (let i = 0; i < 16; i++) s += h(bytes[i]!);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
