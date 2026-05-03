/**
 * Alias estável em `/api/assistant-image` — mesmo comportamento que
 * `/api/paytrackr/assistant/image` (útil se houver problema com rotas aninhadas na Vercel).
 * Para usar no frontend: `VITE_AI_ASSISTANT_URL=/api/assistant-image`
 */
export { default } from "./paytrackr/assistant/image";
