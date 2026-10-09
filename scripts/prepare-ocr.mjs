import { mkdir, copyFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const dest = path.join(root, "public/ocr");
await mkdir(dest, { recursive: true });
const worker = path.join(
  path.dirname(require.resolve("tesseract.js/package.json")),
  "dist/worker.min.js",
);
await copyFile(worker, path.join(dest, "worker.min.js"));
const core = path.dirname(require.resolve("tesseract.js-core/package.json"));
for (const name of await readdir(core))
  if (name.endsWith(".wasm.js") || name.endsWith(".wasm"))
    await copyFile(path.join(core, name), path.join(dest, name));
const data = require("@tesseract.js-data/eng");
await copyFile(
  path.join(data.langPath, "eng.traineddata.gz"),
  path.join(dest, "eng.traineddata.gz"),
);
await copyFile(
  path.join(core, "LICENSE"),
  path.join(dest, "LICENSE-tesseract-core.txt"),
);
console.log("Motor OCR y datos preparados para uso local, sin CDN.");
