import type { VercelRequest, VercelResponse } from "@vercel/node";

/** GET — confirma que as Serverless Functions estão no deploy (sem segredos). */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: true, service: "paytrackr" }));
}
