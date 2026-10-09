import { eventSeconds, type MusicModel, type Preferences } from "./MusicModel";
export interface PlaybackState {
  index: number;
  progress: number;
  playing: boolean;
  waiting: boolean;
}
export class PlaybackController {
  onCue?: (kind: "event" | "pulse") => void;
  private pulseElapsed = 0;
  private frame = 0;
  private last = 0;
  private elapsed = 0;
  private waitRemaining = 0;
  private passes = new Map<string, number>();
  state: PlaybackState = {
    index: 0,
    progress: 0,
    playing: false,
    waiting: false,
  };
  constructor(
    public model: MusicModel,
    public prefs: Preferences,
    private notify: (s: PlaybackState) => void,
    public range: [number, number] | null = null,
  ) {}
  private emit() {
    this.notify({ ...this.state });
  }
  configure(
    model: MusicModel,
    prefs: Preferences,
    range: [number, number] | null,
  ) {
    this.model = model;
    this.prefs = prefs;
    this.range = range;
  }
  play() {
    if (!this.model.events.length) return;
    const [a, b] = this.range ?? [0, this.model.events.length - 1];
    if (this.state.index < a || this.state.index > b) this.seek(a);
    if (this.state.playing) return;
    this.state.playing = true;
    this.last = performance.now();
    if (this.elapsed === 0 && !this.state.waiting) {
      if (this.model.events[this.state.index]?.notes.length)
        this.onCue?.("event");
      if (this.pulseElapsed === 0) this.onCue?.("pulse");
    }
    this.emit();
    this.frame = requestAnimationFrame(this.tick);
  }
  pause() {
    this.state.playing = false;
    cancelAnimationFrame(this.frame);
    this.emit();
  }
  stop() {
    this.pause();
    this.seek(this.range?.[0] ?? 0);
  }
  seek(index: number) {
    this.state.index = Math.max(
      0,
      Math.min(this.model.events.length - 1, index),
    );
    this.state.progress = 0;
    this.state.waiting = false;
    this.elapsed = 0;
    this.pulseElapsed = 0;
    this.waitRemaining = 0;
    this.passes.clear();
    this.emit();
  }
  step(direction: number) {
    this.pause();
    this.seek(this.state.index + direction);
  }
  private advance() {
    const [a, b] = this.range ?? [0, this.model.events.length - 1];
    let next = this.state.index + 1;
    for (const repeat of this.model.repeats) {
      if (
        repeat.start >= a &&
        repeat.end <= b &&
        this.state.index === repeat.end
      ) {
        const pass = this.passes.get(repeat.id) ?? 1;
        if (pass < repeat.count) {
          this.passes.set(repeat.id, pass + 1);
          next = repeat.start;
          break;
        }
        this.passes.delete(repeat.id);
      }
    }
    if (next > b) {
      if (this.prefs.loop) {
        next = a;
        this.passes.clear();
        this.waitRemaining = this.prefs.loopPause;
        this.state.waiting = this.waitRemaining > 0;
      } else {
        this.state.progress = 1;
        this.state.playing = false;
        return;
      }
    }
    this.state.index = next;
    this.state.progress = 0;
    if (!this.state.waiting && this.model.events[next]?.notes.length)
      this.onCue?.("event");
  }
  private tick = (now: number) => {
    if (!this.state.playing) return;
    let delta = (now - this.last) / 1000;
    this.last = now;
    // Work through elapsed events so rendering delays do not change musical order.
    let guard = 0;
    while (delta > 0 && this.state.playing && guard++ < 10000) {
      if (this.waitRemaining > 0) {
        const used = Math.min(delta, this.waitRemaining);
        delta -= used;
        this.waitRemaining -= used;
        this.state.waiting = this.waitRemaining > 0;
        if (!this.state.waiting) {
          if (this.model.events[this.state.index]?.notes.length)
            this.onCue?.("event");
          this.pulseElapsed = 0;
          this.onCue?.("pulse");
        }
        continue;
      }
      const duration = eventSeconds(this.model, this.state.index, this.prefs);
      const used = Math.min(delta, Math.max(0.001, duration - this.elapsed));
      this.elapsed += used;
      delta -= used;
      this.pulseElapsed += used;
      const pulse = ((60 / this.prefs.bpm) * 100) / this.prefs.speed;
      while (this.pulseElapsed >= pulse) {
        this.pulseElapsed -= pulse;
        this.onCue?.("pulse");
      }
      this.state.progress = Math.min(1, this.elapsed / duration);
      if (this.elapsed >= duration) {
        this.elapsed = 0;
        this.advance();
      }
    }
    this.emit();
    if (this.state.playing) this.frame = requestAnimationFrame(this.tick);
  };
  dispose() {
    cancelAnimationFrame(this.frame);
  }
}
