import {
  CodeAnalyzer,
  LanguageKind,
  SourceDocument,
  ProjectManifest,
} from './analyzer-types';
import { RawFact } from '../knowledge/fact-types';
import { SemanticAnalyzer } from './SemanticAnalyzer';
import { PythonAnalyzer } from './PythonAnalyzer';
import { CAnalyzer } from './CAnalyzer';

/**
 * CompositeAnalyzer coordinates all language-specific code analyzers.
 * It automatically inspects project file extensions and delegates to the
 * appropriate analyzer (TypeScript/JS, C17, Python), merging all discovered
 * facts into a single unified KnowledgeBase.
 */
export class CompositeAnalyzer {
  private readonly analyzers: CodeAnalyzer[];

  constructor(customAnalyzers?: CodeAnalyzer[]) {
    this.analyzers = customAnalyzers ?? [
      new SemanticAnalyzer(),
      new PythonAnalyzer(),
      new CAnalyzer(),
    ];
  }

  getAnalyzerForFile(filePath: string): CodeAnalyzer | undefined {
    return this.analyzers.find(a => a.canAnalyze(filePath));
  }

  canAnalyze(filePath: string): boolean {
    return this.analyzers.some(a => a.canAnalyze(filePath));
  }

  getSupportedLanguages(): LanguageKind[] {
    return this.analyzers.map(a => a.language);
  }

  analyze(documents: SourceDocument[], manifest?: ProjectManifest): RawFact[] {
    const facts: RawFact[] = [];
    const grouped = new Map<CodeAnalyzer, SourceDocument[]>();

    for (const doc of documents) {
      const analyzer = this.getAnalyzerForFile(doc.path);
      if (!analyzer) { continue; }

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

  formatImportForFile(
    sourceFile: string,
    symbolName: string,
    targetModule: string,
    isDefault = false
  ): string {
    const analyzer = this.getAnalyzerForFile(sourceFile);
    if (analyzer) {
      return analyzer.formatImportStatement(symbolName, targetModule, isDefault);
    }
    // Default fallback to TypeScript/ES syntax
    return `import { ${symbolName} } from '${targetModule}';\n`;
  }
}
