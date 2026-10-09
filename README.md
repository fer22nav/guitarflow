# GuitarFlow

Aplicación local de práctica de guitarra para macOS, desarrollada con React, TypeScript estricto, Vite y SVG. Interfaz en español, permanentemente oscura. No requiere cuentas, servicios externos ni conexión a internet durante el uso local. Incluye sonido de guía opcional: un pip suave por evento o un metrónomo. No sintetiza las notas de la guitarra.

## Abrir en esta Mac

El proyecto ya incluye una compilación en `dist/`. Hacé doble clic en **Abrir GuitarFlow.command**. Abre el navegador en `http://127.0.0.1:5173` e inicia un servidor local en segundo plano. El archivo `.command` puede abrir brevemente Terminal por el mecanismo de macOS, pero no necesitás escribir comandos. **Cerrar GuitarFlow.command** detiene el servidor de producción.

Se necesita Node.js 20.19+ o 22.12+. Si Node está instalado con un gestor como nvm, el lanzador hereda la configuración de zsh; también busca `/opt/homebrew/bin` y `/usr/local/bin`. Si macOS solicita autorización para abrir el archivo, usá clic derecho → Abrir.

## Instalar en otra Mac o actualizar

Desde la carpeta `guitarflow`:

```sh
npm ci
npm run build
```

Después podés usar el lanzador con doble clic sin internet. Para desarrollo:

```sh
npm run dev
```

Para servir la compilación sin abrir automáticamente el navegador:

```sh
npm start
```

El puerto y origen siempre son `127.0.0.1:5173`, tanto en desarrollo como en producción, para conservar la misma biblioteca. No abras `dist/index.html` directamente con `file://`.

## Practicar

1. La pantalla principal muestra el mástil y los controles. Abrí **Menú → Canciones** para elegir un estudio. **Cargar tablatura** permite pegar texto o importar una captura en una canción nueva.
2. Usá **Cargar tablatura → Importar captura** para elegir PNG/JPG/WebP, arrastrar una imagen o pegarla con ⌘V. La lectura OCR se realiza localmente, con los archivos incluidos en la compilación. Revisá la imagen y el texto detectado y confirmá números, técnicas y alineación antes de interpretar. Las capturas de tablatura gráfica o pentagramas necesitan transcripción manual. También podés pegar tablatura ASCII con seis filas y pulsá **Interpretar tablatura**. El texto conserva su espaciado; las filas deben estar alineadas con fuente monoespaciada.
3. En **Secuencia**, la altura representa la cuerda y el círculo contiene el traste. La posición horizontal representa el orden temporal, incluso en notas repetidas. Las divisiones del fondo son visuales, no números de trastes.
4. En **Mástil físico**, las notas se colocan en su traste real. Las repeticiones comparten posición y se activan individualmente. La posición 0 es un espacio dedicado para cuerdas al aire.
5. Hacé clic en una nota para comenzar desde ahí. Para editarla, abrí **Menú → Editar nota seleccionada**. Las técnicas enlazadas usan la siguiente nota de la misma cuerda. La duración de un acorde pertenece al evento completo.
6. Abrí **Menú → Fragmentos** y usá **Seleccionar fragmento**, clic en inicio y clic en final. Ambos extremos están incluidos. También funciona Shift + clic. Poné un nombre y guardalo. **Bucle** repite el rango seleccionado o toda la canción; la pausa entre vueltas se configura en ajustes.
7. Los controles permiten pausar, detener, reiniciar, avanzar o retroceder eventos simultáneos, modificar BPM y variar la velocidad de 25% a 200%.
8. En **Menú → Ajustes** configurá zoom, tamaño de marcadores, 12–24 trastes, zona física, afinación manual y ritmo.

## Ritmo y precisión

ASCII no aporta por sí solo duraciones musicales exactas. Los guiones y espacios se conservan como referencia relativa, no se interpretan automáticamente como silencios musicales. La reproducción inicial usa **4 columnas por pulso**, ajustables. Siempre se muestra **Ritmo aproximado**. Podés usar duración uniforme, editar la duración de cada evento, añadir silencios posteriores o insertar un evento de silencio. El BPM y la velocidad cambian la reproducción, no los trastes.

Las técnicas `17b18`, `13b15~~` y `15r13` conservan un solo origen físico; el destino es información de la técnica. `12/15`, `15\12`, `12h15` y `15p12` conservan dos notas relacionadas. `~` o `v` indican vibrato y `x` una nota apagada.

