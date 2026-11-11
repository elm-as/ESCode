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
      width: 100%; height: 100%; overflow: hidden;
      background: #08080c; color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column;
    }
    .hud-bar {
      height: 34px; background: rgba(12, 12, 16, 0.94);
      border-bottom: 1px solid #27272a;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 8px; gap: 6px; z-index: 20; flex-shrink: 0;
    }
    select {
      flex: 1; min-width: 0; background: #14141c; color: #fbbf24;
      border: 1px solid #2e2e3a; border-radius: 5px;
      padding: 2px 6px; font-size: 11px;
      font-family: "JetBrains Mono", Consolas, monospace; outline: none;
    }
    .btn-group { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
    button {
      background: #1f1f29; color: #e4e4e7;
      border: 1px solid #323242; border-radius: 4px;
      padding: 2px 6px; font-size: 10px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-weight: 600; cursor: pointer; transition: all 0.12s;
    }
    button:hover { background: #f59e0b; color: #09090b; border-color: #f59e0b; }
    button.active { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-color: #f59e0b; }

    .stage {
      flex: 1; width: 100%; height: 100%; position: relative;
      overflow: hidden; background: #060609;
    }
    #pygame-view {
      width: 100%; height: 100%; object-fit: contain;
      display: ${activeKind === "pygame" ? "block" : "none"};
      background: #000;
    }
    #ansi-scroll-wrapper {
      width: 100%; height: 100%; overflow: auto;
      padding: 8px 10px;
      display: ${activeKind === "pygame" ? "none" : "block"};
    }
    #ansi-view {
      display: inline-block; min-width: 100%;
      font-family: "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
      font-size: 11px; line-height: 1.25; white-space: pre;
      color: #f4f4f5; font-variant-numeric: tabular-nums;
      transform-origin: top left; text-align: left;
    }
    #ansi-view.wrap {
      white-space: pre-wrap !important;
      word-break: break-word !important;
      transform: none !important;
      width: 100% !important;
    }

    .status-pill {
      position: absolute; bottom: 8px; right: 8px;
      background: rgba(9, 9, 11, 0.85); border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fbbf24; font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 9px; padding: 2px 5px; border-radius: 4px; pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="hud-bar">
    <select id="script-select" title="Choisir le script Python / C">
      ${optionsHtml}
    </select>
    <div class="btn-group">
      ${
        activeKind === "pygame"
          ? `<button onclick="sendKey('SPACE')" title="Envoyer touche ESPACE">ESPACE</button>
             <button onclick="sendKey('p')" title="Envoyer touche P">P</button>`
          : `<button id="btn-fit" class="active" onclick="toggleFit()" title="Ajuster la largeur automatiquement pour tout afficher sans coupure">Fit</button>
             <button id="btn-wrap" onclick="toggleWrap()" title="Retour à la ligne automatique">Wrap</button>
             <button onclick="changeFontSize(-1)" title="Diminuer la police">A-</button>
             <button onclick="changeFontSize(1)" title="Augmenter la police">A+</button>`
      }
      <button onclick="restartScript()" title="Relancer le script">↻</button>
    </div>
  </div>

  <div class="stage" id="stage">
    <img id="pygame-view" alt="Simulation Pygame" />
    <div id="ansi-scroll-wrapper">
      <pre id="ansi-view">Initialisation du moteur Python / C…</pre>
    </div>
    <div class="status-pill" id="fps-pill">${escapeHtml(activeKind.toUpperCase())}</div>
  </div>

  <script>
    const selectEl = document.getElementById('script-select');
    const imgEl = document.getElementById('pygame-view');
    const wrapperEl = document.getElementById('ansi-scroll-wrapper');
    const ansiEl = document.getElementById('ansi-view');
    const stageEl = document.getElementById('stage');
    const pillEl = document.getElementById('fps-pill');
    const btnFit = document.getElementById('btn-fit');
    const btnWrap = document.getElementById('btn-wrap');

    let currentKind = ${JSON.stringify(activeKind)};
    let frameActive = false;
    let isFit = true;
    let isWrap = false;
    let baseFontSize = 10.5;

    function applyAnsiLayout() {
      if (currentKind === 'pygame' || !ansiEl || !wrapperEl) return;
      if (isWrap) {
        ansiEl.classList.add('wrap');
        ansiEl.style.transform = 'none';
        ansiEl.style.fontSize = baseFontSize + 'px';
        return;
      }
      ansiEl.classList.remove('wrap');
      ansiEl.style.fontSize = baseFontSize + 'px';

      if (!isFit) {
        ansiEl.style.transform = 'none';
        return;
      }

      ansiEl.style.transform = 'none';
      const availW = wrapperEl.clientWidth - 20;
      const contentW = ansiEl.scrollWidth;

      if (contentW > availW && availW > 60) {
        const scale = availW / contentW;
        ansiEl.style.transform = 'scale(' + scale.toFixed(4) + ')';
      } else {
        ansiEl.style.transform = 'none';
      }
    }

    function toggleFit() {
      isFit = !isFit;
      if (isFit) isWrap = false;
      updateButtons();
      applyAnsiLayout();
    }

    function toggleWrap() {
      isWrap = !isWrap;
      if (isWrap) isFit = false;
      updateButtons();
      applyAnsiLayout();
    }

    function updateButtons() {
      if (btnFit) btnFit.className = isFit ? 'active' : '';
      if (btnWrap) btnWrap.className = isWrap ? 'active' : '';
    }

    function changeFontSize(delta) {
      baseFontSize = Math.max(7, Math.min(18, baseFontSize + delta));
      applyAnsiLayout();
    }

    if (window.ResizeObserver && wrapperEl) {
      new ResizeObserver(() => applyAnsiLayout()).observe(wrapperEl);
    }

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
      else if (e.key === 'r' || e.key === 'R') { sendKey('r'); }
    });

    imgEl.addEventListener('click', (e) => {
      const rect = imgEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const x = Math.round(((e.clientX - rect.left) / rect.width) * 720);
        const y = Math.round(((e.clientY - rect.top) / rect.height) * 1280);
        fetch('/__elmas_click?x=' + x + '&y=' + y, { method: 'POST' }).catch(() => {});
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && currentKind === 'pygame' && !frameActive) {
        pollPygameFrame();
      }
    });

    function pollPygameFrame() {
      if (document.hidden || currentKind !== 'pygame' || frameActive) return;
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
          requestAnimationFrame(applyAnsiLayout);
        } else if (msg.type === 'status') {
          pillEl.textContent = msg.text;
        } else if (msg.type === 'error') {
          if (!imgEl.src) {
            ansiEl.style.display = 'block';
            ansiEl.innerHTML = '<span style="color:#ef4444">Erreur :\\n' + msg.text + '</span>';
            requestAnimationFrame(applyAnsiLayout);
          }
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
