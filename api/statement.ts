/**
 * POST /api/statement — extrair lançamentos de fatura (PDF/imagem).
 *
 * **Um único arquivo** (sem `import "./lib/..."`): na Vercel cada rota em `api/*.ts`
 * vira um bundle separado; imports relativos para `api/lib/*` não são resolvidos no
 * runtime (`ERR_MODULE_NOT_FOUND`). O mesmo padrão de `api/receipt.ts`.
 *
 * Refino de categoria pós-IA está INLINE abaixo: a Vercel publica só `api/statement.js`
 * (sem `statementCategoryRefine.js` nem `src/`). Mantenha em sincronia com `src/domain/statementCategoryRefine.ts`.
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
  /** "credit" = pagamento/crédito que reduz o saldo da fatura (ex.: pagamento via conta). Demais = despesa. */
  entryKind?: "expense" | "credit";
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

/** Modelos com suporte a PDF nativo na API Responses (`input_file`). */
function pickModelForNativePdf(requested: string): string {
  const m = (requested || "").trim().toLowerCase();
  if (
    m.startsWith("gpt-4o") ||
    m.startsWith("gpt-4.1") ||
    m.startsWith("gpt-5") ||
    m.startsWith("o3") ||
    m.startsWith("o4")
  ) {
    return (requested || "").trim() || DEFAULT_MODEL_FALLBACK;
  }
  return DEFAULT_MODEL_FALLBACK;
}

function extractResponsesOutputText(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.output_text === "string" && d.output_text.trim()) return d.output_text.trim();

  const output = d.output;
  if (!Array.isArray(output)) return null;
  const texts: string[] = [];
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const content = o.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const p = part as Record<string, unknown>;
      if (p.type === "output_text" && typeof p.text === "string") texts.push(p.text);
      else if (typeof p.text === "string" && (p.type === "text" || p.type === undefined)) texts.push(p.text);
    }
  }
  const joined = texts.join("\n").trim();
  return joined.length ? joined : null;
}

/** Regras comuns aos três modos de extração (PDF nativo, imagem, texto). */
function buildStatementExtractionGuide(categoriesLine: string): string {
  return `INCLUA em suggestedTransactions TODAS as linhas financeiras desta fatura que compõem o total a pagar / limite utilizado, de TODAS as seções (nacionais, internacional em R$, IOF, repasse de IOF, encargos, multa, juros, parcelas, etc.). Não pare na primeira tabela.

REGRAS DE DESCRIPTION (obrigatório):
• Para COMPRAS (nacional ou internacional): use o NOME DO ESTABELECIMENTO exatamente como impresso na fatura (ex.: "Google YouTubePremiumSA", "CARREFOUR TBE 24BARUERI", "CURSOR, AI POWERED IDEN", "TOTALPASSSAO PAULOBRA"). NUNCA substitua por rótulos genéricos como "Compras nacionais - EB", "Compras internacionais", "Estabelecimento X" ou siglas inventadas — isso quebra a categorização.
• Para tarifas/encargos sem estabelecimento comercial: descrições fixas claras são OK (ex.: "IOF — financiamento", "Encargos refinanciamento (rotativo)", "Juros de mora", "Multa por atraso", "Repasse de IOF (internacional)", "Pagamento via conta").
• Uma linha em suggestedTransactions = UMA linha de valor na fatura (não agrupe várias compras em uma linha sintética).

INTERNACIONAL E IOF:
• Cada compra internacional: valor em R$ conforme impresso ("Valor em R$", "BRL", coluna em reais). Se só houver USD + "Dólar de conversão", calcule R$ = USD × câmbio da linha, 2 decimais.
• "Repasse de IOF" / totais de IOF de internacional: linha separada se constar valor próprio.
• IOF de financiamento, encargos do rotativo, juros de mora, multa: uma linha por valor com a data impressa ao lado.

CATEGORIA (category):
• Use o nome do estabelecimento E palavras da fatura (ex.: "supermercado", "lazer", "outros SAO PAULO", "restaurante") para escolher entre as opções. Ex.: supermercado/padaria → Alimentação; streaming/cinema/academia/pass → Lazer; farmácia/hospital → Saúde; Uber/combustível → Transporte; hotel/aéreo → Viagem; software/nuvem (Cursor, AWS, GitHub) → Eletrônicos; encargos/IOF/multa/tarifa bancária → Outros.

entryKind "credit" apenas para pagamentos que abatem a fatura (ex. pagamento via conta). amount sempre > 0 (magnitude).

statementTotalGuess: número do TOTAL FECHADO desta fatura em BRL. Prioridade MÁXIMA a frases explícitas como "O total da sua fatura é", "Total da fatura", depois "Limite total utilizado" / "Valor total a pagar" quando for claramente o fechamento. NÃO use só "Total lançamentos no cartão" ou "Total compras e saques" se existir um total maior que já inclua internacional + encargos + IOF. statementTotalGuess deve coincidir com esse total integral quando estiver legível.

No markdown, seção "## Conciliação": totais lidos no PDF (incl. subtotais por seção), soma das linhas extraídas (despesas − créditos) e, se faltar algo para bater no total, liste o que pode ter ficado de fora.

Opções de category (string exata): ${categoriesLine}`;
}

