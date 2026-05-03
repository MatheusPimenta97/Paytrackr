/** Chamada server-side à OpenAI (visão). Não importar no bundle do cliente. */

const SYSTEM_PROMPT = `Você analisa fotos de COMPROVANTES DE PAGAMENTO brasileiros (Pix, TED, DOC, boletos pagos, cartão, apps de banco).

Extraia o que conseguir ler: valor (R$), data e horário, tipo da operação, nomes de pagador/recebedor, banco ou instituição, identificadores (end-to-end Pix, código de barras parcial, etc.). Se algo estiver ilegível ou cortado, diga explicitamente.

Responda APENAS um objeto JSON válido (sem markdown ao redor), neste formato:
{"markdown":"..."}

O campo markdown deve ser texto em Markdown em pt-BR, com seções curtas (ex.: ## Valor, ## Data, ## Participantes), para o usuário conferir antes de lançar no app financeiro.
Se não for um comprovante de pagamento, explique brevemente no markdown o que parece ser a imagem.`;

export async function analyzeReceiptWithOpenAI(input: {
  apiKey: string;
  model: string;
  mimeType: string;
  imageBase64: string;
}): Promise<{ markdown: string }> {
  const imageUrl = `data:${input.mimeType};base64,${input.imageBase64}`;

  const ac = new AbortController();
  const timeoutMs = 120_000;
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise esta imagem como comprovante de pagamento.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`OpenAI: tempo esgotado (${timeoutMs / 1000} s).`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

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

  try {
    const parsed = JSON.parse(content) as { markdown?: unknown };
    if (typeof parsed.markdown === "string" && parsed.markdown.trim()) {
      return { markdown: parsed.markdown.trim() };
    }
  } catch {
    /* fallback abaixo */
  }

  return { markdown: content };
}
