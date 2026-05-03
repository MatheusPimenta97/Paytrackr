import { parseMoneyInput } from "./money";
import type { TxnPaymentMethod } from "./types";

export function isAllowedPaymentReceiptDataUrl(url: string): boolean {
  return (
    url.startsWith("data:application/pdf") ||
    url.startsWith("data:image/png") ||
    url.startsWith("data:image/jpeg") ||
    url.startsWith("data:image/jpg") ||
    url.startsWith("data:image/webp")
  );
}

function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavra “forte” do nome (evita match em “DE”, “DA”…). */
function significantWords(displayName: string): string[] {
  return normalizeForMatch(displayName)
    .split(" ")
    .filter((w) => w.length >= 4);
}

function nameMatchesDisplay(nameBlock: string, displayName: string): boolean {
  const words = significantWords(displayName);
  if (words.length === 0) return false;
  const block = normalizeForMatch(nameBlock);
  return words.some((w) => block.includes(w));
}

function getSection(markdown: string, heading: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingRe = new RegExp(`^##\\s*${esc}\\b`, "i");
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i].trim();
    if (headingRe.test(raw)) {
      i++;
      const buf: string[] = [];
      while (i < lines.length && !/^\s*##\s+\S/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      const joined = buf.join("\n").trim();
      return joined.length ? joined : null;
    }
    i++;
  }
  return null;
}

function firstBrlAmount(text: string): number | null {
  const m = text.match(/R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+(?:\.\d{2})?)/i);
  if (!m?.[1]) return null;
  const n = parseMoneyInput(m[1].trim());
  return n != null && n > 0 ? n : null;
}

function firstDdMmYyyy(text: string): string | null {
  const m = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yyyy = parseInt(m[3], 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return iso;
}

function stripDeParaPrefix(line: string): string {
  let s = line.replace(/\*+/g, "").trim();
  s = s.replace(/^de:\s*/i, "").replace(/^para:\s*/i, "").trim();
  return s;
}

function extractParticipantName(participantsSection: string, label: "**De:**" | "**Para:**"): string {
  const key = label === "**De:**" ? "De" : "Para";
  let rest: string;
  const at = participantsSection.indexOf(label);
  if (at !== -1) {
    rest = participantsSection.slice(at + label.length);
  } else {
    const re = new RegExp(`(^|[\\n])\\s*\\*{0,2}${key}:\\*{0,2}\\s*`, "im");
    const m = re.exec(participantsSection);
    if (!m) return "";
    rest = participantsSection.slice(m.index + m[0].length);
  }
  const lines = rest.split(/\n/);
  for (const raw of lines) {
    const line = raw.replace(/\*+/g, "").trim();
    if (!line) continue;
    if (line.startsWith("**") && !line.toLowerCase().startsWith("**de") && !line.toLowerCase().startsWith("**para"))
      break;
    if (/^##\s/.test(line)) break;
    if (/^cpf:/i.test(line)) continue;
    if (/^instituição:/i.test(line)) continue;
    if (/^chave pix:/i.test(line)) continue;
    if (/^agência/i.test(line)) continue;
    if (/^conta/i.test(line)) continue;
    const name = stripDeParaPrefix(line);
    if (name.length >= 2) return name.slice(0, 120);
  }
  return "";
}

function paymentMethodFromTipo(tipo: string): TxnPaymentMethod {
  const t = tipo.toLowerCase();
  if (t.includes("pix")) return "pix";
  if (t.includes("boleto")) return "boleto";
  return "conta";
}

export type ParsedAiReceipt = {
  amountAbs: number;
  dateIso: string;
  paymentMethod: TxnPaymentMethod;
  flow: "expense" | "income";
  description: string;
};

export function parseAiReceiptMarkdown(
  markdown: string,
  userDisplayName: string
): { ok: true; data: ParsedAiReceipt } | { ok: false; error: string } {
  const md = markdown.trim();
  if (!md) return { ok: false, error: "Texto vazio." };

  const valorSec = getSection(md, "Valor") ?? "";
  const dataSec = getSection(md, "Data") ?? "";
  const tipoSec = (getSection(md, "Tipo da Operação") ?? "").split("\n")[0]?.trim() ?? "";
  const participants = getSection(md, "Participantes") ?? "";

  const amountAbs =
    firstBrlAmount(valorSec) ?? firstBrlAmount(md) ?? (parseMoneyInput(valorSec) ?? null);
  if (amountAbs == null || amountAbs <= 0) {
    return { ok: false, error: "Não encontrei um valor em R$ no resultado." };
  }

  const dateIso = firstDdMmYyyy(dataSec) ?? firstDdMmYyyy(md);
  if (!dateIso) {
    return { ok: false, error: "Não encontrei a data (dd/mm/aaaa) no resultado." };
  }

  let paymentMethod = paymentMethodFromTipo(tipoSec || md);
  if (paymentMethod === "conta" && /\bpix\b|chave\s*pix|end-to-end/i.test(participants + md)) {
    paymentMethod = "pix";
  }
  const deName = extractParticipantName(participants, "**De:**");
  const paraName = extractParticipantName(participants, "**Para:**");

  let flow: "expense" | "income" = "expense";
  const trimmedUser = userDisplayName.trim();
  if (trimmedUser) {
    const userInDe = nameMatchesDisplay(deName, trimmedUser);
    const userInPara = nameMatchesDisplay(paraName, trimmedUser);
    if (userInPara && !userInDe) flow = "income";
    else if (userInDe && !userInPara) flow = "expense";
    else if (userInPara && userInDe) flow = "expense";
  }

  const tipoShort = tipoSec.replace(/\*+/g, "").trim() || "Pagamento";
  let description: string;
  if (paymentMethod === "pix") {
    description =
      flow === "income"
        ? `Pix recebido${deName ? ` — ${deName}` : ""}`
        : `Pix enviado${paraName ? ` — ${paraName}` : ""}`;
  } else {
    const who = flow === "income" ? deName : paraName;
    description = who ? `${tipoShort} — ${who}` : tipoShort;
  }

  return {
    ok: true,
    data: {
      amountAbs,
      dateIso,
      paymentMethod,
      flow,
      description: description.slice(0, 200),
    },
  };
}
