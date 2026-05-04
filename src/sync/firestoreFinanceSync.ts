import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirestoreDb } from "../firebase/init";

/** Garante que o token do Auth está disponível antes de read/write (evita permission-denied intermitente). */
async function ensureUidAuthToken(uid: string): Promise<void> {
  const auth = getFirebaseAuth();
  const u = auth?.currentUser;
  if (!u || u.uid !== uid) return;
  try {
    await u.getIdToken(false);
  } catch {
    /* ignore */
  }
}

/** Um documento por usuário Firebase — mesmo uid que o Auth. */
const COLLECTION = "userFinances";

function lastRemoteTsKey(uid: string): string {
  return `paytrackr-finance-lastRemoteTs-v1-${uid}`;
}

/** Último `updatedAt` vindo do Firestore que já aplicamos (evita loop com o próprio upload). */
export function getLastRemoteFinanceTs(uid: string): number {
  try {
    const v = localStorage.getItem(lastRemoteTsKey(uid));
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setLastRemoteFinanceTs(uid: string, ts: number): void {
  try {
    localStorage.setItem(lastRemoteTsKey(uid), String(ts));
  } catch {
    /* ignore */
  }
}

export function isFirestoreFinanceSyncAvailable(): boolean {
  return getFirestoreDb() != null;
}

export type FinanceCloudEnvelope = { updatedAt: number; raw: string };

export async function fetchFinanceEnvelopeFromCloud(uid: string): Promise<FinanceCloudEnvelope | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  await ensureUidAuthToken(uid);
  const ref = doc(db, COLLECTION, uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    const updatedAt =
      typeof d.updatedAt === "number" && Number.isFinite(d.updatedAt) ? Math.floor(d.updatedAt) : 0;
    const stateJson = d.stateJson;
    if (typeof stateJson !== "string" || stateJson.length === 0) return null;
    return { updatedAt, raw: stateJson };
  } catch (e) {
    console.warn("paytrackr: falha ao ler finanças no Firestore (rede / regras / token).", e);
    return null;
  }
}

export async function pushFinanceEnvelopeToCloud(
  uid: string,
  updatedAt: number,
  stateJson: string,
): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;
  await ensureUidAuthToken(uid);
  if (stateJson.length > 950_000) {
    console.warn(
      "paytrackr: o estado está muito grande para um único documento no Firestore (limite ~1 MB). Considere limpar anexos muito grandes.",
    );
  }
  const ref = doc(db, COLLECTION, uid);
  try {
    await setDoc(ref, { updatedAt, stateJson }, { merge: false });
    return true;
  } catch (e) {
    console.warn("paytrackr: falha ao gravar finanças no Firestore (regras / rede / cota).", e);
    return false;
  }
}

/**
 * Escuta mudanças remotas. `onEnvelope(null)` = documento ainda não existe.
 * Erros (ex.: regras não publicadas) vão para `onError` sem derrubar o app.
 */
export function subscribeFinanceCloud(
  uid: string,
  onEnvelope: (env: FinanceCloudEnvelope | null) => void,
  onError?: (err: unknown) => void,
): () => void {
  const db = getFirestoreDb();
  if (!db) return () => {};

  const ref = doc(db, COLLECTION, uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onEnvelope(null);
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      const updatedAt =
        typeof d.updatedAt === "number" && Number.isFinite(d.updatedAt) ? Math.floor(d.updatedAt) : 0;
      const stateJson = d.stateJson;
      if (typeof stateJson !== "string" || stateJson.length === 0) {
        onEnvelope(null);
        return;
      }
      onEnvelope({ updatedAt, raw: stateJson });
    },
    (err) => {
      onError?.(err);
    },
  );
}
