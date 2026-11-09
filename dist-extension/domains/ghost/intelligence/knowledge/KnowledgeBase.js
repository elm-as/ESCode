"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeBase = void 0;
const fact_types_1 = require("./fact-types");
/**
 * KnowledgeBase stores asserted raw code observations and maintains
 * specialized multi-indexes for near-constant time queries.
 */
class KnowledgeBase {
    facts = [];
    // Specialized indexes
    declarationsById = new Map();
    declarationsByName = new Map();
    declarationsByFile = new Map();
    referencesByFile = new Map();
    referencesBySymbolId = new Map();
    unresolvedReferencesByFile = new Map();
    exportsByFile = new Map();
    exportsByName = new Map();
    importsByFile = new Map();
    manifestDependencies = new Set();
    knownFiles = new Set();
    /**
     * Assert a single raw fact into the knowledge base, updating all indexes.
     */
    assertFact(fact) {
        this.facts.push(fact);
        switch (fact.predicate) {
            case fact_types_1.RawPredicate.DECLARES:
                this.indexDeclaration(fact);
                break;
            case fact_types_1.RawPredicate.REFERENCES:
                this.indexReference(fact);
                break;
            case fact_types_1.RawPredicate.EXPORTS:
                this.indexExport(fact);
                break;
            case fact_types_1.RawPredicate.IMPORTS:
                this.indexImport(fact);
                break;
            case fact_types_1.RawPredicate.MANIFEST_DEPENDENCY:
                this.manifestDependencies.add(fact.moduleName);
                break;
        }
    }
    /**
     * Assert an array of facts in batch.
     */
    assertFacts(facts) {
        for (const fact of facts) {
            this.assertFact(fact);
        }
    }
    // ─── Query Interface ────────────────────────────────────────────────────────
    getDeclarationById(id) {
        return this.declarationsById.get(id);
    }
    getDeclarationsByName(name) {
        return this.declarationsByName.get(name) ?? [];
    }
    getDeclarationsByFile(file) {
        return this.declarationsByFile.get(file) ?? [];
    }
    getReferencesByFile(file) {
        return this.referencesByFile.get(file) ?? [];
    }
    getReferencesBySymbol(symbolId) {
        return this.referencesBySymbolId.get(symbolId) ?? [];
    }
    getUnresolvedReferences(file) {
        if (file) {
            return this.unresolvedReferencesByFile.get(file) ?? [];
        }
        const all = [];
        for (const list of this.unresolvedReferencesByFile.values()) {
            all.push(...list);
        }
        return all;
    }
    getExportsByFile(file) {
        return this.exportsByFile.get(file) ?? [];
    }
    getExportsByName(name) {
        return this.exportsByName.get(name) ?? [];
    }
    getImportsByFile(file) {
        return this.importsByFile.get(file) ?? [];
    }
    hasManifestDependency(moduleName) {
        return this.manifestDependencies.has(moduleName);
    }
    getAllFiles() {
        return Array.from(this.knownFiles);
    }
    getFactCount() {
        return this.facts.length;
    }
    clear() {
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
    indexDeclaration(fact) {
        this.knownFiles.add(fact.filePath);
        this.declarationsById.set(fact.symbolId, fact);
        const byName = this.declarationsByName.get(fact.name) ?? [];
        byName.push(fact);
        this.declarationsByName.set(fact.name, byName);
        const byFile = this.declarationsByFile.get(fact.filePath) ?? [];
        byFile.push(fact);
        this.declarationsByFile.set(fact.filePath, byFile);
    }
    indexReference(fact) {
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
    indexExport(fact) {
        this.knownFiles.add(fact.filePath);
        const byFile = this.exportsByFile.get(fact.filePath) ?? [];
        byFile.push(fact);
        this.exportsByFile.set(fact.filePath, byFile);
        const byName = this.exportsByName.get(fact.name) ?? [];
        byName.push(fact);
        this.exportsByName.set(fact.name, byName);
    }
    indexImport(fact) {
        this.knownFiles.add(fact.filePath);
        const byFile = this.importsByFile.get(fact.filePath) ?? [];
        byFile.push(fact);
        this.importsByFile.set(fact.filePath, byFile);
    }
}
exports.KnowledgeBase = KnowledgeBase;
//# sourceMappingURL=KnowledgeBase.js.map