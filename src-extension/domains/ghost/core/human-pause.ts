import { SeededRandom, computeRandomDelay } from '../infrastructure/random';
import { TypingConfig } from '../types';

/**
 * Characters after which a human typically pauses briefly.
 * Used only when humanPauses is enabled in the typing config.
 */
const PAUSE_TRIGGERS = new Set(['{', '}', ';', '\n']);

/** Longer pause triggers — end of logical blocks. */
const LONG_PAUSE_TRIGGERS = new Set(['}']);

/**
 * Patterns at the start of a line that trigger a "thinking" pause
 * (imports, function declarations, class declarations…).
 */
const STRUCTURE_PATTERNS = [
  /^\s*(import |from |export |function |class |interface |type |const |let |var |async |def |pub |fn )/,
];

/**
 * Decides how long a human-like micro-pause should last based on
 * the character just typed and the upcoming content.
 *
 * Returns 0 if no pause is warranted.
 */
export function computeHumanPause(
  justTyped: string,
  remainingContent: string,
  pauseProbabilityPercent: number,
  rng: SeededRandom
): number {
  if (!justTyped) {
    return 0;
  }

  if (LONG_PAUSE_TRIGGERS.has(justTyped)) {
    return rng.nextInt(200, 600);
  }

  // Checked before the generic triggers because '\n' is one of them
  if (justTyped === '\n' && STRUCTURE_PATTERNS.some(p => p.test(remainingContent))) {
    return rng.nextInt(150, 500);
  }

  if (PAUSE_TRIGGERS.has(justTyped)) {
    return rng.nextInt(80, 250);
  }

  // Random micro-pause even on ordinary characters
  if (rng.chance(pauseProbabilityPercent / 100)) {
    return rng.nextInt(50, 150);
  }

  return 0;
}

/**
 * Delay before the next keystroke: speed gives the base rhythm, randomness
 * jitters it, and the result is clamped to the user's [minDelay, maxDelay].
 */
export function computeKeystrokeDelay(
  config: Pick<TypingConfig, 'speed' | 'randomness' | 'minDelay' | 'maxDelay'>,
  rng: SeededRandom
): number {
  const baseDelay = 1000 / Math.max(config.speed, 0.1);
  const jittered = computeRandomDelay(baseDelay, config.randomness, rng);
  const upperBound = Math.max(config.minDelay, config.maxDelay);
  return Math.min(Math.max(jittered, config.minDelay), upperBound);
}