Las afinaciones se guardan de cuerda 1 a 6 (aguda a grave). Estándar: `E B G D A E`. Drop D: `E B G D A D`. Drop C: `D A F C G C`. Elegir una afinación nunca transpone los trastes. La afinación determina la clase de altura musical en el modelo; el sonido de guía no utiliza esas alturas musicales.

## Repeticiones y formato

Se soportan `x2`, `repeat 4 times`, `repetir 4 veces` inmediatamente después de un bloque, `x2` al final de las filas y barras emparejadas `|: :|` / `||o o||` dentro del mismo bloque. Las barras sin cantidad explícita significan dos vueltas. Los bloques consecutivos continúan la secuencia; los títulos previos se conservan como nombres de bloque, sin cortar frases por cantidad de notas.

Repeticiones con rangos incompletos, números contradictorios, casillas de primera/segunda vuelta, anidamientos o instrucciones textuales no inequívocas necesitan intervención manual. La aplicación muestra el aviso y bloquea la reproducción ante repeticiones ambiguas reconocidas. Corregí el texto o seleccioná un rango y aplicá una repetición manual, que reemplaza las repeticiones superpuestas y resuelve los avisos de repetición. No se inventan notas para símbolos desconocidos. Los bloques incompletos o trastes fuera de 0–24 se rechazan; el borrador queda disponible para corregirlo.

## Guardado y recuperación

IndexedDB guarda automáticamente canciones, borradores, ajustes, fragmentos, preferencias y posición de práctica. Las capturas originales también se guardan con la canción. Reinterpretar conserva hasta diez versiones previas del texto, modelo y fragmentos. Si hay ediciones manuales, aparece una confirmación antes de reemplazarlas. **Menú → Editar tablatura → Versiones anteriores → Recuperar versión** permite volver atrás.

**Menú → Ajustes → Sonido de guía** permite elegir Silencio, Pip por evento o Metrónomo. El pip se dispara una vez por evento con notas, incluso en acordes, y no en silencios. El metrónomo sigue el BPM y la velocidad. El volumen se configura en ajustes; el navegador activa el audio después de una interacción. El ritmo de guía sigue siendo aproximado para ASCII sin tiempos explícitos.

La biblioteca pertenece al navegador y al origen usado. Otro navegador, otro puerto o Vercel tienen almacenamiento independiente. Borrar datos del navegador elimina la biblioteca: exportá JSON para trasladarla o conservar una copia. La importación añade canciones como copias con nuevos identificadores, sin reemplazar las existentes; se valida el formato antes de escribir. SVG y PNG exportan el fragmento seleccionado o el modelo completo de la vista actual, con estilos incluidos.

## Pruebas

```sh
npm test
npm run build
```

Incluye pruebas de parser, modelo, geometría SVG, reproducción y almacenamiento IndexedDB. Para las pruebas del navegador:

```sh
npx playwright install chromium
npm run test:e2e
```

Los estudios incluidos son composiciones de prueba propias. No se incluyen canciones comerciales. Las convenciones de importación se contrastaron con tablaturas ASCII y leyendas de [GoTabs](https://www.gotabs.com/candlebox/far-behind-tab); no se copiaron sus canciones.

## Arquitectura

- `src/core/TabParser.ts`: parser y diagnósticos, columnas de origen y repeticiones.
- `src/core/MusicModel.ts`: eventos simultáneos, técnicas, afinación y tiempos.
- `src/components/FretboardRenderer.tsx`: fondo SVG y posiciones físicas.
- `src/components/TimelineRenderer.tsx`: secuencia continua y selección.
- `src/core/PlaybackController.ts`: cursor, transporte, velocidad, rangos y bucles.
- `src/core/SongLibrary.ts`: IndexedDB y transacciones.
- `src/core/ImageImport.ts`: OCR local y recuperación aproximada de columnas, con revisión obligatoria.
- `src/core/CueAudio.ts`: sonido de guía mediante Web Audio, sin archivos remotos.
- `src/core/ImportExport.ts`: biblioteca JSON y exportación SVG/PNG.

## GitHub y Vercel

El proyecto contiene `.gitignore`, un lockfile y `vercel.json`. Está preparado para subir el código a GitHub y desplegar la compilación estática en Vercel. No hace falta servidor de aplicación ni variables secretas. El despliegue remoto no comparte automáticamente la biblioteca local: importá su JSON en el nuevo origen. La versión local continúa funcionando sin internet.
