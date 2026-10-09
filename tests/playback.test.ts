import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { PlaybackController } from "../src/core/PlaybackController";
import { parseTab } from "../src/core/TabParser";
import { DEFAULT_PREFS } from "../src/core/MusicModel";
let frame: FrameRequestCallback | undefined;
let time = 0;
beforeEach(() => {
  time = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frame = cb;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frame = undefined;
  });
  vi.spyOn(performance, "now").mockImplementation(() => time);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function tick(ms: number) {
  time += ms;
  const cb = frame;
  frame = undefined;
  cb?.(time);
}
function model(hint = "") {
  return parseTab(
    [
      "e|--5--7--",
      "B|--------",
      "G|--------",
      "D|--------",
      "A|--------",
      "E|--------",
    ].join("\n") + hint,
  );
}
it("respecta simultaneidad, pausa, avance y reinicio", () => {
  const m = model();
  const c = new PlaybackController(
    m,
    { ...DEFAULT_PREFS, bpm: 60, timing: "uniform" },
    () => {},
  );
  c.play();
  tick(500);
  expect(c.state.progress).toBeCloseTo(0.5);
  c.pause();
  tick(500);
  expect(c.state.index).toBe(0);
  c.play();
  tick(500);
  expect(c.state.index).toBe(1);
  c.step(-1);
  expect(c.state.index).toBe(0);
  c.stop();
  expect(c.state.playing).toBe(false);
});
it("ejecuta x2 y termina sin perder notas", () => {
  const visited: number[] = [];
  const c = new PlaybackController(
    model("\nx2"),
    { ...DEFAULT_PREFS, bpm: 60, timing: "uniform" },
    (s) => visited.push(s.index),
  );
  c.play();
  tick(1000);
  tick(1000);
  tick(1000);
  tick(1000);
  expect(visited).toEqual([0, 1, 0, 1, 1]);
  expect(c.state.playing).toBe(false);
});
it("reproduce ambos extremos del fragmento y respeta pausa del bucle", () => {
  const c = new PlaybackController(
    model(),
    {
      ...DEFAULT_PREFS,
      bpm: 60,
      timing: "uniform",
      loop: true,
      loopPause: 0.5,
    },
    () => {},
    [0, 1],
  );
  c.play();
  tick(1000);
  expect(c.state.index).toBe(1);
  tick(1000);
  expect(c.state.index).toBe(0);
  expect(c.state.waiting).toBe(true);
  tick(250);
  expect(c.state.progress).toBe(0);
  tick(500);
  expect(c.state.waiting).toBe(false);
  expect(c.state.progress).toBeCloseTo(0.25);
});
it("la velocidad cambia el tiempo sin cambiar los trastes", () => {
  const m = model();
  const c = new PlaybackController(
    m,
    { ...DEFAULT_PREFS, bpm: 60, timing: "uniform", speed: 200 },
    () => {},
  );
  c.play();
  tick(500);
  expect(c.state.index).toBe(1);
  expect(m.events.map((e) => e.notes[0].fret)).toEqual([5, 7]);
});
it("emite un solo pip por acorde y no para eventos de silencio", () => {
  const m = model();
  m.events[0].notes.push({ ...m.events[0].notes[0], id: "chord", string: 1 });
  m.events.splice(1, 0, {
    id: "rest",
    column: 4,
    block: 0,
    notes: [],
    rest: true,
    durationBeats: 1,
  });
  const cues: string[] = [];
  const c = new PlaybackController(
    m,
    { ...DEFAULT_PREFS, bpm: 60, timing: "uniform" },
    () => {},
  );
  c.onCue = (kind) => cues.push(kind);
  c.play();
  expect(cues.filter((x) => x === "event")).toHaveLength(1);
  tick(1000);
  expect(c.state.index).toBe(1);
  expect(cues.filter((x) => x === "event")).toHaveLength(1);
  tick(1000);
  expect(cues.filter((x) => x === "event")).toHaveLength(2);
});
it("el metrónomo sigue BPM y velocidad y no sigue al pausar", () => {
  const pulses: string[] = [];
  const c = new PlaybackController(
    model(),
    { ...DEFAULT_PREFS, bpm: 60, speed: 200, timing: "uniform" },
    () => {},
  );
  c.onCue = (k) => {
    if (k === "pulse") pulses.push(k);
  };
  c.play();
  tick(250);
  expect(pulses).toHaveLength(1);
  tick(250);
  expect(pulses).toHaveLength(2);
  c.pause();
  tick(500);
  expect(pulses).toHaveLength(2);
});
