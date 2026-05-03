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

/** Navegadores e SOs enviam aliases; alguns prints vêm como octet-stream ou mime vazio. */
const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "image/apng": "image/png",
  "application/octet-stream": "__sniff",
};

/** Detecta JPEG/PNG/GIF/WebP pelos primeiros bytes decodificados do base64. */
function sniffImageMimeFromBase64(b64: string): string | null {
  const trimmed = b64.replace(/\s/g, "");
  if (!trimmed) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(trimmed.slice(0, 16384), "base64");
  } catch {
    return null;
  }
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "image/webp";
  return null;
}

function resolveImageMimeType(rawMime: string | undefined, imageBase64: string): string | null {
  const m = typeof rawMime === "string" ? rawMime.trim().toLowerCase() : "";
  const aliased = m ? (MIME_ALIASES[m] ?? m) : "";
  if (aliased && aliased !== "__sniff" && ALLOWED_ASSISTANT_IMAGE_MIME.has(aliased)) {
    return aliased;
  }
  if (aliased === "__sniff" || !m || m === "application/octet-stream") {
    return sniffImageMimeFromBase64(imageBase64);
  }
  return sniffImageMimeFromBase64(imageBase64);
}

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

  const trimmedB64 = p.imageBase64.trim();
  const mimeType = resolveImageMimeType(
    typeof p.mimeType === "string" ? p.mimeType : undefined,
    trimmedB64,
  );

  if (!mimeType) {
    return {
      status: 400,
      json: {
        error:
          "Não foi possível detectar o formato da imagem. Envie JPEG, PNG, WebP ou GIF (capturas às vezes vêm sem tipo — tente salvar como PNG ou tirar foto pelo app).",
      },
    };
  }

  const approxBytes = Math.floor((trimmedB64.length * 3) / 4);
  if (approxBytes > 10 * 1024 * 1024) {
    return { status: 413, json: { error: "Imagem muito grande (máx. ~10 MB)." } };
  }

  try {
    const { markdown } = await analyzeReceiptWithOpenAI({
      apiKey: openaiKey,
      model: openaiModel,
      mimeType,
      imageBase64: trimmedB64,
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
