"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWebviewHtml = buildWebviewHtml;
const webview_styles_1 = require("./webview-styles");
/**
 * Generates the HTML content for the Inspecteur AST & Flux Syntaxique panel.
 * Styled with the Elmas Studio macOS Sequoia Dark Glass & Amber Forge DA.
 */
function buildWebviewHtml(webview) {
    const nonce = generateNonce();
    return /* html */ `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Inspecteur AST &amp; Flux</title>
  <style>${webview_styles_1.WEBVIEW_STYLES}</style>
</head>
<body>
  <div class="header-bar">
    <div class="header-title">
      <span class="status-dot"></span>
      ${webview_styles_1.WEBVIEW_ICONS.pulse}
      <span>Inspecteur AST &amp; Flux Syntaxique</span>
    </div>
    <span class="shortcut-pill" title="Raccourci furtif Start / Pause">Ctrl+Alt+M</span>
  </div>

  <div id="error-msg" class="banner hidden"></div>
  <div id="info-msg" class="banner hidden"></div>

  <div class="section" id="import-section">
    <div class="section-header">
      <h2>Source &amp; Capture Rapide</h2>
      <span class="shortcut-pill">Prêt</span>
    </div>
    <div class="controls">
      <button id="btn-capture-file" class="primary" title="Capturer le fichier actuellement ouvert dans l'éditeur">${webview_styles_1.WEBVIEW_ICONS.captureFile} Fichier actif</button>
      <button id="btn-capture-workspace" class="primary" title="Scanner tous les fichiers du projet ouvert">${webview_styles_1.WEBVIEW_ICONS.captureFolder} Projet actif</button>
      <button id="btn-import-file">${webview_styles_1.WEBVIEW_ICONS.file} Fichier…</button>
      <button id="btn-import-files">${webview_styles_1.WEBVIEW_ICONS.file} Fichiers…</button>
      <button id="btn-import-folder">${webview_styles_1.WEBVIEW_ICONS.folder} Dossier…</button>
    </div>

    <details>
      <summary>${webview_styles_1.WEBVIEW_ICONS.code} Injecter un extrait de code ou JSON…</summary>
      <h3>Extrait de code direct</h3>
      <div class="row">
        <label>Fichier cible</label>
        <input id="paste-filename" type="text" placeholder="src/App.tsx" />
      </div>
      <textarea id="paste-code" placeholder="Coller le code source à rejouer…"></textarea>
      <div style="margin-top:6px"><button id="btn-paste-code">Charger l'extrait</button></div>

      <h3>Manifeste JSON multi-fichiers</h3>
      <textarea id="paste-project" placeholder='{ "files": [{ "path": "src/main.ts", "content": "..." }] }'></textarea>
      <div style="margin-top:6px"><button id="btn-paste-project">Charger le JSON</button></div>
    </details>
  </div>

  <div class="section hidden" id="control-section">
    <div class="section-header">
      <h2>Exécution &amp; Contrôle</h2>
      <span class="shortcut-pill" id="state-badge">En attente</span>
    </div>
    <div class="controls">
      <button id="btn-start" class="primary">${webview_styles_1.WEBVIEW_ICONS.play} Démarrer</button>
      <button id="btn-pause" disabled>${webview_styles_1.WEBVIEW_ICONS.pause} Pause</button>
      <button id="btn-resume" class="primary hidden">${webview_styles_1.WEBVIEW_ICONS.play} Reprendre</button>
      <button id="btn-stop" disabled class="danger">${webview_styles_1.WEBVIEW_ICONS.stop} Arrêter</button>
      <button id="btn-skip" disabled>${webview_styles_1.WEBVIEW_ICONS.skip} Sauter</button>
      <button id="btn-restart" disabled>${webview_styles_1.WEBVIEW_ICONS.restart} Relancer</button>
    </div>
  </div>

  <div class="section hidden" id="config-section">
    <div class="section-header">
      <h2>Calibrage de Frappe</h2>
    </div>
    <div class="row">
      <label>Mode de frappe</label>
      <select id="cfg-mode">
        <option value="manual">Clavier Magique (Manuel)</option>
        <option value="auto">Autopilote Humain (Auto)</option>
      </select>
    </div>
    <div class="row">
      <label>Architecture moteur</label>
      <select id="cfg-simMode">
        <option value="replay">Séquentiel (Replay V1)</option>
        <option value="cognitive">Trajectoire Cognitive (AST V2)</option>
      </select>
    </div>
    <div class="row">
      <label>Cadence (car./s)</label>
      <input id="cfg-speed" type="number" value="14" min="0.5" max="100" step="0.5" />
    </div>
    <div class="row">
      <label>Taux de fautes AZERTY</label>
      <input id="cfg-errorRate" type="range" min="0" max="35" value="4" />
      <span id="cfg-errorRate-val" class="shortcut-pill">4%</span>
    </div>
    <div class="row">
      <label>Auto-correction humaine</label>
      <input id="cfg-correction" type="checkbox" checked />
    </div>
    <div class="row">
      <label>Latence de correction</label>
      <select id="cfg-corrDelay">
        <option value="immediate">Immédiate (1 car.)</option>
        <option value="short">Courte (2-3 car.)</option>
        <option value="medium">Moyenne (4-7 car.)</option>
        <option value="long">Longue (8-12 car.)</option>
      </select>
    </div>
    <div class="row">
      <label>Micro-pauses de réflexion</label>
      <input id="cfg-humanPauses" type="checkbox" checked />
    </div>
    <div class="row">
      <label>Variance organique (%)</label>
      <input id="cfg-randomness" type="number" value="25" min="0" max="100" />
    </div>
  </div>

  <div class="section hidden" id="progress-section">
    <div class="section-header">
      <h2>Télémétrie Temps Réel</h2>
      <span class="shortcut-pill"><span id="prog-pct">0.0</span>%</span>
    </div>
    <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);">
      [<span id="prog-file-index">—</span>] <strong id="prog-file" style="color:var(--text-primary)">—</strong>
    </div>
    <div class="progress-bar"><div class="progress-bar-fill" id="prog-bar" style="width:0"></div></div>
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-label">Caractères</div><div class="metric-val" id="prog-chars">0 / 0</div></div>
      <div class="metric-card"><div class="metric-label">Vitesse</div><div class="metric-val"><span id="prog-speed">0.0</span> c/s</div></div>
      <div class="metric-card"><div class="metric-label">Fautes / Corr.</div><div class="metric-val"><span id="prog-errors">0</span> / <span id="prog-corrections">0</span></div></div>
      <div class="metric-card"><div class="metric-label">Écoulé / Reste</div><div class="metric-val"><span id="prog-elapsed">—</span> · <span id="prog-remaining">—</span></div></div>
    </div>
  </div>

  <div class="section hidden" id="cognitive-section">
    <div class="section-header"><h2>Journal Cognitif AST</h2></div>
    <div class="log-box" id="cog-log"><div class="log-entry">En attente de trajectoire…</div></div>
  </div>

  <div class="section hidden" id="tree-section">
    <div class="section-header"><h2>Fichiers Chargés</h2></div>
    <div class="file-list-box" id="file-list"></div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const on = (id, evt, fn) => document.getElementById(id)?.addEventListener(evt, fn);

    on('btn-capture-file',      'click', () => vscode.postMessage({ type: 'captureActiveFile' }));
    on('btn-capture-workspace', 'click', () => vscode.postMessage({ type: 'captureWorkspace' }));
    on('btn-import-file',       'click', () => vscode.postMessage({ type: 'importFile' }));
    on('btn-import-files',      'click', () => vscode.postMessage({ type: 'importFiles' }));
    on('btn-import-folder',     'click', () => vscode.postMessage({ type: 'importFolder' }));
    on('btn-paste-project', 'click', () => {
      const data = document.getElementById('paste-project').value;
      vscode.postMessage({ type: 'pasteProject', data });
    });
    on('btn-paste-code', 'click', () => {
      const data = document.getElementById('paste-code').value;
      const filename = document.getElementById('paste-filename').value || 'untitled.ts';
      vscode.postMessage({ type: 'pasteCode', data, filename });
    });

    on('cfg-simMode', 'change', (e) => vscode.postMessage({ type: 'setSimulationMode', mode: e.target.value }));
    on('cfg-mode',    'change', () => sendConfig());
    on('cfg-speed',   'change', () => sendConfig());
    on('cfg-correction',  'change', () => sendConfig());
    on('cfg-corrDelay',   'change', () => sendConfig());
    on('cfg-humanPauses', 'change', () => sendConfig());
    on('cfg-randomness',  'change', () => sendConfig());
    on('cfg-errorRate', 'input', (e) => {
      document.getElementById('cfg-errorRate-val').textContent = e.target.value + '%';
      sendConfig();
    });

    on('btn-start',   'click', () => sendConfig().then(() => vscode.postMessage({ type: 'start' })));
    on('btn-pause',   'click', () => vscode.postMessage({ type: 'pause' }));
    on('btn-resume',  'click', () => vscode.postMessage({ type: 'resume' }));
    on('btn-stop',    'click', () => vscode.postMessage({ type: 'stop' }));
    on('btn-skip',    'click', () => vscode.postMessage({ type: 'skipFile' }));
    on('btn-restart', 'click', () => vscode.postMessage({ type: 'restart' }));

    function applyConfig(typing, error, simulationMode) {
      const el = (id) => document.getElementById(id);
      el('cfg-simMode').value = simulationMode;
      el('cfg-mode').value = typing.mode;
      el('cfg-speed').value = typing.speed;
      el('cfg-randomness').value = typing.randomness;
      el('cfg-humanPauses').checked = typing.humanPauses;
      el('cfg-errorRate').value = error.rate;
      el('cfg-errorRate-val').textContent = error.rate + '%';
      el('cfg-correction').checked = error.correctionEnabled;
      el('cfg-corrDelay').value = error.correctionDelay;
    }

    function sendConfig() {
      return Promise.resolve(vscode.postMessage({
        type: 'updateConfig',
        config: {
          mode:              document.getElementById('cfg-mode').value,
          speed:             parseFloat(document.getElementById('cfg-speed').value),
          rate:              parseInt(document.getElementById('cfg-errorRate').value, 10),
          correctionEnabled: document.getElementById('cfg-correction').checked,
          correctionDelay:   document.getElementById('cfg-corrDelay').value,
          humanPauses:       document.getElementById('cfg-humanPauses').checked,
          randomness:        parseInt(document.getElementById('cfg-randomness').value, 10),
        },
      }));
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'configLoaded':
          applyConfig(msg.typing, msg.error, msg.simulationMode);
          break;
        case 'simulationModeChanged':
          document.getElementById('cfg-simMode').value = msg.mode;
          break;
        case 'projectLoaded':
          showSection('tree-section'); showSection('config-section'); showSection('control-section');
          renderFileList(msg.files); showInfo(msg.files.length + ' fichier(s) prêt(s) dans le tampon AST');
          break;
        case 'progressUpdate':
          showSection('progress-section'); updateProgress(msg.progress);
          break;
        case 'stateChange':
          updateControls(msg.state);
          break;
        case 'cognitiveAction':
          showSection('cognitive-section'); appendCognitiveAction(msg);
          break;
        case 'error': showError(msg.message); break;
        case 'info': showInfo(msg.message); break;
      }
    });

    function appendCognitiveAction(msg) {
      const log = document.getElementById('cog-log');
      if (msg.index === 0) { log.replaceChildren(); }
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.textContent = '[' + (msg.index + 1) + '/' + msg.total + '] ' + msg.actionDescription;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }

    function renderFileList(files) {
      const container = document.getElementById('file-list');
      container.replaceChildren();
      files.forEach((f) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = f.enabled;
        const name = document.createElement('span');
        name.textContent = f.path;
        const size = document.createElement('span');
        size.className = 'file-size';
        size.textContent = (f.size / 1024).toFixed(1) + ' Ko';
        div.append(checkbox, name, size);
        checkbox.addEventListener('change', (e) => {
          vscode.postMessage({ type: 'toggleFile', path: f.path, enabled: e.target.checked });
        });
        container.appendChild(div);
      });
    }

    function updateProgress(p) {
      const el = (id) => document.getElementById(id);
      el('prog-file').textContent = p.currentFile || '—';
      el('prog-file-index').textContent = p.totalFiles > 0 ? (p.currentFileIndex + 1) + '/' + p.totalFiles : '—';
      el('prog-pct').textContent = p.overallProgress.toFixed(1);
      el('prog-bar').style.width = p.overallProgress.toFixed(1) + '%';
      el('prog-chars').textContent = p.charsWritten.toLocaleString() + ' / ' + p.totalChars.toLocaleString();
      el('prog-speed').textContent = p.currentSpeed.toFixed(1);
      el('prog-errors').textContent = p.totalErrors;
      el('prog-corrections').textContent = p.totalCorrections;
      el('prog-elapsed').textContent = formatMs(p.elapsedTime);
      el('prog-remaining').textContent = formatMs(p.estimatedRemainingTime);
    }

    function updateControls(state) {
      const isRunning = ['preparing', 'typing', 'correcting', 'executing', 'waitingTerminal'].includes(state);
      const isPaused  = state === 'paused';
      const isStopped = ['idle', 'completed', 'cancelled', 'error'].includes(state);
      document.getElementById('state-badge').textContent = state;
      setEnabled('btn-start', isStopped);
      setEnabled('btn-pause', isRunning);
      setEnabled('btn-stop', isRunning || isPaused);
      setEnabled('btn-skip', isRunning || isPaused);
      setEnabled('btn-restart', state !== 'idle');
      document.getElementById('btn-resume').classList.toggle('hidden', !isPaused);
      document.getElementById('btn-pause').classList.toggle('hidden', isPaused);
    }

    function setEnabled(id, enabled) {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    }
    function showSection(id) { document.getElementById(id)?.classList.remove('hidden'); }
    function showError(msg) {
      const el = document.getElementById('error-msg');
      el.textContent = msg; el.classList.remove('hidden');
      setTimeout(() => el.classList.add('hidden'), 7000);
    }
    function showInfo(msg) {
      const el = document.getElementById('info-msg');
      el.textContent = msg; el.classList.remove('hidden');
      setTimeout(() => el.classList.add('hidden'), 4500);
    }
    function formatMs(ms) {
      if (!ms || ms <= 0) return '—';
      const s = Math.floor(ms / 1000);
      return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
    }

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
function generateNonce() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
//# sourceMappingURL=webview-html.js.map