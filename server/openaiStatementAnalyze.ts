/** Extração de lançamentos de fatura de cartão (visão ou texto de PDF). Server-only. */

export type StatementSuggestedTxn = {
  date: string;
  description: string;
  /** Valor absoluto da compra em BRL (sempre > 0 para despesa típica). */
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

export async function analyzeCreditCardStatementVision(input: {
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

export async function analyzeCreditCardStatementFromText(input: {
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

  const clipped = input.statementText.length > 120_000 ? input.statementText.slice(0, 120_000) + "\n...[texto truncado]" : input.statementText;

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
