import {
  type MusicModel,
  type MusicEvent,
  type Note,
  type Technique,
  type Diagnostic,
  TUNINGS,
} from "./MusicModel";
interface Row {
  label: string;
  body: string;
  line: number;
  offset: number;
}
const rowPattern = /^\s*([A-Ga-g](?:#|b)?|[1-6])?\s*[|:]([\s\S]*)$/;
export function parseTab(
  original: string,
  fallback: string[] = TUNINGS.Estándar,
): MusicModel {
  const diagnostics: Diagnostic[] = [];
  const model: MusicModel = {
    original,
    events: [],
    tuning: [...fallback],
    blocks: [],
    repeats: [],
    diagnostics,
    totalColumns: 0,
    approximate: true,
  };
  const lines = original.replace(/\r\n?/g, "\n").split("\n");
  let rows: Row[] = [];
  let header = "";
  let repeatHint = "";
  let ordinal = 0;
  let detectedTuning = false;
  const warn = (
    line: number,
    message: string,
    severity: "error" | "warning" = "warning",
  ) => diagnostics.push({ line, message, severity });
  const countFrom = (text: string) => {
    const m = text.match(
      /(?:\bx\s*(\d+)\b|\brepeat\s+(\d+)\s+times\b|\brepetir\s+(\d+)\s+veces\b)/i,
    );
    return m ? Number(m[1] ?? m[2] ?? m[3]) : undefined;
  };
  function flush() {
    if (!rows.length) return;
    if (rows.length !== 6) {
      warn(
        rows[0].line,
        `Bloque incompleto: se encontraron ${rows.length} cuerdas; se necesitan seis.`,
        "error",
      );
      rows = [];
      return;
    }
    const block = ordinal++;
    const base = model.totalColumns;
    const start = model.events.length;
    const byColumn = new Map<number, MusicEvent>();
    const labels = rows.map((r) => r.label.toUpperCase().replace("B", "B"));
    const notesLabels = labels.every((l) => /^[A-G](?:#|B)?$/.test(l));
    if (notesLabels) {
      const tuning = rows.map(
        (r) => r.label[0].toUpperCase() + r.label.slice(1),
      );
      if (!detectedTuning) {
        model.tuning = tuning;
        detectedTuning = true;
      } else if (tuning.join() !== model.tuning.join())
        warn(
          rows[0].line,
          "Cambio de afinación entre bloques. Separá este bloque en otra canción antes de practicar.",
          "error",
        );
    } else if (
      rows.some((r) => r.label) &&
      !rows.every((r, i) => r.label === String(i + 1))
    )
      warn(
        rows[0].line,
        "Etiquetas de cuerdas incompletas; se usa la afinación manual.",
      );
    const widths = rows.map(
      (r) =>
        r.body.replace(/\s*(?:x\s*\d+|repeat\s+\d+\s+times)\s*$/i, "").length,
    );
    const width = Math.max(...widths);
    if (Math.max(...widths) - Math.min(...widths) > 2)
      warn(
        rows[0].line,
        "Las cuerdas tienen longitudes distintas. Se conserva la alineación original; revisá los acordes.",
      );
    const put = (col: number, n: Note) => {
      let e = byColumn.get(col);
      if (!e) {
        e = { id: `b${block}c${col}`, column: base + col, block, notes: [] };
        byColumn.set(col, e);
      }
      e.notes.push(n);
    };
    rows.forEach((row, string) => {
      const body = row.body.replace(
        /\s*(?:x\s*\d+|repeat\s+\d+\s+times)\s*$/i,
        "",
      );
      let i = 0;
      let repeatedDigitEnd = -1;
      let previous: Note | undefined;
      let pending: Technique | undefined;
      while (i < body.length) {
        const c = body[i];
        if (/[\d]/.test(c) || c.toLowerCase() === "x") {
          const begin = i;
          const m = body.slice(i).match(/^(\d+|[xX])/)!;
          // Compact repeated single-digit frets (8888) retain one event per column.
          // One/two-digit tokens remain intact: 10, 11 and 22 are real frets.
          if (/^(\d)\1{2,}$/.test(m[0]))
            repeatedDigitEnd = Math.max(repeatedDigitEnd, i + m[0].length);
          const raw = i < repeatedDigitEnd ? c : m[0];
          i += raw.length;
          const fret = /x/i.test(raw) ? null : Number(raw);
          if (fret !== null && fret > 24) {
            warn(
              row.line,
              `Traste ${fret} fuera del rango 0–24 (columna ${begin + 1}).`,
              "error",
            );
            pending = undefined;
            previous = undefined;
            continue;
          }
          const n: Note = {
            id: `b${block}s${string}c${begin}`,
            string,
            fret,
            techniques: [],
            source: { line: row.line, column: row.offset + begin, raw },
          };
          if (pending && previous) {
            pending.toNoteId = n.id;
            pending.target = fret ?? undefined;
            previous.techniques.push(pending);
            pending = undefined;
          }
          put(begin, n);
          previous = n;
          continue;
        }
        if (c === "^") {
          if (previous) {
            previous.techniques.push({ kind: "bend" });
            previous.source.raw += c;
          } else warn(row.line, "Bend sin nota de origen.");
          i++;
          continue;
        }
        if (c === "~" || c === "v") {
          if (previous) {
            if (!previous.techniques.some((t) => t.kind === "vibrato"))
              previous.techniques.push({ kind: "vibrato" });
            previous.source.raw += c;
          } else warn(row.line, "Vibrato sin nota de origen.");
          i++;
          continue;
        }
        if (c === "b" || c === "r") {
          const target = body.slice(i + 1).match(/^(\d+)/);
          if (previous && target) {
            const value = Number(target[0]);
            if (value <= 36) {
              previous.techniques.push({
                kind: c === "b" ? "bend" : "release",
                target: value,
              });
              previous.source.raw += c + target[0];
            } else warn(row.line, "Destino de bend fuera de rango.", "error");
            i += target[0].length + 1;
          } else {
            warn(
              row.line,
              `${c === "b" ? "Bend" : "Release"} ambiguo: falta una nota de origen o destino. Completá la notación.`,
            );
            i++;
          }
          continue;
        }
        const kinds: Record<string, Technique["kind"]> = {
          h: "hammer",
          p: "pull",
          "/": "slide-up",
          "\\": "slide-down",
        };
        if (kinds[c]) {
          if (previous && /^\d/.test(body.slice(i + 1)))
            pending = { kind: kinds[c] };
          else if (
            !previous &&
            (c === "/" || c === "\\") &&
            /^\d/.test(body.slice(i + 1))
          )
            warn(
              row.line,
              "Slide de entrada: el traste de origen no está indicado; se conserva solamente la nota de llegada.",
            );
          else warn(row.line, `Técnica «${c}» sin dos trastes explícitos.`);
          i++;
          continue;
        }
        if (!/[-\s|:*o]/.test(c))
          warn(
            row.line,
            `Símbolo «${c}» no reconocido en columna ${i + 1}; no se interpreta como nota.`,
          );
        // A separator ends a technique chain, but not the temporal spacing.
        if (c === "-" || c === "|" || /\s/.test(c)) {
          previous = undefined;
          pending = undefined;
        }
        i++;
      }
    });
    model.events.push(
      ...[...byColumn.values()].sort((a, b) => a.column - b.column),
    );
    const end = model.events.length - 1;
    if (end >= start) {
      model.blocks.push({
        start,
        end,
        label: header || `Bloque ${block + 1}`,
        columns: width,
      });
      const inline = rows.map((r) => r.body).join(" ");
      const counts = [
        ...inline.matchAll(
          /(?:\bx\s*(\d+)\b|\brepeat\s+(\d+)\s+times\b|\brepetir\s+(\d+)\s+veces\b)/gi,
        ),
        ...repeatHint.matchAll(
          /(?:\bx\s*(\d+)\b|\brepeat\s+(\d+)\s+times\b|\brepetir\s+(\d+)\s+veces\b)/gi,
        ),
      ].map((m) => Number(m[1] ?? m[2] ?? m[3]));
      const hasBars = rows.some(
        (r) =>
          r.body.includes("|:") ||
          r.body.includes(":|") ||
          r.body.startsWith(":") ||
          r.body.includes("||o") ||
          r.body.includes("o||"),
      );
      const starts = rows.flatMap((r) => {
        const m = r.body.match(/\|:|^:|\|\|o/);
        return m ? [m.index!] : [];
      });
      const ends = rows.flatMap((r) => {
        const m = r.body.match(/:\||o\|\|/);
        return m ? [m.index!] : [];
      });
      const count = counts[0] ?? (hasBars ? 2 : 1);
      if (counts.some((c) => c !== count) || count > 100 || count < 1)
        warn(
          rows[0].line,
          "Cantidad de repeticiones ambigua o fuera de rango; corregí la indicación.",
        );
      else if (
        rows.some(
          (r) =>
            [...r.body.matchAll(/\|:|^:|\|\|o/g)].length > 1 ||
            [...r.body.matchAll(/:\||o\|\|/g)].length > 1,
        )
      )
        warn(
          rows[0].line,
          "Repetición anidada o múltiple ambigua; definí rangos manualmente.",
        );
      else if (
        hasBars &&
        (!starts.length ||
          !ends.length ||
          new Set(starts).size > 1 ||
          new Set(ends).size > 1 ||
          ends[0] <= starts[0])
      )
        warn(
          rows[0].line,
          "Barras de repetición incompletas o desalineadas; indicá x2 o un rango manual.",
        );
      else if (count > 1) {
        const first = hasBars
          ? model.events.findIndex(
              (e, j) => j >= start && j <= end && e.column >= base + starts[0],
            )
          : start;
        let last = end;
        if (hasBars) {
          last = model.events.findLastIndex(
            (e, j) => j >= start && j <= end && e.column < base + ends[0],
          );
        }
        if (first >= 0 && last >= first)
          model.repeats.push({
            id: `repeat${block}`,
            start: first,
            end: last,
            count,
            label: `${count} veces`,
          });
      }
    }
    model.totalColumns += width + 4;
    rows = [];
    header = "";
    repeatHint = "";
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = line.match(rowPattern);
    if (match) {
      if (rows.length === 6) flush();
      rows.push({
        label: match[1] ?? "",
        body: match[2],
        line: index + 1,
        offset: line.length - match[2].length,
      });
      continue;
    }
    if (rows.length === 6 && countFrom(line) !== undefined) {
      repeatHint = line;
      flush();
      continue;
    }
    if (rows.length) flush();
    if (line.trim()) {
      if (countFrom(line) !== undefined) {
        warn(
          index + 1,
          "Repetición sin bloque inmediato: asociá la indicación a un bloque o definí un fragmento.",
        );
      } else if (/repeat|repetir|repetición|1st|2nd|veces/i.test(line))
        warn(
          index + 1,
          "Indicación de repetición ambigua; definí el rango y cantidad manualmente.",
        );
      else header = line.trim().slice(0, 100);
    }
  }
  flush();
  if (!model.events.length)
    warn(
      1,
      "No se encontraron notas. Pegá un bloque de seis cuerdas con sus trastes.",
      "error",
    );
  return model;
}
