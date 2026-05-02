import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { analyzeReceiptWithOpenAI } from "./server/openaiReceiptAnalyze";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYNC_FILE = path.join(__dirname, ".paytrackr-lan-sync.json");

const ASSISTANT_PATH = "/api/paytrackr/assistant/image";
const IMAGE_BODY_MAX_BYTES = 14 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      chunks.push(c);
      if (chunks.reduce((s, x) => s + x.length, 0) > 12 * 1024 * 1024) {
        reject(new Error("body too large"));
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function readBodyLimited(req: IncomingMessage, maxBytes: number): Promise<string> {
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

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function createAssistantMiddleware(openaiKey: string | undefined, openaiModel: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = req.url?.split("?")[0] ?? "";
    if (pathname !== ASSISTANT_PATH) {
      next();
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end();
      return;
    }

    if (!openaiKey) {
      sendJson(res, 503, {
        error:
          "OPENAI_API_KEY não configurada. Crie uma chave em https://platform.openai.com/api-keys e defina OPENAI_API_KEY no .env na raiz do projeto. Assinatura ChatGPT Plus/Pro não inclui uso pela API.",
      });
      return;
    }

    let bodyRaw: string;
    try {
      bodyRaw = await readBodyLimited(req, IMAGE_BODY_MAX_BYTES);
    } catch {
      sendJson(res, 413, { error: "Corpo da requisição muito grande." });
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(bodyRaw) as unknown;
    } catch {
      sendJson(res, 400, { error: "JSON inválido." });
      return;
    }

    const p = payload as {
      intent?: unknown;
      imageBase64?: unknown;
      mimeType?: unknown;
    };

    if (p.intent !== "payment_receipt") {
      sendJson(res, 400, { error: 'intent deve ser "payment_receipt".' });
      return;
    }

    if (typeof p.imageBase64 !== "string" || !p.imageBase64.trim()) {
      sendJson(res, 400, { error: "imageBase64 obrigatório." });
      return;
    }

    const mimeType =
      typeof p.mimeType === "string" && ALLOWED_IMAGE_MIME.has(p.mimeType.trim())
        ? p.mimeType.trim()
        : null;

    if (!mimeType) {
      sendJson(res, 400, {
        error: `mimeType deve ser um de: ${[...ALLOWED_IMAGE_MIME].join(", ")}.`,
      });
      return;
    }

    const approxBytes = Math.floor((p.imageBase64.length * 3) / 4);
    if (approxBytes > 10 * 1024 * 1024) {
      sendJson(res, 413, { error: "Imagem muito grande (máx. ~10 MB)." });
      return;
    }

    try {
      const { markdown } = await analyzeReceiptWithOpenAI({
        apiKey: openaiKey,
        model: openaiModel,
        mimeType,
        imageBase64: p.imageBase64.trim(),
      });
      sendJson(res, 200, { markdown });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[paytrackr-assistant]", msg);
      sendJson(res, 502, {
        error: msg.length > 400 ? `${msg.slice(0, 400)}…` : msg,
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const openaiKey = env.OPENAI_API_KEY?.trim() || undefined;
  const openaiModel = env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const assistantMw = createAssistantMiddleware(openaiKey, openaiModel);

  return {
    plugins: [
      react(),
      {
        name: "paytrackr-lan-sync",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url ?? "";
            if (!url.startsWith("/__paytrackr-sync/state")) {
              return next();
            }

            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");

            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              return res.end();
            }

            if (req.method === "GET") {
              try {
                if (!fs.existsSync(SYNC_FILE)) {
                  res.statusCode = 404;
                  res.setHeader("Content-Type", "application/json");
                  return res.end("{}");
                }
                const raw = fs.readFileSync(SYNC_FILE, "utf8");
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                return res.end(raw);
              } catch {
                res.statusCode = 500;
                return res.end();
              }
            }

            if (req.method === "POST") {
              try {
                const body = await readBody(req);
                const parsed = JSON.parse(body) as { updatedAt?: unknown; state?: unknown };
                if (
                  typeof parsed.updatedAt !== "number" ||
                  parsed.state == null ||
                  typeof parsed.state !== "object" ||
                  !Array.isArray((parsed.state as { transactions?: unknown }).transactions)
                ) {
                  res.statusCode = 400;
                  return res.end();
                }
                fs.writeFileSync(SYNC_FILE, JSON.stringify(parsed), "utf8");
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                return res.end(JSON.stringify({ ok: true }));
              } catch {
                res.statusCode = 400;
                return res.end();
              }
            }

            res.statusCode = 405;
            return res.end();
          });
          server.middlewares.use(assistantMw);
        },
        configurePreviewServer(server) {
          server.middlewares.use(assistantMw);
        },
      },
    ],
    server: {
      host: true,
      port: 5174,
    },
  };
});
