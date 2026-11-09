/**
 * Formal raw fact definitions extracted from code.
 * Raw facts represent direct structural and semantic observations:
 * declared symbols, resolved/unresolved references, scopes, exports, and imports.
 *
 * All higher-level conclusions (e.g. missing imports, diagnostics) are Findings,
 * derived downstream by the InferenceEngine.
 */

export type SymbolId = string;
export type ScopeId = string;

export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'variable'
  | 'enum'
  | 'parameter'
  | 'property'
  | 'unknown';

export type ResolutionKind =
  | 'local'
  | 'imported'
  | 'external'
  | 'unresolved';

export interface CodePosition {
  /** 0-based line index */
  line: number;
  /** 0-based character index */
  character: number;
}

export interface CodeRange {
  start: CodePosition;
  end: CodePosition;
}

export enum RawPredicate {
  DECLARES = 'declares',
  REFERENCES = 'references',
  EXPORTS = 'exports',
  IMPORTS = 'imports',
  MANIFEST_DEPENDENCY = 'manifest_dependency',
}

export interface DeclaresFact {
  predicate: RawPredicate.DECLARES;
  symbolId: SymbolId;
  filePath: string;
  name: string;
  kind: SymbolKind;
  scopeId: ScopeId;
  position: CodePosition;
  isExported: boolean;
}

export interface ReferencesFact {
  predicate: RawPredicate.REFERENCES;
  filePath: string;
  name: string;
  scopeId: ScopeId;
  position: CodePosition;
  /** The identified symbol ID if resolved */
  resolvedSymbolId?: SymbolId;
  resolution: ResolutionKind;
}

export interface ExportsFact {
  predicate: RawPredicate.EXPORTS;
  filePath: string;
  symbolId: SymbolId;
  name: string;
  isDefault: boolean;
}

export interface ImportsFact {
  predicate: RawPredicate.IMPORTS;
  filePath: string;
  moduleSpecifier: string;
  importedSymbolName: string;
  localAlias?: string;
  isDefault: boolean;
}

export interface ManifestDependencyFact {
  predicate: RawPredicate.MANIFEST_DEPENDENCY;
  moduleName: string;
  isDev: boolean;
}

/** Union of all first-order raw observations */
export type RawFact =
  | DeclaresFact
  | ReferencesFact
  | ExportsFact
  | ImportsFact
  | ManifestDependencyFact;
