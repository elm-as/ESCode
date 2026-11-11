"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPolyglotPreviewHtml = renderPolyglotPreviewHtml;
function renderPolyglotPreviewHtml(target, previewUrl) {
    const isWeb = target.mode === "web";
    const buttonsHtml = target.interactiveKeys
        .map((k) => `<button onclick="sendKey('${escapeHtml(k)}')">${escapeHtml(k)}</button>`)
        .join("");
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    html, body {
      width: 100%; height: 100%;
      overflow: hidden; background: #08080c;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column;
    }
    .hud-bar {
      height: 36px; background: rgba(12, 12, 16, 0.94);
      border-bottom: 1px solid #27272a;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 10px; gap: 6px; z-index: 20; flex-shrink: 0;
    }
    .badge {
      font-size: 11px; font-weight: 700; color: #fbbf24;
      font-family: "JetBrains Mono", Consolas, monospace;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .btn-group { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    button {
      background: #181822; color: #e4e4e7;
      border: 1px solid #2e2e3e; border-radius: 4px;
      padding: 3px 7px; font-size: 10px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-weight: 600; cursor: pointer;
    }
    button:hover {
      background: #f59e0b; color: #09090b; border-color: #f59e0b;
    }
    .stage {
      flex: 1; width: 100%; height: 100%;
      position: relative; display: flex;
      align-items: center; justify-content: center;
      overflow: hidden; background: #060609;
    }
    iframe {
      width: 100%; height: 100%; border: none;
      display: ${isWeb ? "block" : "none"};
    }
    #ansi-view {
      width: 100%; height: 100%;
      padding: 10px 8px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 11px; line-height: 1.2;
      white-space: pre-wrap; overflow: auto;
      display: ${isWeb ? "none" : "block"};
      color: #f4f4f5;
    }
    .status-pill {
      position: absolute; bottom: 8px; right: 8px;
      background: rgba(9, 9, 11, 0.85);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fbbf24;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 10px; padding: 2px 6px;
      border-radius: 4px; pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="hud-bar">
    <div class="badge">${escapeHtml(target.name)}</div>
    <div class="btn-group">
      ${buttonsHtml}
      <button onclick="restartProcess()" title="Relancer le processus">↻</button>
    </div>
  </div>
  <div class="stage">
    <iframe id="web-frame" src="${isWeb ? escapeHtml(previewUrl) : "about:blank"}"></iframe>
    <pre id="ansi-view">Initialisation de ${escapeHtml(target.name)}…</pre>
    <div class="status-pill" id="status-pill">${escapeHtml(target.mode.toUpperCase())}</div>
  </div>

  <script>
    const ansiEl = document.getElementById('ansi-view');
    const pillEl = document.getElementById('status-pill');

    function sendKey(keyName) {
      fetch('/__elmas_polyglot_key?key=' + encodeURIComponent(keyName), { method: 'POST' }).catch(() => {});
    }

    function restartProcess() {
      fetch('/__elmas_polyglot_restart', { method: 'POST' }).catch(() => {});
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); sendKey('SPACE'); }
      else if (e.key === 'r' || e.key === 'R') { sendKey('r'); }
      else if (e.key === 'p' || e.key === 'P') { sendKey('p'); }
      else if (e.key === 'q' || e.key === 'Q') { sendKey('q'); }
    });

    try {
      const es = new EventSource('/__elmas_polyglot_events');
      es.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'ansi') {
          ansiEl.innerHTML = msg.html;
        } else if (msg.type === 'reload') {
          const frame = document.getElementById('web-frame');
          if (frame) frame.src = frame.src;
        } else if (msg.type === 'status') {
          pillEl.textContent = msg.text;
        }
      };
    } catch {}
  </script>
</body>
</html>`;
}
function escapeHtml(raw) {
    return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
//# sourceMappingURL=polyglot-preview-html.js.map