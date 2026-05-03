import type { VercelRequest, VercelResponse } from "@vercel/node";

import {
  ASSISTANT_IMAGE_BODY_MAX_BYTES,
  handleAssistantImagePost,
} from "../../lib/assistantImageRoute";
import { readPostBodyUtf8 } from "../../lib/readPostBodyUtf8";

export const config = {
  api: {
    bodyParser: false,
  },
};

function sendJson(res: VercelResponse, status: number, json: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    res.end(JSON.stringify(json));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Falha ao serializar resposta JSON." }));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      bodyRaw = await readPostBodyUtf8(req, ASSISTANT_IMAGE_BODY_MAX_BYTES);
    } catch {
      sendJson(res, 413, { error: "Corpo da requisição muito grande." });
      return;
    }

    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

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
}
