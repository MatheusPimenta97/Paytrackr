type Props = {
  open: boolean;
  onClose: () => void;
  dataUrl: string | null;
  fileName: string | null;
};

export function AttachmentPreviewModal({ open, onClose, dataUrl, fileName }: Props) {
  if (!open || !dataUrl) return null;

  const isPdf = dataUrl.startsWith("data:application/pdf");

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Visualizar anexo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-outline-variant/25 px-3 py-2 dark:border-slate-700">
          <span className="min-w-0 truncate text-sm font-semibold text-primary dark:text-slate-100">
            {fileName?.trim() || "Anexo"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.open(dataUrl, "_blank", "noopener,noreferrer")}
              className="rounded-lg border border-outline-variant/40 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-container-low dark:border-slate-600 dark:text-blue-200"
            >
              Nova aba
            </button>
            <a
              href={dataUrl}
              download={fileName?.trim() || "anexo"}
              className="rounded-lg bg-primary-container px-2.5 py-1 text-xs font-semibold text-on-primary hover:opacity-90"
            >
              Baixar
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-slate-800"
            >
              Fechar
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 dark:bg-slate-950">
          {isPdf ? (
            <iframe title={fileName || "PDF"} src={dataUrl} className="h-[min(78vh,720px)] w-full border-0" />
          ) : (
            <img
              src={dataUrl}
              alt=""
              className="mx-auto block max-h-[min(78vh,720px)] w-full max-w-full object-contain p-2"
            />
          )}
        </div>
      </div>
    </div>
  );
}
