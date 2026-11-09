/**
 * Stylesheet and monochrome 1.7px SVG icons for the Inspecteur AST & Flux panel.
 * Follows the Elmas Studio macOS Sequoia Dark Glass & Amber Forge design system.
 */
export const WEBVIEW_ICONS = {
  pulse: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  captureFile: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="12" cy="14" r="2"/></svg>`,
  captureFolder: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`,
  folder: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  file: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
  code: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  play: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>`,
  pause: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
  stop: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`,
  skip: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
  restart: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
} as const;

export const WEBVIEW_STYLES = /* css */ `
  :root {
    --bg-canvas: #0c0c10;
    --bg-card: #121218;
    --bg-elevated: #171720;
    --bg-input: #0e0e14;
    --border-subtle: rgba(255, 255, 255, 0.07);
    --border-strong: rgba(255, 255, 255, 0.13);
    --text-primary: #f2f2f7;
    --text-secondary: #a0a0ab;
    --text-muted: #686873;
    --accent: #f59e0b;
    --accent-soft: rgba(245, 158, 11, 0.14);
    --accent-border: rgba(245, 158, 11, 0.38);
    --emerald: #28c840;
    --danger: #ff453a;
    --font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Inter", system-ui, sans-serif;
    --font-mono: "JetBrains Mono", "Cascadia Code", Consolas, monospace;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font-ui);
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-primary);
    background: var(--bg-canvas);
    padding: 12px;
    -webkit-font-smoothing: antialiased;
  }

  .header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 12px;
    margin-bottom: 12px;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: -0.01em;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--emerald);
    box-shadow: 0 0 6px rgba(40, 200, 64, 0.45);
  }

  .shortcut-pill {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    padding: 2px 7px;
    border-radius: 5px;
    font-variant-numeric: tabular-nums;
  }

  .section {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 11px 12px;
    margin-bottom: 10px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 9px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-subtle);
  }

  h2 {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
  }

  h3 {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    margin: 9px 0 5px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 7px;
  }

  .row label {
    color: var(--text-secondary);
    font-size: 12px;
  }

  .controls {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: var(--bg-elevated);
    color: var(--text-primary);
    border: 1px solid var(--border-subtle);
    padding: 5px 10px;
    border-radius: 6px;
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
  }

  button:hover:not(:disabled) {
    background: #20202c;
    border-color: var(--border-strong);
  }

  button:disabled {
    opacity: 0.38;
    cursor: default;
  }

  button.primary {
    background: var(--accent-soft);
    color: var(--accent);
    border-color: var(--accent-border);
    font-weight: 600;
  }

  button.primary:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.22);
  }

  button.danger {
    background: rgba(255, 69, 58, 0.12);
    color: var(--danger);
    border-color: rgba(255, 69, 58, 0.32);
  }

  input[type="text"],
  input[type="number"],
  select,
  textarea {
    background: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-subtle);
    padding: 4px 8px;
    border-radius: 5px;
    font-family: var(--font-ui);
    font-size: 11px;
    outline: none;
  }

  input:focus, select:focus, textarea:focus {
    border-color: var(--accent-border);
  }

  input[type="number"] {
    width: 68px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  input[type="range"] {
    flex: 1;
    max-width: 130px;
    accent-color: var(--accent);
  }

  select { min-width: 155px; }

  textarea {
    width: 100%;
    min-height: 68px;
    resize: vertical;
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .file-list-box {
    max-height: 150px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 6px;
    border-radius: 5px;
    background: var(--bg-input);
    border: 1px solid transparent;
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .file-size {
    color: var(--text-muted);
    margin-left: auto;
    font-variant-numeric: tabular-nums;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    margin-top: 8px;
  }

  .metric-card {
    background: var(--bg-input);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 6px 8px;
  }

  .metric-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .metric-val {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  .progress-bar {
    height: 5px;
    background: var(--bg-input);
    border-radius: 3px;
    overflow: hidden;
    margin: 7px 0;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.18s ease;
  }

  .log-box {
    background: var(--bg-input);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 7px 9px;
    max-height: 110px;
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .log-entry {
    padding: 2px 0;
    color: var(--text-secondary);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .banner {
    padding: 7px 10px;
    border-radius: 6px;
    margin-bottom: 9px;
    font-size: 11px;
  }

  #error-msg {
    background: rgba(255, 69, 58, 0.12);
    border: 1px solid rgba(255, 69, 58, 0.35);
    color: #ff6961;
  }

  #info-msg {
    background: var(--accent-soft);
    border: 1px solid var(--accent-border);
    color: var(--accent);
  }

  .hidden { display: none !important; }
  details summary {
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 11px;
    user-select: none;
    margin-top: 7px;
  }
`;
