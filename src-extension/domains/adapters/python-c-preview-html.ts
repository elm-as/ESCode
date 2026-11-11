export interface ScriptEntry {
  relPath: string;
  fullPath: string;
  kind: "pygame" | "c_ansi" | "python_cli";
}

export function renderPythonCPreviewHtml(
  scripts: ScriptEntry[],
  activeRelPath: string,
  activeKind: "pygame" | "c_ansi" | "python_cli"
): string {
  const optionsHtml = scripts
    .map(
      (s) =>
        `<option value="${escapeAttr(s.relPath)}" ${
          s.relPath === activeRelPath ? "selected" : ""
        }>${escapeHtml(s.relPath)}</option>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #08080c;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .hud-bar {
      height: 36px;
      background: rgba(12, 12, 16, 0.92);
      border-bottom: 1px solid #27272a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px;
      gap: 6px;
      z-index: 20;
      flex-shrink: 0;
    }
    select {
      flex: 1;
      min-width: 0;
      background: #14141c;
      color: #fbbf24;
      border: 1px solid #2e2e3a;
      border-radius: 5px;
      padding: 3px 6px;
      font-size: 11px;
      font-family: "JetBrains Mono", Consolas, monospace;
      outline: none;
    }
    .btn-group {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    button {
      background: #1f1f29;
      color: #e4e4e7;
      border: 1px solid #323242;
      border-radius: 4px;
      padding: 3px 7px;
      font-size: 10px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover {
      background: #f59e0b;
      color: #09090b;
      border-color: #f59e0b;
    }
    .stage {
      flex: 1;
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #060609;
    }
    #pygame-view {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: ${activeKind === "pygame" ? "block" : "none"};
    }
    #ansi-view {
      width: 100%;
      height: 100%;
      padding: 8px 6px;
      font-family: "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
      font-size: 11px;
      line-height: 1.15;
      white-space: pre;
      overflow: auto;
      display: ${activeKind === "pygame" ? "none" : "flex"};
      align-items: center;
      justify-content: center;
      text-align: left;
    }
    .status-pill {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(9, 9, 11, 0.78);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fbbf24;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="hud-bar">
    <select id="script-select" title="Choisir le script Python / C">
      ${optionsHtml}
    </select>
    <div class="btn-group">
      <button onclick="sendKey('SPACE')" title="Envoyer touche ESPACE">ESPACE</button>
      <button onclick="sendKey('p')" title="Envoyer touche P">P</button>
      <button onclick="restartScript()" title="Relancer l'animation">↻</button>
    </div>
  </div>
  <div class="stage">
    <img id="pygame-view" alt="Simulation Pygame 9:16" />
    <pre id="ansi-view">Initialisation du moteur Python / C…</pre>
    <div class="status-pill" id="fps-pill">${escapeHtml(activeKind.toUpperCase())}</div>
  </div>

  <script>
    const selectEl = document.getElementById('script-select');
    const imgEl = document.getElementById('pygame-view');
    const ansiEl = document.getElementById('ansi-view');
    const pillEl = document.getElementById('fps-pill');
    let currentKind = ${JSON.stringify(activeKind)};
    let frameActive = false;

    selectEl.addEventListener('change', () => {
      fetch('/__elmas_select?script=' + encodeURIComponent(selectEl.value), { method: 'POST' })
        .then(() => window.location.reload());
    });

    function sendKey(keyName) {
      fetch('/__elmas_key?key=' + encodeURIComponent(keyName), { method: 'POST' }).catch(() => {});
    }

    function restartScript() {
      fetch('/__elmas_restart', { method: 'POST' }).catch(() => {});
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); sendKey('SPACE'); }
      else if (e.key === 'p' || e.key === 'P') { sendKey('p'); }
    });

    function pollPygameFrame() {
      if (currentKind !== 'pygame' || frameActive) return;
      frameActive = true;
      const nextImg = new Image();
      nextImg.onload = () => {
        imgEl.src = nextImg.src;
        frameActive = false;
        requestAnimationFrame(pollPygameFrame);
      };
      nextImg.onerror = () => {
        frameActive = false;
        setTimeout(pollPygameFrame, 120);
      };
      nextImg.src = '/__elmas_frame.jpg?t=' + performance.now();
    }

    if (currentKind === 'pygame') {
      pollPygameFrame();
    }

    try {
      const es = new EventSource('/__elmas_events');
      es.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'switch') {
          window.location.reload();
        } else if (msg.type === 'ansi') {
          ansiEl.innerHTML = msg.html;
        } else if (msg.type === 'status') {
          pillEl.textContent = msg.text;
        }
      };
    } catch {}
  </script>
</body>
</html>`;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(raw: string): string {
  return escapeHtml(raw).replace(/"/g, "&quot;");
}

