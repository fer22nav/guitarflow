#!/bin/zsh
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "GuitarFlow necesita Node.js" message "Instalá Node.js 20 o superior y seguí los pasos iniciales del README."'
  exit 1
fi
if [[ ! -f dist/index.html ]]; then
  osascript -e 'display alert "Falta preparar GuitarFlow" message "Ejecutá npm install y npm run build una vez, como indica el README."'
  exit 1
fi
if curl -fsS --max-time 2 http://127.0.0.1:5173/ 2>/dev/null | /usr/bin/grep -q 'GuitarFlow'; then
  open http://127.0.0.1:5173
  exit 0
fi
node scripts/serve.mjs > "${TMPDIR:-/tmp/}guitarflow-local.log" 2>&1 &
GUITARFLOW_PID=$!
for attempt in {1..30}; do
  if curl -fsS --max-time 1 http://127.0.0.1:5173/ 2>/dev/null | /usr/bin/grep -q 'GuitarFlow'; then
    open http://127.0.0.1:5173
    disown "$GUITARFLOW_PID" 2>/dev/null
    exit 0
  fi
  sleep 0.1
done
osascript -e 'display alert "No se pudo abrir GuitarFlow" message "Revisá si otra aplicación utiliza el puerto 5173. El registro está en la carpeta temporal: guitarflow-local.log."'
exit 1
