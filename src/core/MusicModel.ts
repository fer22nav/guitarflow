export type TechniqueKind =
  | "bend"
  | "release"
  | "slide-up"
  | "slide-down"
  | "hammer"
  | "pull"
  | "vibrato";
export interface Technique {
  kind: TechniqueKind;
  target?: number;
  toNoteId?: string;
}
export interface Note {
  id: string;
  string: number;
  fret: number | null;
  techniques: Technique[];
  source: { line: number; column: number; raw: string };
}
export interface MusicEvent {
  id: string;
  column: number;
  block: number;
  notes: Note[];
  durationBeats?: number;
  gapBeats?: number;
  rest?: boolean;
}
export interface Repeat {
  id: string;
  start: number;
  end: number;
  count: number;
  label: string;
}
export interface Diagnostic {
  severity: "error" | "warning";
  line: number;
  message: string;
}
export interface MusicModel {
  original: string;
  events: MusicEvent[];
  tuning: string[];
  blocks: { start: number; end: number; label: string; columns: number }[];
  repeats: Repeat[];
  diagnostics: Diagnostic[];
  totalColumns: number;
  approximate: true;
}
export interface Section {
  id: string;
  name: string;
  start: number;
  end: number;
}
export interface Revision {
  at: number;
  text: string;
  model: MusicModel;
  sections: Section[];
}
export interface Song {
  id: string;
  title: string;
  artist: string;
  text: string;
  draft?: string;
  capture?: { dataUrl: string; name: string; confidence: number };
  captureNeedsReview?: boolean;
  model: MusicModel;
  sections: Section[];
  revisions: Revision[];
  manualEdits: boolean;
  position: number;
  updatedAt: number;
}
export interface Preferences {
  audioMode: "off" | "event" | "metronome";
  volume: number;
  view: "timeline" | "physical";
  zoom: number;
  markerSize: number;
  frets: number;
  fromFret: number;
  toFret: number;
  bpm: number;
  speed: number;
  columnsPerBeat: number;
  timing: "spacing" | "uniform";
  loop: boolean;
  loopPause: number;
  tuning: string[];
}
// All tuning arrays are ordered from string 1 (high) to string 6 (low).
export const TUNINGS: Record<string, string[]> = {
  Estándar: ["E", "B", "G", "D", "A", "E"],
  "Drop D": ["E", "B", "G", "D", "A", "D"],
  "Drop C": ["D", "A", "F", "C", "G", "C"],
};
export const DEFAULT_PREFS: Preferences = {
  audioMode: "off",
  volume: 0.12,
  view: "timeline",
  zoom: 1,
  markerSize: 22,
  frets: 24,
  fromFret: 0,
  toFret: 24,
  bpm: 90,
  speed: 100,
  columnsPerBeat: 4,
  timing: "spacing",
  loop: false,
  loopPause: 0.5,
  tuning: TUNINGS.Estándar,
};
export const uid = () => crypto.randomUUID();
export function eventBeats(
  model: MusicModel,
  index: number,
  p: Preferences,
): number {
  const e = model.events[index];
  if (!e) return 0;
  if (e.durationBeats !== undefined) return e.durationBeats;
  if (p.timing === "uniform") return 1;
  const next = model.events[index + 1];
  return (
    Math.max(1, (next?.column ?? model.totalColumns) - e.column) /
    p.columnsPerBeat
  );
}
export function eventSeconds(
  model: MusicModel,
  index: number,
  p: Preferences,
): number {
  return (
    ((((eventBeats(model, index, p) + (model.events[index]?.gapBeats ?? 0)) *
      60) /
      p.bpm) *
      100) /
    p.speed
  );
}
export function validateModel(model: MusicModel): boolean {
  return (
    !!model &&
    typeof model.original === "string" &&
    Array.isArray(model.events) &&
    model.events.length <= 50000 &&
    Number.isFinite(model.totalColumns) &&
    model.totalColumns >= 0 &&
    Array.isArray(model.tuning) &&
    model.tuning.length === 6 &&
    model.tuning.every((t) => /^[A-G](?:#|b)?$/.test(t)) &&
    Array.isArray(model.diagnostics) &&
    Array.isArray(model.blocks) &&
    Array.isArray(model.repeats) &&
    model.events.every(
      (e) =>
        typeof e.id === "string" &&
        Number.isFinite(e.column) &&
        e.column >= 0 &&
        Number.isInteger(e.block) &&
        Array.isArray(e.notes) &&
        e.notes.every(
          (n) =>
            typeof n.id === "string" &&
            Number.isInteger(n.string) &&
            n.string >= 0 &&
            n.string < 6 &&
            (n.fret === null ||
              (Number.isInteger(n.fret) && n.fret >= 0 && n.fret <= 24)) &&
            !!n.source &&
            typeof n.source.raw === "string" &&
            Array.isArray(n.techniques) &&
            n.techniques.every(
              (t) =>
                [
                  "bend",
                  "release",
                  "slide-up",
                  "slide-down",
                  "hammer",
                  "pull",
                  "vibrato",
                ].includes(t.kind) &&
                (t.target === undefined ||
                  (Number.isInteger(t.target) &&
                    t.target >= 0 &&
                    t.target <= 36)),
            ),
        ) &&
        (e.durationBeats === undefined ||
          (Number.isFinite(e.durationBeats) &&
            e.durationBeats > 0 &&
            e.durationBeats <= 256)) &&
        (e.gapBeats === undefined ||
          (Number.isFinite(e.gapBeats) &&
            e.gapBeats >= 0 &&
            e.gapBeats <= 256)),
    ) &&
    model.repeats.every(
      (r) =>
        Number.isInteger(r.start) &&
        Number.isInteger(r.end) &&
        r.start >= 0 &&
        r.end >= r.start &&
        r.end < model.events.length &&
        Number.isInteger(r.count) &&
        r.count >= 1 &&
        r.count <= 100,
    )
  );
}
export function pitchClass(note: Note, tuning: string[]): number | null {
  if (note.fret === null) return null;
  const pitches: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const t = tuning[note.string];
  return (
    (((pitches[t[0]] +
      (t.includes("#") ? 1 : t.includes("b") ? -1 : 0) +
      note.fret) %
      12) +
      12) %
    12
  );
}
