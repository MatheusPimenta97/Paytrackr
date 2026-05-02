/** Sincronização em dev via arquivo no PC que roda `npm run dev` (ver vite.config). */

const PATH = "/__paytrackr-sync/state";

export type LanSyncEnvelope = { updatedAt: number; state: unknown };

export async function pullLanDevSync(): Promise<LanSyncEnvelope | null> {
  try {
    const r = await fetch(PATH);
    if (!r.ok) return null;
    const data = (await r.json()) as LanSyncEnvelope;
    if (typeof data.updatedAt !== "number" || data.state == null || typeof data.state !== "object") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function pushLanDevSync(env: LanSyncEnvelope): Promise<boolean> {
  try {
    const r = await fetch(PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(env),
    });
    return r.ok;
  } catch {
    return false;
  }
}
