import type { ServerResponse } from "node:http";

/** Uma única escrita: evita crash (headers já enviados) se JSON.stringify falhar. */
export function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
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
