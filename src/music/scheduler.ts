import type { Layers, Scene } from './scenes';
import { type NoteEvent, barSeconds, notesForBar } from './score';

export interface SchedulerDeps {
  /** The audio clock, in seconds. */
  now(): number;
  /** Queue one event to start at audio-clock time `when`. */
  play(ev: NoteEvent, when: number, secondsPerBeat: number): void;
  /** How far ahead (seconds) of `now()` bars are queued. */
  lookahead: number;
}

/**
 * Look-ahead bar scheduler: call `tick()` often (a timer) and it queues each bar's events a little
 * before the bar starts. Layer changes apply to bars not yet queued, so they land on a bar line.
 */
export class Scheduler {
  private current: Scene | null = null;
  private layers: Layers = { hook: false, enraged: false };
  private bar = 0;
  private nextStart = 0;

  constructor(private readonly deps: SchedulerDeps) {}

  get scene(): Scene | null {
    return this.current;
  }

  /** Begin a scene from bar 0 at `at` (default now), discarding whatever was running. */
  start(scene: Scene, layers: Layers, at: number = this.deps.now()): void {
    this.current = scene;
    this.layers = layers;
    this.bar = 0;
    this.nextStart = at;
  }

  setLayers(layers: Layers): void {
    this.layers = layers;
  }

  stop(): void {
    this.current = null;
  }

  tick(): void {
    const scene = this.current;
    if (!scene) return;
    const now = this.deps.now();
    // The clock jumped (tab resumed): skip to the next bar line instead of replaying the missed bars.
    const first = barSeconds(scene, this.layers);
    if (now - this.nextStart > first) {
      const skipped = Math.ceil((now - this.nextStart) / first);
      this.bar += skipped;
      this.nextStart += skipped * first;
    }
    while (this.nextStart < now + this.deps.lookahead) {
      const len = barSeconds(scene, this.layers);
      const spb = len / 4;
      for (const ev of notesForBar(scene, this.bar, this.layers)) this.deps.play(ev, this.nextStart + ev.beat * spb, spb);
      this.bar++;
      this.nextStart += len;
    }
  }
}
