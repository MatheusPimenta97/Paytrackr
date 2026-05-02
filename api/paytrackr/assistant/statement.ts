import type { IncomingMessage } from "node:http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import {
  handleStatementAnalyzePost,
  STATEMENT_DOCUMENT_BODY_MAX_BYTES,
} from "../../../server/statementAnalyzeRoute";

export const config = {
  api: {
    bodyParser: false,
  },
};

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (c: Buffer) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error("body too large"));
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    bodyRaw = await readBody(req, STATEMENT_DOCUMENT_BODY_MAX_BYTES);
  } catch {
    res.statusCode = 413;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Corpo da requisição muito grande." }));
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const result = await handleStatementAnalyzePost(bodyRaw, { openaiKey, openaiModel });
  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(result.json));
}