function normalizeStatementCategoryForStatementApi(raw: string, allowed: readonly string[]): string {
  const t = raw.trim();
  if (allowed.includes(t)) return t;
  const f = allowed.find((a) => a.toLowerCase() === t.toLowerCase());
  return f ?? "Outros";
}

function foldAsciiStatementApi(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Inline: não importar módulo externo (deploy Vercel = um arquivo). */
function refineStatementTransactionCategory(
  description: string,
  category: string,
  allowed: readonly string[],
): string {
  let cat = normalizeStatementCategoryForStatementApi(category, allowed);
  if (cat !== "Outros") return cat;
  const d = foldAsciiStatementApi(description);
  if (
    /\b(iof|encargo|refinanc|juros\s*de\s*mora|multa|repasse\s*de\s*iof|tarifa|anuidade|seguro\s+cart|pagamento\s+via\s+conta)\b/.test(
      d,
    )
  ) {
    return "Outros";
  }
  const rules: Array<[RegExp, string]> = [
    [
      /carrefour|atacad|pao\s*de\s*acucar|extra\b|supermercado|ifood|rappi|ze\s*delivery|mcdonald|subway|padaria|restaurante|assai|sendas|bakery|lanchonete/,
      "Alimentação",
    ],
    [
      /youtube|netflix|spotify|disney|prime\s*video|streaming|totalpass|totpass|smartfit|academia|ingresso|steam|playstation|xbox|deezer|twitch/,
      "Lazer",
    ],
    [/cursor|github|openai|google\s*cloud|aws|azure|digitalocean|hostinger|notion|slack|figma|adobe|jetbrains/, "Eletrônicos"],
    [/uber|99pop|99\s*taxi|cabify|bolt|shell|ipiranga|petrobras|posto|combust|metro|onibus|bilhete/, "Transporte"],
    [/latam|voegol|gol\s*linhas|azul\s*linhas|booking|airbnb|hotels|decolar|123milhas/, "Viagem"],
    [/drogaria|farmacia|drogasil|pacheco|hospital|clinica|dentista|odont|saude|hemolab/, "Saúde"],
    [/enel|cpfl|light|energia|esgoto|condominio|aluguel|iptu|virtua|oi\s*fibra/, "Moradia"],
    [/rico\b|xp\s|clear\s*corretora|btg|nuinvest|investimento|cei\s*b3/, "Investimentos"],
  ];
  for (const [re, guess] of rules) {
    if (re.test(d)) return normalizeStatementCategoryForStatementApi(guess, allowed);
  }
  return cat;
}

async function responsesCompletionJson(input: {
  apiKey: string;
  model: string;
  userContent: Array<Record<string, unknown>>;
}): Promise<string> {
  const model = pickModelForNativePdf(input.model);
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content: input.userContent }],
      max_output_tokens: 4096,
      text: { format: { type: "json_object" } },
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI Responses (${res.status}): ${rawText.slice(0, 800)}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error(`Resposta Responses inválida: ${rawText.slice(0, 200)}`);
  }

  const out = extractResponsesOutputText(data);
  if (!out) {
    throw new Error(`OpenAI Responses sem texto útil: ${rawText.slice(0, 500)}`);
  }
  return out;
}

