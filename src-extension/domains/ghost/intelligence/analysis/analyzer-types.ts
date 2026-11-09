import { RawFact } from '../knowledge/fact-types';

export type LanguageKind = 'typescript' | 'python' | 'c';

export interface SourceDocument {
  path: string;
  content: string;
}

export interface ProjectManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Common interface implemented by all language-specific code analyzers.
 * Pluggable architecture allowing FakeCoder to understand code across
 * diverse ecosystems (TypeScript/React, C17, Python, etc.) while sharing
 * the same symbolic KnowledgeBase, InferenceEngine, and Planner.
 */
export interface CodeAnalyzer {
  readonly language: LanguageKind;
  readonly supportedExtensions: string[];

  /** Whether this analyzer can inspect the given file path */
  canAnalyze(filePath: string): boolean;

  /** Extract first-order raw facts from a list of documents */
  analyze(documents: SourceDocument[], manifest?: ProjectManifest): RawFact[];

  /**
   * Format an import statement appropriate for the target language.
   * e.g.:
   * - TS: import { foo } from './foo';
   * - Python: from foo import foo
   * - C: #include "foo.h"
   */
  formatImportStatement(symbolName: string, targetModule: string, isDefault?: boolean): string;
}
