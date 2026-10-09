import { describe, it, expect } from "vitest";
import { parseTab } from "../src/core/TabParser";
import {
  TUNINGS,
  eventBeats,
  DEFAULT_PREFS,
  pitchClass,
  validateModel,
} from "../src/core/MusicModel";
import { timelinePositions } from "../src/components/TimelineRenderer";
import { fretPosition } from "../src/components/FretboardRenderer";
import { readLibrary } from "../src/core/ImportExport";
import { createSong } from "../src/core/examples";
function tab(first: string, other: string[] = []) {
  return ["e", "B", "G", "D", "A", "E"]
    .map(
      (s, i) =>
        `${s}|${i === 0 ? first : (other[i - 1] ?? "-".repeat(first.length))}`,
    )
    .join("\n");
}
describe("TabParser", () => {
  it("interpreta trastes de dos dígitos y conserva notas repetidas", () => {
    const m = parseTab(tab("---12--12--0--"));
    expect(m.events.map((e) => e.notes[0].fret)).toEqual([12, 12, 0]);
    expect(m.events.map((e) => e.column)).toEqual([3, 7, 11]);
  });
  it("un bend es una sola posición y el vibrato se conserva", () => {
    const m = parseTab(tab("--17b18--13b15~~--15r13--"));
    expect(m.events.map((e) => e.notes[0].fret)).toEqual([17, 13, 15]);
    expect(m.events[0].notes[0].techniques).toEqual([
      { kind: "bend", target: 18 },
    ]);
    expect(m.events[1].notes[0].techniques).toEqual([
      { kind: "bend", target: 15 },
      { kind: "vibrato" },
    ]);
    expect(m.events[2].notes[0].techniques[0]).toEqual({
      kind: "release",
      target: 13,
    });
  });
  it("enlaza hammer, pull y slides ascendentes/descendentes", () => {
    const m = parseTab(tab("--12h15p12/17\\10--"));
    const notes = m.events.map((e) => e.notes[0]);
    expect(notes.map((n) => n.fret)).toEqual([12, 15, 12, 17, 10]);
    expect(notes.slice(0, 4).map((n) => n.techniques[0].kind)).toEqual([
      "hammer",
      "pull",
      "slide-up",
      "slide-down",
    ]);
    notes
      .slice(0, 4)
      .forEach((n, i) =>
        expect(n.techniques[0].toNoteId).toBe(notes[i + 1].id),
      );
  });
  it("agrupa acordes alineados y reconoce x", () => {
    const m = parseTab(
      tab("--0--x--", [
        "--1--x--",
        "--0--x--",
        "--2--x--",
        "--3--x--",
        "-----x--",
      ]),
    );
    expect(m.events).toHaveLength(2);
    expect(m.events[0].notes).toHaveLength(5);
    expect(m.events[1].notes).toHaveLength(6);
    expect(m.events[1].notes.every((n) => n.fret === null)).toBe(true);
  });
  it("continúa bloques sin perder espacios ni el texto original", () => {
    const text = tab("--5----7--") + "\n\nFrase B\n" + tab("--9--");
    const m = parseTab(text);
    expect(m.events.map((e) => e.notes[0].fret)).toEqual([5, 7, 9]);
    expect(m.events[2].column).toBeGreaterThan(m.events[1].column);
    expect(m.original).toBe(text);
    expect(m.blocks[1].label).toBe("Frase B");
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
  });
  it("identifica Drop C sin cambiar trastes", () => {
    const text = ["D", "A", "F", "C", "G", "C"]
      .map((s) => `${s}|--12--`)
      .join("\n");
    const m = parseTab(text);
    expect(m.tuning).toEqual(TUNINGS["Drop C"]);
    expect(m.events[0].notes.every((n) => n.fret === 12)).toBe(true);
    expect(pitchClass(m.events[0].notes[0], m.tuning)).toBe(2);
  });
  it("utiliza afinación manual cuando faltan etiquetas", () => {
    const m = parseTab(Array(6).fill("|--7--").join("\n"), TUNINGS["Drop D"]);
    expect(m.tuning).toEqual(TUNINGS["Drop D"]);
  });
  it("conserva el espaciado como referencia aproximada y acepta ajuste manual", () => {
    const m = parseTab(tab("--5--7--------9--"));
    expect(eventBeats(m, 0, DEFAULT_PREFS)).toBe(0.75);
    expect(eventBeats(m, 1, DEFAULT_PREFS)).toBe(2.25);
    expect(eventBeats(m, 1, { ...DEFAULT_PREFS, timing: "uniform" })).toBe(1);
    m.events[1].durationBeats = 3;
    expect(eventBeats(m, 1, DEFAULT_PREFS)).toBe(3);
    expect(m.approximate).toBe(true);
  });
  it.each(["x2", "repeat 4 times"])(
    "interpreta repetición inequívoca %s",
    (hint) => {
      const m = parseTab(tab("--5--7--") + "\n" + hint);
      expect(m.repeats[0].count).toBe(hint === "x2" ? 2 : 4);
      expect(m.repeats[0].start).toBe(0);
      expect(m.repeats[0].end).toBe(1);
    },
  );
  it("reconoce barras de repetición y no incluye notas externas", () => {
    const text = ["e", "B", "G", "D", "A", "E"]
      .map(
        (s, i) => `${s}|${i === 0 ? "0-|:--5--7--:|--9" : "--|:--------:|---"}`,
      )
      .join("\n");
    const m = parseTab(text);
    expect(m.repeats[0]).toMatchObject({ start: 1, end: 2, count: 2 });
  });
  it("avisa sobre repeticiones ambiguas sin inventarlas", () => {
    const m = parseTab(tab("--5--7--") + "\nrepeat several times");
    expect(m.repeats).toHaveLength(0);
    expect(m.diagnostics.some((d) => d.message.includes("ambigua"))).toBe(true);
  });
  it("rechaza bloques incompletos y trastes fuera de rango", () => {
    expect(parseTab("e|--5--\nB|--5--").diagnostics[0].severity).toBe("error");
    const m = parseTab(tab("--99--"));
    expect(m.events).toHaveLength(0);
    expect(m.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });
  it("un destino de bend ausente no crea otra nota", () => {
    const m = parseTab(tab("--17b--"));
    expect(m.events).toHaveLength(1);
    expect(m.diagnostics.some((d) => d.message.includes("ambiguo"))).toBe(true);
  });
  it("no pierde vibratos ni notas apagadas", () => {
    const m = parseTab(tab("--15~--x--"));
    expect(m.events[0].notes[0].techniques[0].kind).toBe("vibrato");
    expect(m.events[1].notes[0].fret).toBeNull();
  });
});
describe("geometría y biblioteca", () => {
  it("las notas repetidas ocupan posiciones diferentes en secuencia", () => {
    const m = parseTab(tab("--12--12--12--"));
    const x = timelinePositions(m, 1);
    expect(x[1] - x[0]).toBeGreaterThanOrEqual(78);
    expect(x[2] - x[1]).toBeGreaterThanOrEqual(78);
  });
  it("cada marcador está dentro del traste, incluso con zoom", () => {
    for (const cell of [60, 100, 250])
      for (let fret = 0; fret <= 24; fret++) {
        const x = fretPosition(fret, 0, cell);
        const left = 84 + fret * cell;
        expect(x).toBeGreaterThan(left);
        expect(x).toBeLessThan(left + cell);
        expect(x - left).toBe(cell / 2);
      }
  });
  it("exportar/importar preserva el modelo completo y los fragmentos", () => {
    const s = createSong("Prueba", "Autora", tab("--12h15--"));
    s.sections = [{ id: "a", name: "Frase", start: 0, end: 1 }];
    s.model.events[0].durationBeats = 2;
    const data = { format: "guitarflow", version: 1, songs: [s] };
    expect(readLibrary(JSON.stringify(data))).toEqual([s]);
    expect(validateModel(s.model)).toBe(true);
  });
  it("rechaza JSON ajeno y modelos inválidos", () => {
    expect(() => readLibrary("{}")).toThrow();
    const s = createSong("", "", tab("--5--"));
    s.model.events[0].notes[0].string = 6;
    expect(() =>
      readLibrary(
        JSON.stringify({ format: "guitarflow", version: 1, songs: [s] }),
      ),
    ).toThrow();
  });
});
it("no ejecuta automáticamente cantidades contradictorias", () => {
  const m = parseTab(
    [
      "e|--5-- x2",
      "B|----- x3",
      "G|-----",
      "D|-----",
      "A|-----",
      "E|-----",
    ].join("\n"),
  );
  expect(m.repeats).toHaveLength(0);
  expect(m.diagnostics.some((d) => d.message.includes("ambigua"))).toBe(true);
});
