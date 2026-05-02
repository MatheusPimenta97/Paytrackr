const MAX_SIDE = 400;
/** Limite aproximado do data URL em caracteres (localStorage). */
const MAX_DATA_URL_CHARS = 1_800_000;

/**
 * Redimensiona e comprime imagem para JPEG; retorna data URL persistível.
 */
export async function imageFileToProfilePhotoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie um arquivo de imagem (JPG, PNG, etc.).");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const w = bitmap.width;
    const h = bitmap.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a imagem neste navegador.");
    ctx.drawImage(bitmap, 0, 0, cw, ch);
    let q = 0.88;
    let dataUrl = canvas.toDataURL("image/jpeg", q);
    while (dataUrl.length > MAX_DATA_URL_CHARS && q > 0.45) {
      q -= 0.07;
      dataUrl = canvas.toDataURL("image/jpeg", q);
    }
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error("Imagem ainda grande demais. Tente outra foto.");
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
