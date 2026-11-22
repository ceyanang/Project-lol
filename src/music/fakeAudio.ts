/** A tiny stand-in for Web Audio that records what gets built, for tests. */
export class FakeParam {
  value = 0;
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  setTargetAtTime() { return this; }
  cancelScheduledValues() { return this; }
}

export class FakeNode {
  connected: unknown[] = [];
  connect<T>(n: T): T { this.connected.push(n); return n; }
  disconnect() { this.connected = []; }
}

export class FakeSource extends FakeNode {
  frequency = new FakeParam();
  detune = new FakeParam();
  type = 'sine';
  buffer: unknown = null;
  loop = false;
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  start(t = 0) { this.startedAt = t; }
  stop(t = 0) { this.stoppedAt = t; }
  setPeriodicWave() {}
}

export class FakeGain extends FakeNode { gain = new FakeParam(); }
export class FakeFilter extends FakeNode { type = 'lowpass'; frequency = new FakeParam(); Q = new FakeParam(); }
export class FakeConvolver extends FakeNode { buffer: { length: number } | null = null; }

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new FakeNode();
  sources: FakeSource[] = [];
  createOscillator() { const s = new FakeSource(); this.sources.push(s); return s; }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s; }
  createGain() { return new FakeGain(); }
  createBiquadFilter() { return new FakeFilter(); }
  createConvolver() { return new FakeConvolver(); }
  createAnalyser() { const n = new FakeNode() as FakeNode & { fftSize: number; getFloatTimeDomainData(a: Float32Array): void }; n.fftSize = 1024; n.getFloatTimeDomainData = () => {}; return n; }
  createBuffer(_ch: number, length: number, _rate: number) {
    return { length, duration: length / this.sampleRate, getChannelData: () => new Float32Array(length) };
  }
  createPeriodicWave() { return {}; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
