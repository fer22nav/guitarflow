import { type Song, validateModel } from "./MusicModel";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportLibrary(songs: Song[]) {
  download(
    new Blob(
      [JSON.stringify({ format: "guitarflow", version: 1, songs }, null, 2)],
      { type: "application/json" },
    ),
    "guitarflow-biblioteca.json",
  );
}
export function readLibrary(text: string): Song[] {
  const value = JSON.parse(text);
  if (
    value.format !== "guitarflow" ||
    value.version !== 1 ||
    !Array.isArray(value.songs) ||
    value.songs.length > 1000
  )
    throw new Error("Archivo de biblioteca GuitarFlow inválido.");
  for (const s of value.songs) {
    if (
      typeof s.id !== "string" ||
      typeof s.title !== "string" ||
      typeof s.artist !== "string" ||
      typeof s.text !== "string" ||
      !validateModel(s.model) ||
      !Array.isArray(s.sections) ||
      !s.sections.every(
        (f: Song["sections"][number]) =>
          typeof f.id === "string" &&
          typeof f.name === "string" &&
          Number.isInteger(f.start) &&
          Number.isInteger(f.end) &&
          f.start >= 0 &&
          f.end >= f.start &&
          f.end < s.model.events.length,
      ) ||
      !Array.isArray(s.revisions) ||
      !s.revisions.every(
        (r: Song["revisions"][number]) =>
          typeof r.text === "string" &&
          validateModel(r.model) &&
          Array.isArray(r.sections),
      ) ||
      !Number.isInteger(s.position) ||
      s.position < 0 ||
      s.position >= Math.max(1, s.model.events.length) ||
      typeof s.manualEdits !== "boolean"
    )
      throw new Error("La biblioteca contiene una canción o modelo inválido.");
  }
  return value.songs;
}
export async function exportVisual(
  svg: SVGSVGElement,
  format: "svg" | "png",
  name: string,
) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const box = svg.viewBox.baseVal;
  clone.setAttribute("width", String(box.width));
  clone.setAttribute("height", String(box.height));
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml",
  });
  if (format === "svg") {
    download(blob, `${name}.svg`);
    return;
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo generar el PNG."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    const scale = Math.min(2, 16000 / box.width);
    canvas.width = box.width * scale;
    canvas.height = box.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("No se pudo exportar."))),
        "image/png",
      ),
    );
    download(png, `${name}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
