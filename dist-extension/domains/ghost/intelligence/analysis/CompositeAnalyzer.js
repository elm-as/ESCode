"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeAnalyzer = void 0;
const SemanticAnalyzer_1 = require("./SemanticAnalyzer");
const PythonAnalyzer_1 = require("./PythonAnalyzer");
const CAnalyzer_1 = require("./CAnalyzer");
/**
 * CompositeAnalyzer coordinates all language-specific code analyzers.
 * It automatically inspects project file extensions and delegates to the
 * appropriate analyzer (TypeScript/JS, C17, Python), merging all discovered
 * facts into a single unified KnowledgeBase.
 */
class CompositeAnalyzer {
    analyzers;
    constructor(customAnalyzers) {
        this.analyzers = customAnalyzers ?? [
            new SemanticAnalyzer_1.SemanticAnalyzer(),
            new PythonAnalyzer_1.PythonAnalyzer(),
            new CAnalyzer_1.CAnalyzer(),
        ];
    }
    getAnalyzerForFile(filePath) {
        return this.analyzers.find(a => a.canAnalyze(filePath));
    }
    canAnalyze(filePath) {
        return this.analyzers.some(a => a.canAnalyze(filePath));
    }
    getSupportedLanguages() {
        return this.analyzers.map(a => a.language);
    }
    analyze(documents, manifest) {
        const facts = [];
        const grouped = new Map();
        for (const doc of documents) {
            const analyzer = this.getAnalyzerForFile(doc.path);
            if (!analyzer) {
                continue;
            }
            const list = grouped.get(analyzer) ?? [];
            list.push(doc);
            grouped.set(analyzer, list);
        }
        for (const [analyzer, docs] of grouped.entries()) {
            const languageFacts = analyzer.analyze(docs, manifest);
            facts.push(...languageFacts);
        }
        return facts;
    }
    formatImportForFile(sourceFile, symbolName, targetModule, isDefault = false) {
        const analyzer = this.getAnalyzerForFile(sourceFile);
        if (analyzer) {
            return analyzer.formatImportStatement(symbolName, targetModule, isDefault);
        }
        // Default fallback to TypeScript/ES syntax
        return `import { ${symbolName} } from '${targetModule}';\n`;
    }
}
exports.CompositeAnalyzer = CompositeAnalyzer;
//# sourceMappingURL=CompositeAnalyzer.js.map