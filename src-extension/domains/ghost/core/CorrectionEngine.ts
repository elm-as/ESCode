import {
  PendingError,
  CorrectionAction,
  CorrectionDelay,
  ErrorConfig,
  ErrorType,
} from '../types';
import { SeededRandom } from '../infrastructure/random';
import { Logger } from '../infrastructure/logger';

/**
 * Number of characters to wait before correcting, per delay mode.
 */
const CORRECTION_CHAR_DELAYS: Record<CorrectionDelay, { min: number; max: number }> = {
  [CorrectionDelay.IMMEDIATE]: { min: 0, max: 1 },
  [CorrectionDelay.SHORT]: { min: 1, max: 3 },
  [CorrectionDelay.MEDIUM]: { min: 3, max: 8 },
  [CorrectionDelay.LONG]: { min: 8, max: 20 },
};

/** Pending error plus the bookkeeping the engine needs to schedule it. */
interface TrackedError extends PendingError {
  /** Insertion order — breaks ties between errors sharing a document offset */
  sequence: number;
  /** Characters to type before this error is "noticed", rolled once */
  noticeAfterChars: number;
}

/**
 * CorrectionEngine manages pending errors and produces correction actions
 * that simulate a human noticing and fixing a typo.
 *
 * Positions are document offsets. Whenever a correction changes the document
 * length, the caller must report it through notifyCorrectionApplied so that
 * later pending errors keep pointing at the right characters.
 */
export class CorrectionEngine {
  private readonly pendingErrors: TrackedError[] = [];
  private readonly correctionDelay: CorrectionDelay;
  private readonly rng: SeededRandom;
  private readonly logger = Logger.getInstance();
  private nextSequence = 0;

  constructor(config: ErrorConfig) {
    this.correctionDelay = config.correctionDelay;
    this.rng = new SeededRandom(
      config.deterministicMode ? config.seed + 1 : Date.now() + 1
    );
  }

  /** Register a new error that may need correction. */
  addError(error: PendingError): void {
    const delays = CORRECTION_CHAR_DELAYS[this.correctionDelay];
    this.pendingErrors.push({
      ...error,
      sequence: this.nextSequence++,
      noticeAfterChars: this.rng.nextInt(delays.min, delays.max),
    });
  }

  /**
   * Called after each typed character. Returns a correction action for the
   * oldest error whose notice delay has elapsed, or null.
   */
  tick(): CorrectionAction | null {
    for (const err of this.pendingErrors) {
      err.charsSinceError++;
    }

    const index = this.pendingErrors.findIndex(e => e.charsSinceError >= e.noticeAfterChars);
    if (index === -1) { return null; }
    return this.takeAction(index);
  }

  /**
   * Returns the oldest pending correction regardless of its notice delay.
   * Used at the end of a file: a human re-reads before moving on, and the
   * replayed file must end up identical to its source.
   */
  flushNext(): CorrectionAction | null {
    if (this.pendingErrors.length === 0) { return null; }
    return this.takeAction(0);
  }

  /**
   * Shift pending errors located after an applied correction.
   * An error at the same offset only moves if it was typed after the corrected
   * one (e.g. a typo typed right where a character had been omitted).
   */
  notifyCorrectionApplied(action: CorrectionAction, lengthDelta: number): void {
    if (lengthDelta === 0) { return; }
    for (const err of this.pendingErrors) {
      const isAfter = err.position > action.position
        || (err.position === action.position && err.sequence > action.sequence);
      if (isAfter) { err.position += lengthDelta; }
    }
  }

  getPendingCount(): number {
    return this.pendingErrors.length;
  }

  clear(): void {
    this.pendingErrors.length = 0;
  }

  private takeAction(index: number): CorrectionAction {
    const [err] = this.pendingErrors.splice(index, 1);
    this.logger.debug(
      `Correction triggered at position ${err.position}: '${err.wrongChar}' → '${err.correctChar}'`
    );
    return this.buildCorrectionAction(err);
  }

  private buildCorrectionAction(error: TrackedError): CorrectionAction {
    const edit = computeCorrectionEdit(error);
    return {
      position: error.position,
      deleteCount: edit.deleteCount,
      insertText: edit.insertText,
      delay: 50 + this.rng.nextInt(30, 200),
      sequence: error.sequence,
    };
  }
}

/**
 * Pure mapping from an error to the edit that undoes it.
 * - omission: insert the missing character
 * - doubled char / extra space: delete the first (extra) character
 * - any substitution: replace the wrong text with the correct character
 */
export function computeCorrectionEdit(
  error: Pick<PendingError, 'errorType' | 'wrongChar' | 'correctChar'>
): { deleteCount: number; insertText: string } {
  switch (error.errorType) {
    case ErrorType.OMITTED_CHAR:
    case ErrorType.MISSING_SPACE:
      return { deleteCount: 0, insertText: error.correctChar };
    case ErrorType.REPEATED_CHAR:
    case ErrorType.EXTRA_SPACE:
      return { deleteCount: 1, insertText: '' };
    default:
      return { deleteCount: error.wrongChar.length, insertText: error.correctChar };
  }
}
