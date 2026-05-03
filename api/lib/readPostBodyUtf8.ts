import type { IncomingMessage } from "node:http";
import type { VercelRequest } from "@vercel/node";

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

/**
 * Corpo UTF-8 do POST: usa req.body quando a runtime já entregou buffer/string,
 * senão lê o stream (bodyParser: false).
 */
export function readPostBodyUtf8(req: VercelRequest, maxBytes: number): Promise<string> {
  const b = req.body as unknown;
  if (typeof b === "string") {
    if (Buffer.byteLength(b, "utf8") > maxBytes) return Promise.reject(new Error("body too large"));
    return Promise.resolve(b);
  }
  if (Buffer.isBuffer(b)) {
    if (b.length > maxBytes) return Promise.reject(new Error("body too large"));
    return Promise.resolve(b.toString("utf8"));
  }
  return readBodyStream(req as IncomingMessage, maxBytes);
}
