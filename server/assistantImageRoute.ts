import { analyzeReceiptWithOpenAI } from "./openaiReceiptAnalyze";

/** Mesmo caminho que o frontend usa em dev (proxy Vite) e em prod (serverless). */
export const ASSISTANT_IMAGE_HTTP_PATH = "/api/paytrackr/assistant/image";

export const ASSISTANT_IMAGE_BODY_MAX_BYTES = 14 * 1024 * 1024;

export const ALLOWED_ASSISTANT_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function handleAssistantImagePost(
  bodyRaw: string,
  options: { openaiKey?: string; openaiModel: string },
): Promise<{ status: number; json: Record<string, unknown> }> {
  const openaiModel = options.openaiModel?.trim() || "gpt-4o-mini";
  const openaiKey = options.openaiKey?.trim();

  if (Buffer.byteLength(bodyRaw, "utf8") > ASSISTANT_IMAGE_BODY_MAX_BYTES) {
    return { status: 413, json: { error: "Corpo da requisição muito grande." } };
  }

  if (!openaiKey) {
    return {
      status: 503,
      json: {
        error:
          "OPENAI_API_KEY não configurada no servidor. Na Vercel: Settings → Environment Variables (Production/Preview). Use modelo com visão (ex.: gpt-4o-mini).",
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
    imageBase64?: unknown;
    mimeType?: unknown;
  };

  if (p.intent !== "payment_receipt") {
    return { status: 400, json: { error: 'intent deve ser "payment_receipt".' } };
  }

  if (typeof p.imageBase64 !== "string" || !p.imageBase64.trim()) {
    return { status: 400, json: { error: "imageBase64 obrigatório." } };
  }

  const mimeType =
    typeof p.mimeType === "string" && ALLOWED_ASSISTANT_IMAGE_MIME.has(p.mimeType.trim())
      ? p.mimeType.trim()
      : null;

  if (!mimeType) {
    return {
      status: 400,
      json: {
        error: `mimeType deve ser um de: ${[...ALLOWED_ASSISTANT_IMAGE_MIME].join(", ")}.`,
      },
    };
  }

  const approxBytes = Math.floor((p.imageBase64.length * 3) / 4);
  if (approxBytes > 10 * 1024 * 1024) {
    return { status: 413, json: { error: "Imagem muito grande (máx. ~10 MB)." } };
  }

  try {
    const { markdown } = await analyzeReceiptWithOpenAI({
      apiKey: openaiKey,
      model: openaiModel,
      mimeType,
      imageBase64: p.imageBase64.trim(),
    });
    return { status: 200, json: { markdown } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytrackr-assistant]", msg);
    return {
      status: 502,
      json: { error: msg.length > 400 ? `${msg.slice(0, 400)}…` : msg },
    };
  }
}
