import { CATEGORY_OPTIONS } from "../domain/categories";

export type StatementAiSuggestedTxn = {
  date: string;
  description: string;
  amount: number;
  category: string;
  installmentNote?: string | null;
};

export type StatementAiResult = {
  ok: boolean;
  markdown: string;
  suggestedTransactions: StatementAiSuggestedTxn[];
  statementTotalGuess: number | null;
  demoMode: boolean;
  raw?: unknown;
};

function stripDataUrlPrefix(dataUrl: string): { base64: string; mimeType: string } {
  const m = /^data:([^;,]+)(;base64)?,(.+)$/s.exec(dataUrl.trim());
  if (!m) return { base64: dataUrl, mimeType: "application/octet-stream" };
  const mime = (m[1] || "application/octet-stream").trim();
  const b64 = m[3] || "";
  return { base64: b64, mimeType: mime };
}

/** Deriva o URL de fatura a partir do endpoint de comprovante (mesma origem, rota plana `/api/statement`). */
export function resolveStatementAssistantEndpoint(): string {
  const base = import.meta.env.VITE_AI_ASSISTANT_URL?.trim();
  if (base) {
    const normalized = base.replace(/\/$/, "");
    if (/\/receipt\/?$/i.test(normalized)) {
      return normalized.replace(/\/receipt\/?$/i, "/statement");
    }
    if (/\/image\/?$/i.test(normalized)) {
      return normalized.replace(/\/image\/?$/i, "/statement");
    }
    return `${normalized}/statement`;
  }
  if (import.meta.env.DEV) return "/api/statement";
  return "";
}

/**
 * Envia PDF ou imagem da fatura para extrair lançamentos sugeridos.
 */
export async function analyzeCreditCardStatementDocument(
  documentDataUrl: string,
  options: { referenceMonth: string },
): Promise<StatementAiResult> {
  const endpoint = resolveStatementAssistantEndpoint();
  const { base64, mimeType } = stripDataUrlPrefix(documentDataUrl);

  if (!endpoint) {
    return {
      ok: true,
      markdown:
        "## IA indisponível\n\nConfigure `VITE_AI_ASSISTANT_URL` no build (ex.: `/api/receipt`) para habilitar também a rota de fatura na mesma base.",
      suggestedTransactions: [],
      statementTotalGuess: null,
      demoMode: true,
    };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      intent: "credit_card_statement",
      documentBase64: base64,
      mimeType,
      referenceMonth: options.referenceMonth,
      categories: [...CATEGORY_OPTIONS],
      locale: "pt-BR",
    }),
  });

  const rawText = await res.text();
  let raw: unknown;
  try {
    raw = JSON.parse(rawText) as unknown;
  } catch {
    raw = rawText;
  }

  if (!res.ok) {
    const apiErr =
      typeof raw === "object" &&
      raw !== null &&
      "error" in raw &&
      typeof (raw as { error: unknown }).error === "string"
        ? (raw as { error: string }).error.trim()
        : "";
    const rawStr = typeof raw === "string" ? raw : rawText;
    if (!apiErr && rawStr.trimStart().startsWith("<")) {
      throw new Error(
        `A API devolveu HTML em vez de JSON (HTTP ${res.status}). Faça deploy com a rota /api/statement ou atualize VITE_AI_ASSISTANT_URL.`
      );
    }
    throw new Error(apiErr || (typeof raw === "string" ? raw.slice(0, 200) : `HTTP ${res.status}`));
  }

  const body = raw as {
    markdown?: unknown;
    suggestedTransactions?: unknown;
    statementTotalGuess?: unknown;
  };

  const markdown =
    typeof body.markdown === "string"
      ? body.markdown
      : typeof raw === "string"
        ? raw
        : "Sem resumo.";

  const suggestedTransactions: StatementAiSuggestedTxn[] = [];
  if (Array.isArray(body.suggestedTransactions)) {
    for (const row of body.suggestedTransactions) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      suggestedTransactions.push({
        date: typeof r.date === "string" ? r.date : "",
        description: typeof r.description === "string" ? r.description : "",
        amount: typeof r.amount === "number" && Number.isFinite(r.amount) ? Math.abs(r.amount) : 0,
        category: typeof r.category === "string" ? r.category : "Outros",
        installmentNote:
          typeof r.installmentNote === "string" && r.installmentNote.trim()
            ? r.installmentNote.trim()
            : null,
      });
    }
  }

  let statementTotalGuess: number | null = null;
  if (typeof body.statementTotalGuess === "number" && Number.isFinite(body.statementTotalGuess)) {
    statementTotalGuess = Math.max(0, body.statementTotalGuess);
  }

  return {
    ok: true,
    markdown,
    suggestedTransactions,
    statementTotalGuess,
    demoMode: false,
    raw,
  };
}
