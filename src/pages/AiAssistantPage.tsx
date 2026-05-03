import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { analyzePaymentReceiptImage } from "../services/aiAssistant";

/** Arquivo local pode ser maior; antes do POST a imagem é comprimida (limite ~4,5 MB na Vercel). */
const MAX_BYTES = 12 * 1024 * 1024;

export function AiAssistantPage() {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onPickFile = useCallback((file: File | null) => {
    setError(null);
    setResult(null);
    setDemoMode(false);
    if (!file) {
      setPreview(null);
      setFileLabel("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Escolha um arquivo de imagem (JPEG, PNG, WebP…).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Imagem grande demais (máx. ${Math.round(MAX_BYTES / 1024 / 1024)} MB).`);
      return;
    }
    setFileLabel(file.name);
    const url = URL.createObjectURL(file);
    setPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const runAssistant = useCallback(async () => {
    if (!preview) {
      setError("Tire uma foto ou envie uma imagem do comprovante.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let dataUrl = preview;
      if (preview.startsWith("blob:")) {
        const blob = await fetch(preview).then((r) => r.blob());
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
          reader.readAsDataURL(blob);
        });
      }
      const out = await analyzePaymentReceiptImage(dataUrl);
      setResult(out.markdown);
      setDemoMode(out.demoMode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao processar.");
    } finally {
      setLoading(false);
    }
  }, [preview]);

  const explicitAssistantUrl = import.meta.env.VITE_AI_ASSISTANT_URL?.trim();
  const usesDevProxy = import.meta.env.DEV && !explicitAssistantUrl;
  const configured = Boolean(explicitAssistantUrl) || import.meta.env.DEV;

  return (
    <div className="mx-auto max-w-3xl px-6 pb-28 pt-24 md:ml-[72px] md:pb-12 md:pt-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-md">
          <span className="material-symbols-outlined text-[28px]">document_scanner</span>
        </div>
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-primary dark:text-slate-100">
            Comprovantes com IA
          </h1>
          <p className="text-sm text-on-surface-variant dark:text-slate-400">
            Tire foto do comprovante (Pix, transferência, boleto pago…) — o agente interpreta valores e dados para você conferir e lançar (experimental).
          </p>
        </div>
      </div>

      <div
        className={`mb-6 rounded-xl border px-4 py-3 text-sm ${configured ? "border-secondary-container/50 bg-secondary-container/15 text-on-secondary-container dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-outline-variant/30 bg-surface-container-low dark:border-slate-700 dark:bg-slate-900/80"}`}
      >
        <p className="font-semibold text-primary dark:text-slate-100">
          {usesDevProxy
            ? "Desenvolvimento — proxy local (/api/paytrackr/assistant/image)"
            : !configured
              ? "Modo demo — sem chamada externa"
              : "Endpoint configurado (VITE_AI_ASSISTANT_URL)"}
        </p>
        <p className="mt-1 text-on-surface-variant dark:text-slate-400">
          {usesDevProxy
            ? "O Vite encaminha para a OpenAI usando OPENAI_API_KEY do .env (reinicie o dev server após alterar o .env). Em produção na Vercel, imagens são reduzidas antes do envio para caber no limite do servidor (~4,5 MB)."
            : configured
              ? "As fotos são comprimidas no navegador antes do envio (requisito em hosts como a Vercel, ~4,5 MB). Dados sensíveis — revise LGPD e custo da API de visão."
              : "Configure VITE_AI_ASSISTANT_URL no .env (e faça novo build) ou use npm run dev com o proxy local."}
        </p>
      </div>

      <section className="mb-8 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <label htmlFor={inputId} className="mb-3 block text-sm font-bold text-primary dark:text-slate-100">
          Foto do comprovante
        </label>
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          capture="environment"
          className="sr-only"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-container"
          >
            Escolher arquivo
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold hover:bg-surface-container-low dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Tirar foto (comprovante)
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => {
                onPickFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-sm font-semibold text-error hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
        {fileLabel ? (
          <p className="mt-2 text-xs text-on-surface-variant">{fileLabel}</p>
        ) : null}

        {preview ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-low dark:border-slate-700">
            <img src={preview} alt="Pré-visualização do comprovante" className="max-h-64 w-full object-contain" />
          </div>
        ) : null}

        <button
          type="button"
          disabled={loading || !preview}
          onClick={() => void runAssistant()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#001430] to-[#002855] py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40 sm:w-auto sm:px-8"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processando…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
              Ler comprovante
            </>
          )}
        </button>

        {error ? (
          <p className="mt-4 rounded-lg bg-error-container/50 px-3 py-2 text-sm font-medium text-on-error-container dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      {result ? (
        <section className="rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-headline text-lg font-bold text-primary dark:text-slate-100">Resultado</h2>
            {demoMode ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Demo
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(result)}
              className="text-xs font-bold text-secondary hover:underline dark:text-emerald-300"
            >
              Copiar texto
            </button>
          </div>
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface dark:bg-slate-900 dark:text-slate-200">
            {result}
          </pre>
          <p className="mt-4 text-xs text-on-surface-variant dark:text-slate-400">
            Confira valores e dados antes de registrar — em seguida abra{" "}
            <Link to="/lancamentos?novo=1" className="font-bold text-primary underline dark:text-blue-300">
              Novo lançamento
            </Link>
            .
          </p>
        </section>
      ) : null}
    </div>
  );
}
