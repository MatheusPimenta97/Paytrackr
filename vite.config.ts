import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import {
  ASSISTANT_IMAGE_BODY_MAX_BYTES,
  ASSISTANT_IMAGE_HTTP_PATH,
  handleAssistantImagePost,
} from "./api/lib/assistantImageRoute";
import {
  ASSISTANT_STATEMENT_HTTP_PATH,
  handleStatementAnalyzePost,
  STATEMENT_DOCUMENT_BODY_MAX_BYTES,
} from "./api/statement";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYNC_FILE = path.join(__dirname, ".paytrackr-lan-sync.json");

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
    if (pathname !== ASSISTANT_IMAGE_HTTP_PATH) {
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

    let bodyRaw: string;
    try {
      bodyRaw = await readBodyLimited(req, ASSISTANT_IMAGE_BODY_MAX_BYTES);
    } catch {
      sendJson(res, 413, { error: "Corpo da requisição muito grande." });
      return;
    }

    try {
      const result = await handleAssistantImagePost(bodyRaw, { openaiKey, openaiModel });
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
  };
}

function createStatementAssistantMiddleware(openaiKey: string | undefined, openaiModel: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = req.url?.split("?")[0] ?? "";
    if (pathname !== ASSISTANT_STATEMENT_HTTP_PATH) {
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

    let bodyRaw: string;
    try {
      bodyRaw = await readBodyLimited(req, STATEMENT_DOCUMENT_BODY_MAX_BYTES);
    } catch {
      sendJson(res, 413, { error: "Corpo da requisição muito grande." });
      return;
    }

    try {
      const result = await handleStatementAnalyzePost(bodyRaw, { openaiKey, openaiModel });
      sendJson(res, result.status, result.json);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[paytrackr-assistant-statement]", msg);
      sendJson(res, 500, {
        error:
          msg.length > 300
            ? `Erro interno ao processar o pedido: ${msg.slice(0, 300)}…`
            : `Erro interno ao processar o pedido: ${msg}`,
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const openaiKey = env.OPENAI_API_KEY?.trim() || undefined;
  const openaiModel = env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const assistantMw = createAssistantMiddleware(openaiKey, openaiModel);
  const statementMw = createStatementAssistantMiddleware(openaiKey, openaiModel);

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
          server.middlewares.use(statementMw);
        },
        configurePreviewServer(server) {
          server.middlewares.use(assistantMw);
          server.middlewares.use(statementMw);
        },
      },
    ],
    server: {
      host: true,
      port: 5174,
    },
  };
});
