import { useEffect, useRef, useState } from "react";
import { readCapture, type OCRResult } from "../core/ImageImport";
import { Icon } from "./Icon";
export function CaptureImporter({
  onResult,
  onClose,
}: {
  onResult: (r: OCRResult) => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => () => abort.current?.abort(), []);
  async function read(file: File) {
    if (busy) return;
    setBusy(true);
    setError("");
    setProgress(0);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const r = await readCapture(file, setProgress, controller.signal);
      if (!controller.signal.aborted) onResult(r);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="capture-import"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) void read(file);
      }}
      onPaste={(e) => {
        const item = [...e.clipboardData.items].find((i) =>
          i.type.startsWith("image/"),
        );
        if (item) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) void read(file);
        }
      }}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">DE LA CAPTURA AL MÁSTIL</span>
          <h2>Importar captura de tablatura</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Cerrar importación de captura"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="capture-drop" tabIndex={0}>
        <Icon name="upload" size={28} />
        <strong>
          {busy
            ? `Leyendo captura… ${progress}%`
            : "Arrastrá una captura, pegala con ⌘V o elegí un archivo"}
        </strong>
        <p>PNG, JPG o WebP · Recortá solo el bloque de seis cuerdas ASCII.</p>
        <button
          className="primary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Icon name="plus" /> Elegir captura
        </button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void read(f);
          }}
        />
        {busy && <progress max="100" value={progress} />}
      </div>
      <p className="muted">
        La lectura se realiza en tu Mac. Después vas a ver la imagen y el texto
        detectado para revisar números, técnicas y alineación. Las capturas de
        pentagramas o tablatura gráfica necesitan transcripción manual.
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </section>
  );
}
