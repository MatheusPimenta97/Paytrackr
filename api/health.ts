import type { IncomingMessage, ServerResponse } from "node:http";

import { sendJson } from "./lib/sendJson";

/** GET — confirma que as Serverless Functions estão no deploy (sem segredos). */
export default function handler(_req: IncomingMessage, res: ServerResponse) {
  sendJson(res, 200, { ok: true, service: "paytrackr" });
}
