import { CodingAction, ThinkTrigger } from '../actions/action-types';
import { SourceDocument, ProjectManifest } from '../analysis/analyzer-types';
import { CompositeAnalyzer } from '../analysis/CompositeAnalyzer';
import { KnowledgeBase } from '../knowledge/KnowledgeBase';
import { InferenceEngine } from '../inference/InferenceEngine';
import { resolveLocalModule, splitImportHeader } from './import-header';

export interface TrajectoryOptions {
  enableThinkingPauses?: boolean;
  enableTerminalCommands?: boolean;
}

const DEFAULT_OPTIONS: Required<TrajectoryOptions> = {
  enableThinkingPauses: true,
  enableTerminalCommands: true,
};

/** Files a developer typically starts a project from, by priority. */
const ENTRY_FILE_NAMES = [
  'main.c', 'main.py', 'app.py', 'server.ts', 'main.ts', 'index.ts', 'app.ts',
  'main.js', 'index.js', 'app.js',
];
const ROOT_MANIFEST = 'package.json';

const THINK_DURATIONS_MS: Record<ThinkTrigger, number> = {
  'before-edit': 400,
  'after-diagnostic': 800,
  'before-navigation': 500,
  'planning': 700,
  'uncertainty': 1200,
  'verification': 400,
};

interface PlanningContext {
  readonly actions: CodingAction[];
  readonly options: Required<TrajectoryOptions>;
  readonly docMap: ReadonlyMap<string, SourceDocument>;
  readonly dependencies: ReadonlyMap<string, string[]>;
  readonly visited: Set<string>;
}

/**
 * Synthesizes a non-linear, human-like coding trajectory for a project.
 *
 * Invariant: replaying the trajectory produces files identical to the
 * sources. Non-linearity only changes the *order* in which text appears:
 * a file's body is written first, the developer notices the symbols it
 * needs, writes the local modules providing them, comes back and adds the
 * import block at the top.
 */
export class DevelopmentTrajectoryBuilder {
  private readonly analyzer = new CompositeAnalyzer();
  private readonly inference = new InferenceEngine();

  buildTrajectory(documents: SourceDocument[], options: TrajectoryOptions = {}): CodingAction[] {
    if (documents.length === 0) { return []; }

    const context: PlanningContext = {
      actions: [],
      options: { ...DEFAULT_OPTIONS, ...options },
      docMap: new Map(documents.map(d => [d.path, d])),
      dependencies: this.computeLocalDependencies(documents),
      visited: new Set(),
    };

    const manifestDoc = context.docMap.get(ROOT_MANIFEST);
    if (manifestDoc) {
      this.planFile(manifestDoc, context);
    } else {
      this.planMissingPackageInstall(documents, context);
    }

    this.planFile(selectEntryDocument(documents), context);
    documents.forEach(doc => this.planFile(doc, context));
    return context.actions;
  }

  /** Local files each document depends on (its imports + unresolved symbols). */
  private computeLocalDependencies(documents: SourceDocument[]): Map<string, string[]> {
    const kb = new KnowledgeBase();
    kb.assertFacts(this.analyzer.analyze(documents, parseManifest(documents)));
    const paths = new Set(documents.map(d => d.path));
    const missingImports = this.inference.inferFindings(kb).filter(f => f.kind === 'missing-import');

    return new Map(documents.map(doc => {
      const imported = kb.getImportsByFile(doc.path)
        .map(imp => resolveLocalModule(doc.path, imp.moduleSpecifier, paths));
      const needed = missingImports
        .filter(f => f.sourceFile === doc.path)
        .map(f => f.targetFile);
      const deps = [...imported, ...needed].filter((p): p is string => !!p && p !== doc.path);
      return [doc.path, Array.from(new Set(deps))];
    }));
  }

