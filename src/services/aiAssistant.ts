/** Contrato esperado do seu backend/agente (POST JSON). Ajuste conforme sua API real. */
export type AiAssistantImageResponseBody = {
  /** Texto principal para exibir ao usuário */
  markdown?: string;
  text?: string;
  /** Opcional: lançamentos sugeridos para importar depois */
  suggestedTransactions?: unknown;
};

export type AiAssistantImageResult = {
  ok: boolean;
  markdown: string;
  /** true quando não há endpoint — resposta só para orientar desenvolvimento */
  demoMode: boolean;
  raw?: unknown;
};

const DEMO_MARKDOWN = `## Modo demonstração (sem API)

Nenhuma URL de agente está configurada. Para ler **comprovantes de pagamento** (Pix, TED, boleto pago, etc.) com visão computacional de verdade:

1. **Backend próprio** — receba a foto no servidor, chame OpenAI / Anthropic / Gemini (modo visão) e devolva JSON neste formato:

\`\`\`json
{
  "markdown": "Texto estruturado para o usuário (valores, datas, beneficiário…)",
  "text": "opcional",
  "suggestedTransactions": []
}
\`\`\`

2. **Frontend** — defina no \`.env\`:

\`\`\`
VITE_AI_ASSISTANT_URL=https://seu-servidor.com/api/paytrackr/assistant/image
\`\`\`

O app envia **POST** com corpo:

\`\`\`json
{
  "intent": "payment_receipt",
  "imageBase64": "<base64 sem prefixo data:>",
  "mimeType": "image/jpeg",
  "locale": "pt-BR"
}
\`\`\`

**Privacidade:** comprovantes têm dados bancários e CPF/CNPJ em muitos casos — só envie para APIs e regiões que você aceitar.

---

### Exemplo do que o agente poderia extrair

- **Valor**, **data/hora**, **tipo** (Pix crédito/débito, TED…)
- **Nome do pagador ou recebedor**, **instituição**, **ID da transação**
- **Sugestão de lançamento** (ainda não gravamos automaticamente — confirmação humana depois).
`;

function stripDataUrlPrefix(dataUrl: string): { base64: string; mimeType: string } {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!m) return { base64: dataUrl, mimeType: "image/jpeg" };
  return { base64: m[2], mimeType: m[1] || "image/jpeg" };
}

/**
 * Envia foto de **comprovante de pagamento** para o seu agente (OCR + interpretação).
 * Sem \`VITE_AI_ASSISTANT_URL\`, devolve texto demo (não chama rede).
 */
export async function analyzePaymentReceiptImage(imageDataUrl: string): Promise<AiAssistantImageResult> {
  const { base64, mimeType } = stripDataUrlPrefix(imageDataUrl);
  const endpoint = import.meta.env.VITE_AI_ASSISTANT_URL?.trim();

  if (!endpoint) {
    return { ok: true, markdown: DEMO_MARKDOWN, demoMode: true };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      intent: "payment_receipt",
      imageBase64: base64,
      mimeType,
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
    throw new Error(typeof raw === "string" ? raw : `HTTP ${res.status}`);
  }

  const body = raw as AiAssistantImageResponseBody;
  const markdown =
    typeof body.markdown === "string"
      ? body.markdown
      : typeof body.text === "string"
        ? body.text
        : typeof raw === "string"
          ? raw
          : JSON.stringify(raw, null, 2);

  return { ok: true, markdown, demoMode: false, raw };
}
