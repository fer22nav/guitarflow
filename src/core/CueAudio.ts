export class CueAudio {
  private context: AudioContext | null = null;
  private pending = new Set<OscillatorNode>();
  async enable() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
  }
  pip(kind: "event" | "pulse", volume: number) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || volume <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(kind === "event" ? 660 : 880, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(
      Math.min(0.3, volume) * 0.35,
      now + 0.006,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    this.pending.add(osc);
    osc.onended = () => {
      this.pending.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 0.075);
  }
  quiet() {
    for (const osc of this.pending) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.pending.clear();
  }
  dispose() {
    this.quiet();
    void this.context?.close();
    this.context = null;
  }
}
