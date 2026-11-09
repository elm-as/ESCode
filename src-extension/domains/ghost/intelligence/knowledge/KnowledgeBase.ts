import {
  RawFact,
  RawPredicate,
  DeclaresFact,
  ReferencesFact,
  ExportsFact,
  ImportsFact,
  ManifestDependencyFact,
  SymbolId,
} from './fact-types';

/**
 * KnowledgeBase stores asserted raw code observations and maintains
 * specialized multi-indexes for near-constant time queries.
 */
export class KnowledgeBase {
  private readonly facts: RawFact[] = [];

  // Specialized indexes
  private readonly declarationsById = new Map<SymbolId, DeclaresFact>();
  private readonly declarationsByName = new Map<string, DeclaresFact[]>();
  private readonly declarationsByFile = new Map<string, DeclaresFact[]>();
  private readonly referencesByFile = new Map<string, ReferencesFact[]>();
  private readonly referencesBySymbolId = new Map<SymbolId, ReferencesFact[]>();
  private readonly unresolvedReferencesByFile = new Map<string, ReferencesFact[]>();
  private readonly exportsByFile = new Map<string, ExportsFact[]>();
  private readonly exportsByName = new Map<string, ExportsFact[]>();
  private readonly importsByFile = new Map<string, ImportsFact[]>();
  private readonly manifestDependencies = new Set<string>();
  private readonly knownFiles = new Set<string>();

  /**
   * Assert a single raw fact into the knowledge base, updating all indexes.
   */
  assertFact(fact: RawFact): void {
    this.facts.push(fact);

    switch (fact.predicate) {
      case RawPredicate.DECLARES:
        this.indexDeclaration(fact);
        break;
      case RawPredicate.REFERENCES:
        this.indexReference(fact);
        break;
      case RawPredicate.EXPORTS:
        this.indexExport(fact);
        break;
      case RawPredicate.IMPORTS:
        this.indexImport(fact);
        break;
      case RawPredicate.MANIFEST_DEPENDENCY:
        this.manifestDependencies.add(fact.moduleName);
        break;
    }
  }

  /**
   * Assert an array of facts in batch.
   */
  assertFacts(facts: RawFact[]): void {
    for (const fact of facts) {
      this.assertFact(fact);
    }
  }

  // ─── Query Interface ────────────────────────────────────────────────────────

  getDeclarationById(id: SymbolId): DeclaresFact | undefined {
    return this.declarationsById.get(id);
  }

  getDeclarationsByName(name: string): DeclaresFact[] {
    return this.declarationsByName.get(name) ?? [];
  }

  getDeclarationsByFile(file: string): DeclaresFact[] {
    return this.declarationsByFile.get(file) ?? [];
  }

  getReferencesByFile(file: string): ReferencesFact[] {
    return this.referencesByFile.get(file) ?? [];
  }

  getReferencesBySymbol(symbolId: SymbolId): ReferencesFact[] {
    return this.referencesBySymbolId.get(symbolId) ?? [];
  }

  getUnresolvedReferences(file?: string): ReferencesFact[] {
    if (file) {
      return this.unresolvedReferencesByFile.get(file) ?? [];
    }
    const all: ReferencesFact[] = [];
    for (const list of this.unresolvedReferencesByFile.values()) {
      all.push(...list);
    }
    return all;
  }

  getExportsByFile(file: string): ExportsFact[] {
    return this.exportsByFile.get(file) ?? [];
  }

  getExportsByName(name: string): ExportsFact[] {
    return this.exportsByName.get(name) ?? [];
  }

  getImportsByFile(file: string): ImportsFact[] {
    return this.importsByFile.get(file) ?? [];
  }

  hasManifestDependency(moduleName: string): boolean {
    return this.manifestDependencies.has(moduleName);
  }

  getAllFiles(): string[] {
    return Array.from(this.knownFiles);
  }

  getFactCount(): number {
    return this.facts.length;
  }

  clear(): void {
    this.facts.length = 0;
    this.declarationsById.clear();
    this.declarationsByName.clear();
    this.declarationsByFile.clear();
    this.referencesByFile.clear();
    this.referencesBySymbolId.clear();
    this.unresolvedReferencesByFile.clear();
    this.exportsByFile.clear();
    this.exportsByName.clear();
    this.importsByFile.clear();
    this.manifestDependencies.clear();
    this.knownFiles.clear();
  }

  // ─── Index Helpers ──────────────────────────────────────────────────────────

  private indexDeclaration(fact: DeclaresFact): void {
    this.knownFiles.add(fact.filePath);
    this.declarationsById.set(fact.symbolId, fact);

    const byName = this.declarationsByName.get(fact.name) ?? [];
    byName.push(fact);
    this.declarationsByName.set(fact.name, byName);

    const byFile = this.declarationsByFile.get(fact.filePath) ?? [];
    byFile.push(fact);
    this.declarationsByFile.set(fact.filePath, byFile);
  }

  private indexReference(fact: ReferencesFact): void {
    this.knownFiles.add(fact.filePath);

    const byFile = this.referencesByFile.get(fact.filePath) ?? [];
    byFile.push(fact);
    this.referencesByFile.set(fact.filePath, byFile);

    if (fact.resolvedSymbolId) {
      const bySym = this.referencesBySymbolId.get(fact.resolvedSymbolId) ?? [];
      bySym.push(fact);
      this.referencesBySymbolId.set(fact.resolvedSymbolId, bySym);
    }

    if (fact.resolution === 'unresolved') {
      const unresolved = this.unresolvedReferencesByFile.get(fact.filePath) ?? [];
      unresolved.push(fact);
      this.unresolvedReferencesByFile.set(fact.filePath, unresolved);
    }
  }

  private indexExport(fact: ExportsFact): void {
    this.knownFiles.add(fact.filePath);

    const byFile = this.exportsByFile.get(fact.filePath) ?? [];
    byFile.push(fact);
    this.exportsByFile.set(fact.filePath, byFile);

    const byName = this.exportsByName.get(fact.name) ?? [];
    byName.push(fact);
    this.exportsByName.set(fact.name, byName);
  }

  private indexImport(fact: ImportsFact): void {
    this.knownFiles.add(fact.filePath);

    const byFile = this.importsByFile.get(fact.filePath) ?? [];
    byFile.push(fact);
    this.importsByFile.set(fact.filePath, byFile);
  }
}
