import { CodePosition, SymbolId } from './fact-types';

/**
 * Formal findings derived by the InferenceEngine.
 * A Finding represents a problem, diagnostic, or actionable opportunity
 * deduced from raw facts (e.g. an unresolved symbol that can be satisfied
 * by importing an export from another project module).
 */

export type FindingKind =
  | 'missing-import'
  | 'missing-dependency'
  | 'unused-import'
  | 'unresolved-symbol';

export type FindingSeverity =
  | 'info'
  | 'warning'
  | 'error';

export interface Finding {
  /** Discriminator for finding type */
  kind: FindingKind;
  /** Importance level */
  severity: FindingSeverity;
  /** File in which the issue or opportunity was identified */
  sourceFile: string;
  /** Precise location of the triggering token (if applicable) */
  location?: CodePosition;
  /** Human-readable explanation of why this finding was deduced */
  description: string;
  /** The symbol name involved (e.g., 'createUser') */
  relatedSymbolName?: string;
  /** Resolved symbol ID if known */
  relatedSymbolId?: SymbolId;
  /** Module specifier to import from (e.g., './auth') */
  targetModule?: string;
  /** Path of the file providing the export (e.g., 'src/auth.ts') */
  targetFile?: string;
  /** List of facts or rule identifiers that served as deductive proof */
  evidence?: string[];
}
