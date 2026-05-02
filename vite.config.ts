import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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

export default defineConfig({
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
      },
    },
  ],
  server: {
    host: true,
    port: 5174,
  },
});
