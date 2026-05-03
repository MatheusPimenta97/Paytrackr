import { PDFParse } from "pdf-parse";

import {
  analyzeCreditCardStatementFromText,
  analyzeCreditCardStatementVision,
  type StatementAnalyzeResult,
  type StatementSuggestedTxn,
} from "./openaiStatementAnalyze";

/** POST handler para extrair lançamentos da fatura (imagem ou PDF). Rota plana — ver `api/statement.ts`. */
export const ASSISTANT_STATEMENT_HTTP_PATH = "/api/statement";

export const STATEMENT_DOCUMENT_BODY_MAX_BYTES = 18 * 1024 * 1024;

const ALLOWED_STATEMENT_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const DEFAULT_STATEMENT_CATEGORIES = [
  "Eletrônicos",
  "Investimentos",
  "Lazer",
  "Viagem",
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Outros",
] as const;

function normalizeCategory(raw: string, allowed: readonly string[]): string {
  const t = raw.trim();
  if (allowed.includes(t)) return t;
  const f = allowed.find((a) => a.toLowerCase() === t.toLowerCase());
  return f ?? "Outros";
}

function normalizeCategoriesPayload(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_STATEMENT_CATEGORIES];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const s = x.trim();
    if (s && !out.includes(s)) out.push(s.slice(0, 80));
  }
  return out.length > 0 ? out : [...DEFAULT_STATEMENT_CATEGORIES];
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const tr = await parser.getText();
    return (tr.text ?? "").trim();
  } finally {
    await parser.destroy();
  }
}

function applyCategoryWhitelist(result: StatementAnalyzeResult, allowed: readonly string[]): StatementAnalyzeResult {
  const suggestedTransactions: StatementSuggestedTxn[] = result.suggestedTransactions.map((t) => ({
    ...t,
    category: normalizeCategory(t.category, allowed),
  }));
  return { ...result, suggestedTransactions };
}

export async function handleStatementAnalyzePost(
  bodyRaw: string,
  options: { openaiKey?: string; openaiModel: string },
): Promise<{ status: number; json: Record<string, unknown> }> {
  const openaiModel = options.openaiModel?.trim() || "gpt-4o-mini";
  const openaiKey = options.openaiKey?.trim();

  if (Buffer.byteLength(bodyRaw, "utf8") > STATEMENT_DOCUMENT_BODY_MAX_BYTES) {
    return { status: 413, json: { error: "Corpo da requisição muito grande." } };
  }

  if (!openaiKey) {
    return {
      status: 503,
      json: {
        error:
          "OPENAI_API_KEY não configurada no servidor. Configure na Vercel ou no .env local para desenvolvimento.",
      },
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyRaw) as unknown;
  } catch {
    return { status: 400, json: { error: "JSON inválido." } };
  }

  const p = payload as {
    intent?: unknown;
    documentBase64?: unknown;
    mimeType?: unknown;
    referenceMonth?: unknown;
    categories?: unknown;
  };

  if (p.intent !== "credit_card_statement") {
    return { status: 400, json: { error: 'intent deve ser "credit_card_statement".' } };
  }

  if (typeof p.documentBase64 !== "string" || !p.documentBase64.trim()) {
    return { status: 400, json: { error: "documentBase64 obrigatório." } };
  }

  const mimeType =
    typeof p.mimeType === "string" && ALLOWED_STATEMENT_MIME.has(p.mimeType.trim())
      ? p.mimeType.trim()
      : null;

  if (!mimeType) {
    return {
      status: 400,
      json: {
        error: `mimeType deve ser um de: ${[...ALLOWED_STATEMENT_MIME].join(", ")}.`,
      },
    };
  }

  const referenceMonth =
    typeof p.referenceMonth === "string" && /^\d{4}-\d{2}$/.test(p.referenceMonth.trim())
      ? p.referenceMonth.trim()
      : null;

  const categoriesList = normalizeCategoriesPayload(p.categories);
  const categoriesLine = categoriesList.join(", ");

  const approxBytes = Math.floor((p.documentBase64.length * 3) / 4);
  if (approxBytes > 12 * 1024 * 1024) {
    return { status: 413, json: { error: "Documento muito grande." } };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(p.documentBase64.trim(), "base64");
  } catch {
    return { status: 400, json: { error: "documentBase64 inválido." } };
  }

  try {
    let result: StatementAnalyzeResult;

    if (mimeType === "application/pdf") {
      let text: string;
      try {
        text = await extractPdfText(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[paytrackr-statement] pdf-parse", msg);
        return {
          status: 422,
          json: {
            error:
              "Não foi possível ler este PDF. Se for só imagem escaneada, exporte páginas como PNG/JPEG ou use captura de tela.",
          },
        };
      }

      if (text.length < 120) {
        return {
          status: 422,
          json: {
            error:
              "Este PDF não tem texto selecionável (provável scan). Envie a fatura como imagem (PNG/JPEG) ou PDF gerado pelo banco.",
          },
        };
      }

      result = await analyzeCreditCardStatementFromText({
        apiKey: openaiKey,
        model: openaiModel,
        statementText: text,
        referenceMonth,
        categoriesLine,
      });
    } else {
      result = await analyzeCreditCardStatementVision({
        apiKey: openaiKey,
        model: openaiModel,
        mimeType,
        imageBase64: p.documentBase64.trim(),
        referenceMonth,
        categoriesLine,
      });
    }

    result = applyCategoryWhitelist(result, categoriesList);

    return {
      status: 200,
      json: {
        markdown: result.markdown,
        suggestedTransactions: result.suggestedTransactions,
        statementTotalGuess: result.statementTotalGuess,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytrackr-statement]", msg);
    return {
      status: 502,
      json: { error: msg.length > 400 ? `${msg.slice(0, 400)}…` : msg },
    };
  }
}
