/**
 * POST /api/receipt — comprovante (IA). Rota **plana**: a Vercel falha com
 * FUNCTION_INVOCATION_FAILED em `api/paytrackr/assistant/image` (módulo aninhado).
 * O Vite em dev usa o mesmo caminho via `ASSISTANT_IMAGE_HTTP_PATH` em `api/lib`.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

const ASSISTANT_IMAGE_BODY_MAX_BYTES = 4 * 1024 * 1024;

const SYSTEM_PROMPT = `Você analisa fotos de COMPROVANTES DE PAGAMENTO brasileiros (Pix, TED, DOC, boletos pagos, cartão, apps de banco).

Extraia o que conseguir ler: valor (R$), data e horário, tipo da operação, nomes de pagador/recebedor, banco ou instituição, identificadores (end-to-end Pix, código de barras parcial, etc.). Se algo estiver ilegível ou cortado, diga explicitamente.

Responda APENAS um objeto JSON válido (sem markdown ao redor), neste formato:
{"markdown":"..."}

O campo markdown deve ser texto em Markdown em pt-BR, com seções curtas (ex.: ## Valor, ## Data, ## Participantes), para o usuário conferir antes de lançar no app financeiro.
Se não for um comprovante de pagamento, explique brevemente no markdown o que parece ser a imagem.`;

const ALLOWED_ASSISTANT_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "image/apng": "image/png",
  "application/octet-stream": "__sniff",
};

type ReqWithBody = IncomingMessage & { body?: unknown };

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

async function readPostBodyUtf8(req: ReqWithBody, maxBytes: number): Promise<string> {
  const b = req.body as unknown;
  if (typeof b === "string") {
    if (Buffer.byteLength(b, "utf8") > maxBytes) throw new Error("body too large");
    return b;
  }
  if (Buffer.isBuffer(b)) {
    if (b.length > maxBytes) throw new Error("body too large");
    return b.toString("utf8");
  }
  if (b !== undefined && b !== null && typeof b === "object") {
    const s = JSON.stringify(b);
    if (Buffer.byteLength(s, "utf8") > maxBytes) throw new Error("body too large");
    return s;
  }
  return readBodyStream(req, maxBytes);
}

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

async function analyzeReceiptWithOpenAI(input: {
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
                image_url: { url: imageUrl, detail: "low" },
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

  const choice0 =
    typeof data === "object" &&
    data !== null &&
    "choices" in data &&
    Array.isArray((data as { choices: unknown }).choices)
      ? (data as { choices: Array<{ message?: { content?: string | null; refusal?: string | null } }> })
          .choices[0]?.message
      : undefined;

  const refusal = choice0 && typeof choice0.refusal === "string" ? choice0.refusal.trim() : "";
  if (refusal) {
    throw new Error(`OpenAI recusou a imagem: ${refusal.slice(0, 400)}`);
  }

  const content = choice0?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI não retornou texto na resposta.");
  }

  try {
    const parsed = JSON.parse(content) as { markdown?: unknown };
    if (typeof parsed.markdown === "string" && parsed.markdown.trim()) {
      return { markdown: parsed.markdown.trim() };
    }
  } catch {
    /* fallback */
  }

  return { markdown: content };
}

async function handleAssistantImagePost(
  bodyRaw: string,
  openaiKey: string | undefined,
  openaiModel: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const model = openaiModel.trim() || "gpt-4o-mini";
  const key = openaiKey?.trim();

  if (Buffer.byteLength(bodyRaw, "utf8") > ASSISTANT_IMAGE_BODY_MAX_BYTES) {
    return { status: 413, json: { error: "Corpo da requisição muito grande." } };
  }

  if (!key) {
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
  if (approxBytes > 3 * 1024 * 1024) {
    return {
      status: 413,
      json: { error: "Imagem muito grande após decodificar (máx. ~3 MB). Reduza a resolução." },
    };
  }

  try {
    const { markdown } = await analyzeReceiptWithOpenAI({
      apiKey: key,
      model,
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
      bodyRaw = await readPostBodyUtf8(req as ReqWithBody, ASSISTANT_IMAGE_BODY_MAX_BYTES);
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

    const result = await handleAssistantImagePost(bodyRaw, openaiKey, openaiModel);
    sendJson(res, result.status, result.json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytrackr-assistant-image]", msg);
    sendJson(res, 500, {
      error:
        msg.length > 300
          ? `Erro interno ao processar o pedido: ${msg.slice(0, 300)}…`
          : `Erro interno ao processar o pedido: ${msg}`,
    });
  }
}
