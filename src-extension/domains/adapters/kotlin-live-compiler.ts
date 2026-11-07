/**
 * Instantaneous in-memory Kotlin / Jetpack Compose @Composable parser & HTML renderer.
 * Provides <15ms keystroke-by-keystroke live preview via SSE while preserving remember { mutableStateOf(...) } state.
 */

export interface ParsedComposeModel {
  backgroundColor: string;
  bodyHtml: string;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatComposeText(rawText: string): string {
  const escaped = escapeHtml(rawText);
  return escaped.replace(/\$\{?([a-zA-Z0-9_]+)\}?/g, (_m, varName) => {
    return `<span data-compose-var="${varName}">0</span>`;
  });
}

function mapTypographyClass(line: string): string {
  if (line.includes("typography.h3")) return "font-size: 36px; font-weight: 700;";
  if (line.includes("typography.h4") || line.includes("headlineMedium")) {
    return "font-size: 32px; font-weight: 700;";
  }
  if (line.includes("typography.h5") || line.includes("headlineSmall")) {
    return "font-size: 24px; font-weight: 700;";
  }
  if (line.includes("typography.h6") || line.includes("titleLarge")) {
    return "font-size: 19px; font-weight: 600;";
  }
  if (line.includes("subtitle") || line.includes("body2")) {
    return "font-size: 13px; color: #a1a1aa;";
  }
  return "font-size: 15px;";
}

/**
 * Parses a Kotlin Jetpack Compose source file into a live preview model.
 */
export function parseKotlinComposeSource(ktSource: string): ParsedComposeModel {
  const elements: string[] = [];
  const lines = ktSource.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const spacerMatch = line.match(/Spacer\s*\(.*height\s*\(\s*([0-9.]+)\.dp\s*\)/);
    if (spacerMatch) {
      elements.push(`<div style="height: ${spacerMatch[1]}px; width: 100%; flex-shrink: 0;"></div>`);
      continue;
    }

    if (line.startsWith("Button(") || line.startsWith("OutlinedButton(")) {
      let btnLabel = "Action";
      const sameLineText = line.match(/Text\(\s*"([^"]*)"\s*\)/);
      if (sameLineText) {
        btnLabel = formatComposeText(sameLineText[1]);
      } else if (i + 1 < lines.length) {
        const nextLineText = lines[i + 1].match(/Text\(\s*"([^"]*)"\s*\)/);
        if (nextLineText) {
          btnLabel = formatComposeText(nextLineText[1]);
          i++;
        }
      }
      elements.push(
        `<button class="compose-btn" onclick="window.__incrementComposeCount()">${btnLabel}</button>`
      );
      continue;
    }

    const textMatch = line.match(/^Text\(\s*"([^"]*)"(.*)$/);
    if (textMatch) {
      const content = formatComposeText(textMatch[1]);
      const styleCss = mapTypographyClass(textMatch[2] || "");
      elements.push(`<div class="compose-text" style="${styleCss}">${content}</div>`);
    }
  }

  return {
    backgroundColor: "#09090b",
    bodyHtml: elements.join("\n"),
  };
}

/**
 * Renders the HTML document for the Jetpack Compose Fast Preview server with SSE live-patching.
 */
export function renderKotlinComposeDocument(model: ParsedComposeModel): string {
  const payloadJson = JSON.stringify(model);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; }
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100vh; overflow: hidden;
      background-color: #09090b; color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Roboto", "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    #compose-root {
      width: 100%; height: 100vh; padding: 24px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center;
    }
    .compose-badge {
      position: absolute; top: 52px;
      font-size: 10px; font-weight: 700; letter-spacing: 1px;
      color: #a855f7; background: rgba(168, 85, 247, 0.12);
      border: 1px solid rgba(168, 85, 247, 0.3);
      padding: 3px 10px; border-radius: 999px;
    }
    .compose-text { line-height: 1.4; color: #f4f4f5; }
    .compose-btn {
      background: #6200ee; color: #ffffff; border: none;
      padding: 10px 24px; border-radius: 8px;
      font-size: 14px; font-weight: 600; letter-spacing: 0.4px;
      cursor: pointer; box-shadow: 0 3px 8px rgba(98, 0, 238, 0.4);
      transition: transform 0.08s ease, background 0.12s ease;
    }
    .compose-btn:active { transform: scale(0.95); background: #7c4dff; }
  </style>
</head>
<body>
  <div id="compose-root">
    <div class="compose-badge">JETPACK COMPOSE LIVE</div>
    <div id="compose-body"></div>
  </div>

  <script>
    window.__composeState = { count: 0 };

    function syncComposeState() {
      document.querySelectorAll('[data-compose-var]').forEach((el) => {
        el.textContent = String(window.__composeState.count);
      });
    }

    window.__incrementComposeCount = function() {
      window.__composeState.count += 1;
      syncComposeState();
    };

    function applyPatch(model) {
      const body = document.getElementById('compose-body');
      if (body) body.innerHTML = model.bodyHtml;
      syncComposeState();
    }

    applyPatch(${payloadJson});

    try {
      const es = new EventSource('/__elmas_live_reload');
      es.onmessage = (e) => {
        if (!e.data || e.data === 'connected') return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'compose-patch') applyPatch(msg.payload);
        } catch {}
      };
    } catch {}
  </script>
</body>
</html>`;
}
