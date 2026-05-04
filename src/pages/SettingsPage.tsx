import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { parseMoneyInput } from "../domain/money";

export function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, mode, userEmail } = useAuth();
  const saldoSectionRef = useRef<HTMLElement>(null);
  const syncSectionRef = useRef<HTMLElement>(null);
  const { resetData, state, setAccountBalance, exportBackup, restoreBackup, copyBackupToClipboard } =
    useFinance();
  const backupInputRef = useRef<HTMLInputElement>(null);
  const primary = state.accounts.find((a) => a.id === state.defaultAccountId);
  const [saldoInput, setSaldoInput] = useState("");
  const [pasteJson, setPasteJson] = useState("");
  const [copyOk, setCopyOk] = useState<string | null>(null);

  useEffect(() => {
    if (location.hash === "#saldo-real" && saldoSectionRef.current) {
      saldoSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (location.hash === "#sync-outros" && syncSectionRef.current) {
      syncSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  const applySaldoReal = () => {
    const n = parseMoneyInput(saldoInput);
    if (n === null) {
      alert("Digite um valor válido (ex.: 1.234,56).");
      return;
    }
    setAccountBalance(state.defaultAccountId, n);
    setSaldoInput("");
  };

  return (
    <div className="mx-auto max-w-2xl px-6 pb-12 md:px-12">
      <h1 className="mb-2 font-headline text-3xl font-extrabold text-primary">Configurações</h1>
      {mode === "firebase" && userEmail && (
        <p className="mb-2 text-sm text-on-surface-variant">
          Sessão Firebase: <span className="font-semibold text-primary">{userEmail}</span>
        </p>
      )}
      <p className="mb-4 text-on-surface-variant">
        {mode === "firebase" ? (
          <>
            Dados neste aparelho: {state.transactions.length} lançamentos, {state.goals.length} metas,{" "}
            {state.recurringExpenses.length} recorrentes. Com a conta Firebase e o Firestore configurados, o app
            sincroniza automaticamente entre navegadores (última gravação vence). Publique as regras em{" "}
            <code className="rounded bg-surface-container-high px-1">firestore.rules</code> no Console do Firebase.
          </>
        ) : (
          <>
            Modo demo: tudo fica só neste navegador ({state.transactions.length} lançamentos, {state.goals.length}{" "}
            metas, {state.recurringExpenses.length} recorrentes). Use o backup abaixo para copiar para outro aparelho.
          </>
        )}
      </p>
      <p className="mb-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
        <Link
          to="/perfil"
          className="text-sm font-bold text-secondary underline-offset-2 hover:underline"
        >
          Meu perfil — nome e salário mensal
        </Link>
        <Link
          to="/assistente"
          className="text-sm font-bold text-primary underline-offset-2 hover:underline dark:text-blue-300"
        >
          Assistente IA — foto de comprovante / agente (experimental)
        </Link>
      </p>

      <section
        ref={saldoSectionRef}
        id="saldo-real"
        className="mb-6 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6"
      >
        <h2 className="mb-2 font-headline text-lg font-bold text-primary">Saldo real</h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          Ajuste o saldo da conta principal para bater com o extrato do banco. Os lançamentos já
          cadastrados não são apagados; daqui pra frente, entradas e saídas continuam somando e
          subtraindo a partir deste valor.
        </p>
        <p className="mb-3 text-sm text-primary">
          Conta: <span className="font-semibold">{primary?.name ?? "Principal"}</span>
          <span className="mx-2 text-on-surface-variant">·</span>
          Saldo atual: <span className="font-semibold">{formatBRL(primary?.balance ?? 0)}</span>
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-primary">
            Novo saldo (R$)
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ex.: 3.450,00"
              value={saldoInput}
              onChange={(e) => setSaldoInput(e.target.value)}
              className="rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-primary outline-none ring-primary/30 focus:ring-2"
            />
          </label>
          <button
            type="button"
            onClick={applySaldoReal}
            className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary/90"
          >
            Definir saldo real
          </button>
        </div>
      </section>

      <section
        ref={syncSectionRef}
        id="sync-outros"
        className="mb-6 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6"
      >
        <h2 className="mb-2 font-headline text-lg font-bold text-primary">Outro aparelho (backup)</h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          <strong className="text-on-surface">Produção / site hospedado:</strong> cada aparelho tem sua cópia —
          use exportar/colar ou arquivo. <strong className="text-on-surface">Só em desenvolvimento</strong>{" "}
          (<code className="rounded bg-surface-container-high px-1">npm run dev</code>): se os dois notebooks abrirem o{" "}
          <strong className="text-on-surface">mesmo IP do PC que está rodando o Vite</strong> (só um deles pode
          rodar o servidor), os dados passam a ser espelhados num arquivo na pasta do projeto; aguarde alguns
          segundos ou troque de aba para atualizar.
        </p>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => exportBackup()}
            className="rounded-lg bg-secondary px-4 py-2.5 text-sm font-bold text-on-secondary shadow-sm transition-colors hover:brightness-95"
          >
            Baixar backup (.json)
          </button>
          <button
            type="button"
            onClick={async () => {
              setCopyOk(null);
              const ok = await copyBackupToClipboard();
              setCopyOk(ok ? "Copiado. Cole no outro aparelho em “Colar backup” abaixo." : "Não foi possível copiar (permissão do navegador). Use baixar .json.");
              window.setTimeout(() => setCopyOk(null), 6000);
            }}
            className="rounded-lg border border-secondary/50 bg-surface-container-high px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
          >
            Copiar para área de transferência
          </button>
          <button
            type="button"
            onClick={() => backupInputRef.current?.click()}
            className="rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
          >
            Restaurar de arquivo…
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                const text = typeof reader.result === "string" ? reader.result : "";
                if (
                  !confirm(
                    "Substituir todos os dados deste aparelho pelo backup? Isso não pode ser desfeito."
                  )
                ) {
                  return;
                }
                const err = restoreBackup(text);
                if (err) alert(err);
              };
              reader.readAsText(f, "UTF-8");
            }}
          />
        </div>
        {copyOk && <p className="mb-4 text-sm font-medium text-secondary">{copyOk}</p>}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Colar backup (JSON)
          </label>
          <textarea
            value={pasteJson}
            onChange={(e) => setPasteJson(e.target.value)}
            placeholder='Cole aqui o conteúdo copiado ou de um arquivo .json…'
            rows={5}
            className="w-full resize-y rounded-lg border border-outline-variant/30 bg-white px-3 py-2 font-mono text-xs text-primary"
          />
          <button
            type="button"
            onClick={() => {
              if (!pasteJson.trim()) {
                alert("Cole o JSON do backup.");
                return;
              }
              if (
                !confirm(
                  "Substituir todos os dados deste aparelho pelo texto colado? Isso não pode ser desfeito."
                )
              ) {
                return;
              }
              const err = restoreBackup(pasteJson.trim());
              if (err) alert(err);
              else setPasteJson("");
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary"
          >
            Restaurar do texto colado
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6">
        <h2 className="mb-2 font-headline text-lg font-bold text-primary">Sessão</h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          Encerre a sessão neste navegador. Seus dados locais permanecem salvos.
        </p>
        <button
          type="button"
          onClick={() => {
            void logout();
            navigate("/login", { replace: true });
          }}
          className="rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
        >
          Sair da conta
        </button>
      </section>

      <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6">
        <h2 className="mb-2 font-headline text-lg font-bold text-primary">Dados</h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          Restaura os valores de demonstração e apaga lançamentos e metas criados por você.
        </p>
        <button
          type="button"
          onClick={() => {
            if (confirm("Restaurar dados de demonstração? Isso apaga alterações locais.")) resetData();
          }}
          className="rounded-lg bg-error px-4 py-2 text-sm font-bold text-on-error"
        >
          Restaurar dados demo
        </button>
      </div>
    </div>
  );
}
