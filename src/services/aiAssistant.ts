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

2. **Dev com Vite** — na raiz do projeto, no \`.env\`:

\`\`\`
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
VITE_AI_ASSISTANT_URL=/api/paytrackr/assistant/image
\`\`\`

(O servidor de desenvolvimento expõe esse endpoint e encaminha para a OpenAI. Em produção estático você precisa de um backend próprio.)

Para hospedar em URL externa:

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

/** URL do POST do assistente: env explícito, ou em dev o proxy do Vite na mesma origem. */
function resolveAssistantEndpoint(): string {
  const fromEnv = import.meta.env.VITE_AI_ASSISTANT_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return "/api/paytrackr/assistant/image";
  return "";
}

/**
 * Envia foto de **comprovante de pagamento** para o seu agente (OCR + interpretação).
 * Em **desenvolvimento**, sem \`VITE_AI_ASSISTANT_URL\`, usa o proxy local do Vite.
 * Em **produção**, sem URL configurada, devolve texto demo (não chama rede).
 */
export async function analyzePaymentReceiptImage(imageDataUrl: string): Promise<AiAssistantImageResult> {
  const { base64, mimeType } = stripDataUrlPrefix(imageDataUrl);
  const endpoint = resolveAssistantEndpoint();

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
    const apiErr =
      typeof raw === "object" &&
      raw !== null &&
      "error" in raw &&
      typeof (raw as { error: unknown }).error === "string"
        ? (raw as { error: string }).error.trim()
        : "";
    throw new Error(apiErr || (typeof raw === "string" ? raw : `HTTP ${res.status}`));
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
