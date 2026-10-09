import type { Line } from "tesseract.js";
export interface OCRResult {
  text: string;
  confidence: number;
  dataUrl: string;
  name: string;
}
// Recover relative columns from OCR bounding boxes; do not infer or substitute notes.
export function textFromLines(
  lines: Pick<Line, "words" | "bbox" | "text">[],
): string {
  const symbols = lines.flatMap((l) => l.words.flatMap((w) => w.symbols));
  const widths = symbols
    .filter((s) => /^[0-9A-Ga-g]$/.test(s.text))
    .map((s) => s.bbox.x1 - s.bbox.x0)
    .filter((w) => w > 0)
    .sort((a, b) => a - b);
  if (!widths.length) return lines.map((l) => l.text.trimEnd()).join("\n");
  const advances = lines
    .flatMap((l) => {
      const chars = l.words.flatMap((w) => w.symbols);
      return chars
        .slice(1)
        .map((s, i) => s.bbox.x0 - chars[i].bbox.x0)
        .filter(
          (d) =>
            d >= widths[0] * 0.8 &&
            d < widths[Math.floor(widths.length / 2)] * 2,
        );
    })
    .sort((a, b) => a - b);
  const cell = advances.length
    ? advances[Math.floor(advances.length / 2)]
    : widths[Math.floor(widths.length / 2)] * 1.3;
  const left = Math.min(...lines.map((l) => l.bbox.x0));
  return lines
    .map((l) => {
      let text = "";
      for (const s of l.words.flatMap((w) => w.symbols)) {
        const column = Math.max(
          text.length,
          Math.round((s.bbox.x0 - left) / cell),
        );
        text += " ".repeat(Math.min(1000, column - text.length)) + s.text;
      }
      return text || l.text.trimEnd();
    })
    .join("\n");
}
export async function readCapture(
  file: File,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
): Promise<OCRResult> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Elegí una captura PNG, JPG o WebP.");
  if (file.size > 12_000_000)
    throw new Error("La captura supera 12 MB. Recortá la zona de tablatura.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("No se pudo abrir la imagen."));
    r.readAsDataURL(file);
  });
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Imagen inválida."));
    image.src = dataUrl;
  });
  if (image.width * image.height > 24_000_000)
    throw new Error(
      "La captura es demasiado grande. Recortá solamente la tablatura.",
    );
  const { createWorker, PSM } = await import("tesseract.js");
  if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    langPath: "/ocr",
    corePath: "/ocr",
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === "recognizing text")
        onProgress(Math.round(m.progress * 100));
    },
  });
  const abort = () => {
    void worker.terminate();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      user_defined_dpi: "300",
    });
    const { data } = await worker.recognize(
      dataUrl,
      {},
      { text: true, blocks: true },
    );
    const lines =
      data.blocks?.flatMap((b) => b.paragraphs.flatMap((p) => p.lines)) ?? [];
    return {
      text: lines.length ? textFromLines(lines) : data.text,
      confidence: data.confidence,
      dataUrl,
      name: file.name,
    };
  } finally {
    signal.removeEventListener("abort", abort);
    await worker.terminate();
  }
}