  private planFile(doc: SourceDocument, context: PlanningContext): void {
    if (context.visited.has(doc.path)) { return; }
    context.visited.add(doc.path);

    const pendingDeps = (context.dependencies.get(doc.path) ?? [])
      .filter(dep => !context.visited.has(dep));
    const { header, body } = splitImportHeader(doc.content);

    this.pushAction({ type: 'openFile', path: doc.path }, context);
    this.pushThink('before-edit', `creating_${doc.path}`, context);

    if (pendingDeps.length === 0) {
      this.pushAction({ type: 'typeText', text: doc.content }, context);
    } else if (header && body.trim()) {
      this.planBodyFirst(doc, { header, body, pendingDeps }, context);
    } else {
      this.pushAction({ type: 'typeText', text: doc.content }, context);
      this.planDependencies(doc, pendingDeps, context);
    }

    if (doc.path === ROOT_MANIFEST) { this.pushInstall('npm install', context); }
  }

  /** Body, then the modules it needs, then back to the top for the imports. */
  private planBodyFirst(
    doc: SourceDocument,
    parts: { header: string; body: string; pendingDeps: string[] },
    context: PlanningContext
  ): void {
    this.pushAction({ type: 'typeText', text: parts.body }, context);
    this.planDependencies(doc, parts.pendingDeps, context);
    this.pushThink('before-navigation', `returning_to_${doc.path}`, context);
    this.pushAction({ type: 'openFile', path: doc.path }, context);
    this.pushAction({ type: 'moveCursor', line: 0, character: 0 }, context);
    this.pushThink('verification', `adding_imports_${doc.path}`, context);
    this.pushAction({ type: 'typeText', text: parts.header }, context);
  }

  private planDependencies(doc: SourceDocument, deps: string[], context: PlanningContext): void {
    this.pushThink('uncertainty', `unresolved_symbols_in_${doc.path}`, context);
    for (const dep of deps) {
      const depDoc = context.docMap.get(dep);
      if (depDoc) { this.planFile(depDoc, context); }
    }
  }

  /** Without a package.json, install the external JS packages the code imports. */
  private planMissingPackageInstall(documents: SourceDocument[], context: PlanningContext): void {
    const kb = new KnowledgeBase();
    kb.assertFacts(this.analyzer.analyze(documents, {}));
    const packages = this.inference.inferFindings(kb)
      .filter(f => f.kind === 'missing-dependency' && f.targetModule)
      .map(f => f.targetModule!);
    const unique = Array.from(new Set(packages));
    if (unique.length === 0) { return; }

    this.pushThink('planning', `need_dependencies_${unique.join('_')}`, context);
    this.pushInstall(`npm install ${unique.join(' ')}`, context);
  }

  private pushInstall(command: string, context: PlanningContext): void {
    if (!context.options.enableTerminalCommands) { return; }
    this.pushAction({ type: 'runTerminal', command, waitForCompletion: true }, context);
  }

  private pushThink(trigger: ThinkTrigger, reasonCode: string, context: PlanningContext): void {
    if (!context.options.enableThinkingPauses) { return; }
    this.pushAction({ type: 'think', durationMs: THINK_DURATIONS_MS[trigger], trigger, reasonCode }, context);
  }

  private pushAction(action: CodingAction, context: PlanningContext): void {
    context.actions.push(action);
  }
}

function selectEntryDocument(documents: SourceDocument[]): SourceDocument {
  for (const name of ENTRY_FILE_NAMES) {
    const match = documents.find(d => d.path === name || d.path.endsWith(`/${name}`));
    if (match) { return match; }
  }
  return documents.find(d => d.path !== ROOT_MANIFEST) ?? documents[0];
}

function parseManifest(documents: SourceDocument[]): ProjectManifest {
  const manifest = documents.find(d => d.path === ROOT_MANIFEST);
  if (!manifest) { return {}; }
  try {
    const parsed = JSON.parse(manifest.content) as ProjectManifest;
    return { dependencies: parsed.dependencies, devDependencies: parsed.devDependencies };
  } catch {
    // A malformed package.json is still typed as-is; it just declares nothing
    return {};
  }
}