/** PDF sem texto extraível (scan): envia o arquivo pela API Responses (`input_file`), com visão embutida. */
async function analyzeCreditCardStatementFromPdfNative(input: {
  apiKey: string;
  model: string;
  pdfBase64: string;
  filename: string;
  referenceMonth: string | null;
  categoriesLine: string;
}): Promise<StatementAnalyzeResult> {
  const monthHint = input.referenceMonth
    ? `Mês de referência informado pelo usuário: ${input.referenceMonth}. Prefira datas nesse mês quando o ano estiver implícito na fatura.`
    : "Inferir o mês de referência a partir do documento quando possível.";

  const system = `Você interpreta FATURAS DE CARTÃO DE CRÉDITO brasileiras a partir do PDF anexo (inclui faturas escaneadas ou só imagem).

${buildStatementExtractionGuide(input.categoriesLine)}

Responda APENAS um objeto JSON válido (sem markdown ao redor):
{"markdown":"...","suggestedTransactions":[{"date":"YYYY-MM-DD","description":"","amount":0,"category":"","installmentNote":null,"entryKind":"expense"}],"statementTotalGuess":null}

${monthHint}`;

  const safeName =
    input.filename.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 80) || "fatura.pdf";

  const content = await responsesCompletionJson({
    apiKey: input.apiKey,
    model: input.model,
    userContent: [
      {
        type: "input_text",
        text: `${system}\n\nListe os lançamentos desta fatura para importação em app financeiro. Use o formato JSON acima (obrigatório).`,
      },
      {
        type: "input_file",
        filename: safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`,
        file_data: `data:application/pdf;base64,${input.pdfBase64}`,
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
      const ekRaw = typeof r.entryKind === "string" ? r.entryKind.trim().toLowerCase() : "";
      const ekNorm = ekRaw.normalize("NFD").replace(/\p{M}/gu, "");
      const entryKind: "expense" | "credit" =
        ekRaw === "credit" || ekNorm === "credito" ? "credit" : "expense";
      suggestedTransactions.push({
        date,
        description: description.slice(0, 240),
        amount: Math.round(amt * 100) / 100,
        category: category.slice(0, 80),
        installmentNote,
        ...(entryKind === "credit" ? { entryKind: "credit" as const } : {}),
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

${buildStatementExtractionGuide(input.categoriesLine)}

Responda APENAS JSON válido:
{"markdown":"...","suggestedTransactions":[{"date":"YYYY-MM-DD","description":"","amount":0,"category":"","installmentNote":null,"entryKind":"expense"}],"statementTotalGuess":null}

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

${buildStatementExtractionGuide(input.categoriesLine)}

Responda APENAS JSON:
{"markdown":"...","suggestedTransactions":[{"date":"YYYY-MM-DD","description":"","amount":0,"category":"","installmentNote":null,"entryKind":"expense"}],"statementTotalGuess":null}

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
    category: refineStatementTransactionCategory(t.description, t.category, allowed),
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
      let text = "";
      let pdfTextOk = false;
      try {
        text = await extractPdfText(buf);
        pdfTextOk = text.length >= 120;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[paytrackr-statement] pdf-parse", msg);
      }

      if (pdfTextOk) {
        result = await analyzeCreditCardStatementFromText({
          apiKey: openaiKey,
          model: openaiModel,
          statementText: text,
          referenceMonth,
          categoriesLine,
        });
      } else {
        try {
          result = await analyzeCreditCardStatementFromPdfNative({
            apiKey: openaiKey,
            model: openaiModel,
            pdfBase64: p.documentBase64.trim(),
            filename: "fatura.pdf",
            referenceMonth,
            categoriesLine,
          });
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          console.error("[paytrackr-statement] pdf-native-openai", msg2);
          return {
            status: 422,
            json: {
              error:
                "Não foi possível extrair texto do PDF nem analisá-lo como documento (OpenAI). Tente PNG/JPEG da fatura ou outro PDF. Detalhe: " +
                (msg2.length > 220 ? `${msg2.slice(0, 220)}…` : msg2),
            },
          };
        }
      }
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
