/**
 * POST /api/statement — extrair lançamentos de fatura (PDF/imagem).
 *
 * **Um único arquivo** (sem `import "./lib/..."`): na Vercel cada rota em `api/*.ts`
 * vira um bundle separado; imports relativos para `api/lib/*` não são resolvidos no
 * runtime (`ERR_MODULE_NOT_FOUND`). O mesmo padrão de `api/receipt.ts`.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

// --- sendJson (inline; era api/lib/sendJson.ts)
function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
  let body: string;
  try {
    body = JSON.stringify(payload);
  } catch {
    body = JSON.stringify({ error: "Erro ao serializar resposta JSON." });
    status = 500;
  }
  if (!res.headersSent) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.end(body);
}

// --- readPostBodyUtf8 (inline; era api/lib/readPostBodyUtf8.ts)
function readBodyStream(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (c: Buffer) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error("body too large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export type NodeRequestWithBody = IncomingMessage & { body?: unknown };

function readPostBodyUtf8(req: NodeRequestWithBody, maxBytes: number): Promise<string> {
  const b = req.body as unknown;
  if (typeof b === "string") {
    if (Buffer.byteLength(b, "utf8") > maxBytes) return Promise.reject(new Error("body too large"));
    return Promise.resolve(b);
  }
  if (Buffer.isBuffer(b)) {
    if (b.length > maxBytes) return Promise.reject(new Error("body too large"));
    return Promise.resolve(b.toString("utf8"));
  }
  if (b !== undefined && b !== null && typeof b === "object") {
    const s = JSON.stringify(b);
    if (Buffer.byteLength(s, "utf8") > maxBytes) return Promise.reject(new Error("body too large"));
    return Promise.resolve(s);
  }
  return readBodyStream(req, maxBytes);
}

// --- openaiStatementAnalyze (inline; era api/lib/openaiStatementAnalyze.ts)

export type StatementSuggestedTxn = {
  date: string;
  description: string;
  amount: number;
  category: string;
  installmentNote?: string | null;
};

export type StatementAnalyzeResult = {
  markdown: string;
  suggestedTransactions: StatementSuggestedTxn[];
  statementTotalGuess: number | null;
};

const DEFAULT_MODEL_FALLBACK = "gpt-4o-mini";

function parseJsonContent(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

async function chatCompletionJson(input: {
  apiKey: string;
  model: string;
  messages: Array<{
    role: "system" | "user";
    content: unknown;
  }>;
}): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model || DEFAULT_MODEL_FALLBACK,
      response_format: { type: "json_object" },
      messages: input.messages,
      max_tokens: 4096,
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI (${res.status}): ${rawText.slice(0, 600)}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error(`Resposta OpenAI inválida: ${rawText.slice(0, 200)}`);
  }

  const content =
    typeof data === "object" &&
    data !== null &&
    "choices" in data &&
    Array.isArray((data as { choices: unknown }).choices)
      ? (data as { choices: Array<{ message?: { content?: string } }> }).choices[0]?.message?.content
      : undefined;

  if (!content || typeof content !== "string") {
    throw new Error("OpenAI não retornou texto na resposta.");
  }

  return content;
}

function normalizeAnalyzePayload(parsed: unknown): StatementAnalyzeResult {
  const root =
    typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};

  const markdown =
    typeof root.markdown === "string" && root.markdown.trim()
      ? root.markdown.trim()
      : "## Fatura analisada\n\nRevise os lançamentos sugeridos antes de importar.";

  let statementTotalGuess: number | null = null;
  if (typeof root.statementTotalGuess === "number" && Number.isFinite(root.statementTotalGuess)) {
    statementTotalGuess = Math.max(0, root.statementTotalGuess);
  }

  const rawList = root.suggestedTransactions;
  const suggestedTransactions: StatementSuggestedTxn[] = [];
  if (Array.isArray(rawList)) {
    for (const row of rawList) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const date = typeof r.date === "string" ? r.date.trim() : "";
      const description = typeof r.description === "string" ? r.description.trim() : "";
      const category = typeof r.category === "string" ? r.category.trim() : "";
      const amt =
        typeof r.amount === "number" && Number.isFinite(r.amount)
          ? Math.abs(r.amount)
          : typeof r.amount === "string"
            ? Math.abs(Number.parseFloat(r.amount.replace(",", ".")) || 0)
            : 0;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || description.length === 0 || amt <= 0) continue;
      const installmentNote =
        typeof r.installmentNote === "string" && r.installmentNote.trim()
          ? r.installmentNote.trim().slice(0, 80)
          : null;
      suggestedTransactions.push({
        date,
        description: description.slice(0, 240),
        amount: Math.round(amt * 100) / 100,
        category: category.slice(0, 80),
        installmentNote,
      });
    }
  }

  return { markdown, suggestedTransactions, statementTotalGuess };
}

async function analyzeCreditCardStatementVision(input: {
  apiKey: string;
  model: string;
  mimeType: string;
  imageBase64: string;
  referenceMonth: string | null;
  categoriesLine: string;
}): Promise<StatementAnalyzeResult> {
  const imageUrl = `data:${input.mimeType};base64,${input.imageBase64}`;
  const monthHint = input.referenceMonth
    ? `Mês de referência informado pelo usuário: ${input.referenceMonth}. Prefira datas nesse mês quando o ano estiver implícito na fatura.`
    : "Inferir o mês de referência a partir do documento quando possível.";

  const system = `Você interpreta FATURAS DE CARTÃO DE CRÉDITO brasileiras (PDF renderizado como imagem ou captura de tela).

Extraia LINHAS DE COMPRAS/DESPESAS (ignore totalizadores genéricos como "total da fatura" como linha importável — use só linhas com data + estabelecimento + valor).

Para cada linha devolva:
- date no formato YYYY-MM-DD
- description curta (nome do estabelecimento ou texto da linha)
- amount: número positivo em reais (valor absoluto da compra nesta fatura)
- category: escolha EXATAMENTE uma destas opções: ${input.categoriesLine}
- installmentNote: texto opcional tipo "3/12" se aparecer parcelamento; senão null.

Responda APENAS JSON válido neste formato:
{"markdown":"...","suggestedTransactions":[{"date":"","description":"","amount":0,"category":"","installmentNote":null}],"statementTotalGuess":null}

statementTotalGuess: total da fatura em BRL se estiver explícito no documento, senão null.

${monthHint}`;

  const content = await chatCompletionJson({
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: "Liste os lançamentos desta fatura para importação em app financeiro." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });

  const parsed = parseJsonContent(content);
  if (!parsed) {
    return normalizeAnalyzePayload({
      markdown: content,
      suggestedTransactions: [],
      statementTotalGuess: null,
    });
  }
  return normalizeAnalyzePayload(parsed);
}

async function analyzeCreditCardStatementFromText(input: {
  apiKey: string;
  model: string;
  statementText: string;
  referenceMonth: string | null;
  categoriesLine: string;
}): Promise<StatementAnalyzeResult> {
  const monthHint = input.referenceMonth
    ? `Mês de referência: ${input.referenceMonth}.`
    : "Inferir datas completas quando possível.";

  const system = `Você interpreta TEXTO EXTRAÍDO de uma fatura de cartão de crédito brasileiro.

Extraia lançamentos com data, estabelecimento e valor. Ignore linhas que são apenas totais ou resumo sem detalhe.

Regras:
- amount: sempre positivo em BRL para cada compra nesta fatura.
- category: EXATAMENTE uma de: ${input.categoriesLine}
- installmentNote: parcela ex. "2/10" se constar; senão null.

Responda APENAS JSON:
{"markdown":"...","suggestedTransactions":[{"date":"YYYY-MM-DD","description":"","amount":0,"category":"","installmentNote":null}],"statementTotalGuess":null}

${monthHint}`;

  const clipped =
    input.statementText.length > 120_000
      ? input.statementText.slice(0, 120_000) + "\n...[texto truncado]"
      : input.statementText;

  const content = await chatCompletionJson({
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Texto da fatura:\n\n${clipped}`,
      },
    ],
  });

  const parsed = parseJsonContent(content);
  if (!parsed) {
    return normalizeAnalyzePayload({
      markdown: content,
      suggestedTransactions: [],
      statementTotalGuess: null,
    });
  }
  return normalizeAnalyzePayload(parsed);
}

// --- statement route (inline; era api/lib/statementAnalyzeRoute.ts)

/** POST handler path — usado pelo proxy do Vite em dev. */
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
  const { PDFParse } = await import("pdf-parse");
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

// --- Vercel / Node entry

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end();
    }

    let bodyRaw: string;
    try {
      bodyRaw = await readPostBodyUtf8(req as NodeRequestWithBody, STATEMENT_DOCUMENT_BODY_MAX_BYTES);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (m.includes("too large") || m.includes("large")) {
        sendJson(res, 413, { error: "Corpo da requisição muito grande." });
        return;
      }
      throw e;
    }

    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

    const result = await handleStatementAnalyzePost(bodyRaw, { openaiKey, openaiModel });
    sendJson(res, result.status, result.json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/statement]", msg);
    sendJson(res, 500, {
      error:
        msg.length > 300
          ? `Erro interno ao processar o pedido: ${msg.slice(0, 300)}…`
          : `Erro interno ao processar o pedido: ${msg}`,
    });
  }
}
