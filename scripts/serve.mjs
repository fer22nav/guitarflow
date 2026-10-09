import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const port = 5173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".wasm": "application/wasm",
};
try {
  await stat(path.join(root, "index.html"));
} catch {
  console.error(
    "Falta compilar GuitarFlow. Ejecutá npm install y npm run build una vez.",
  );
  process.exit(1);
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let file = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (url.pathname === "/") file = path.join(root, "index.html");
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Archivo no encontrado");
  }
});
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? "El puerto 5173 está ocupado. Cerrá la otra instancia de GuitarFlow."
      : error,
  );
  process.exit(1);
});
server.listen(port, "127.0.0.1", () =>
  console.log(`GuitarFlow disponible en http://127.0.0.1:${port}`),
);
