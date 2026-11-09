/**
 * Mulberry32 — seeded PRNG producing deterministic sequences.
 * Used by ErrorEngine and CorrectionEngine so sessions are reproducible
 * when deterministic mode is enabled.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Returns a pseudo-random float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a random integer in [min, max] (inclusive). */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns true with the given probability (0–1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Pick a uniformly random element from a non-empty array. */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/**
 * Generates a delay in ms with bounded randomness around a base value.
 * Randomness of 0 returns the base unchanged; 100 allows ±100 % variation.
 */
export function computeRandomDelay(
  baseDelay: number,
  randomnessPercent: number,
  rng: SeededRandom
): number {
  if (randomnessPercent <= 0) {
    return baseDelay;
  }
  const factor = randomnessPercent / 100;
  const min = baseDelay * (1 - factor);
  const max = baseDelay * (1 + factor);
  return min + rng.next() * (max - min);
}

/**
 * Promise that resolves after `ms` milliseconds, but rejects immediately
 * if the AbortSignal fires — so every wait in the typing pipeline can be
 * cancelled without leaking timers.
 */
export function createCancellableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/** Type-guard for abort errors thrown by createCancellableDelay. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
