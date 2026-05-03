import type { IncomingMessage, ServerResponse } from "node:http";

import {
  ASSISTANT_IMAGE_BODY_MAX_BYTES,
  handleAssistantImagePost,
} from "../../lib/assistantImageRoute";
import type { NodeRequestWithBody } from "../../lib/readPostBodyUtf8";
import { readPostBodyUtf8 } from "../../lib/readPostBodyUtf8";
import { sendJson } from "../../lib/sendJson";

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
      bodyRaw = await readPostBodyUtf8(req as NodeRequestWithBody, ASSISTANT_IMAGE_BODY_MAX_BYTES);
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
