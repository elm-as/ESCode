/**
 * Instantaneous in-memory Dart/Flutter widget parser & HTML renderer for Fast Mode.
 * Allows <15ms keystroke-by-keystroke live preview without waiting for Gradle or CanvasKit cold builds,
 * while preserving interactive StatefulWidget state (such as _counter) across edits.
 */

export interface ParsedFlutterTheme {
  scaffoldBg: string;
  appBarTitle: string;
  appBarBg: string;
  hasAppBar: boolean;
  bodyHtml: string;
  hasFab: boolean;
  fabBg: string;
  fabIcon: string;
}

/**
 * Converts a Dart Color(0xAARRGGBB) or Colors.* literal into a CSS color string.
 */
export function parseDartColor(source: string, fallback: string): string {
  const hexMatch = source.match(/Color\(\s*0x([0-9a-fA-F]{8})\s*\)/);
  if (hexMatch) {
    const hex = hexMatch[1];
    const alpha = parseInt(hex.slice(0, 2), 16) / 255;
    const r = parseInt(hex.slice(2, 4), 16);
    const g = parseInt(hex.slice(4, 6), 16);
    const b = parseInt(hex.slice(6, 8), 16);
    if (alpha >= 0.99) {
      return `#${hex.slice(2, 8)}`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  }

  const namedColors: Record<string, string> = {
    "Colors.amber": "#ffc107",
    "Colors.blue": "#2196f3",
    "Colors.cyan": "#00bcd4",
    "Colors.green": "#4caf50",
    "Colors.indigo": "#3f51b5",
    "Colors.orange": "#ff9800",
    "Colors.pink": "#e91e63",
    "Colors.purple": "#9c27b0",
    "Colors.red": "#f44336",
    "Colors.teal": "#009688",
    "Colors.white": "#ffffff",
    "Colors.black": "#000000",
    "Colors.grey": "#9e9e9e",
  };

  for (const [key, val] of Object.entries(namedColors)) {
    if (source.includes(key)) return val;
  }
  return fallback;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatInterpolatedText(rawText: string): string {
  const escaped = escapeHtml(rawText);
  return escaped.replace(/\$\{?([a-zA-Z0-9_]+)\}?/g, (_match, varName) => {
    return `<span data-flutter-var="${varName}">0</span>`;
  });
}

function parseTextStyleCss(block: string): string {
  const styles: string[] = [];
  const color = parseDartColor(block, "");
  if (color) styles.push(`color: ${color}`);

  const sizeMatch = block.match(/fontSize\s*:\s*([0-9.]+)/);
  if (sizeMatch) styles.push(`font-size: ${sizeMatch[1]}px`);

  if (block.includes("FontWeight.bold") || block.includes("FontWeight.w700")) {
    styles.push("font-weight: 700");
  } else if (block.includes("FontWeight.w600")) {
    styles.push("font-weight: 600");
  } else if (block.includes("FontWeight.w500")) {
    styles.push("font-weight: 500");
  }

  const spacingMatch = block.match(/letterSpacing\s*:\s*(-?[0-9.]+)/);
  if (spacingMatch) styles.push(`letter-spacing: ${spacingMatch[1]}px`);

  return styles.join("; ");
}

function extractBalancedParen(source: string, startIdx: number): string {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = startIdx; i < source.length; i++) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : "";
    if (ch === "'" && !inDouble && prev !== "\\") inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== "\\") inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) return source.slice(startIdx + 1, i);
      }
    }
  }
  return source.slice(startIdx + 1);
}

function parseBodyWidgets(dartSource: string): string {
  const bodyIdx = dartSource.indexOf("body:");
  if (bodyIdx === -1) return "";

  const fabIdx = dartSource.indexOf("floatingActionButton:", bodyIdx);
  const bodySection =
    fabIdx !== -1 ? dartSource.slice(bodyIdx, fabIdx) : dartSource.slice(bodyIdx);

  const elements: string[] = [];
  const tokenRegex = /(?:const\s+|new\s+)?(Text|SizedBox|ElevatedButton|FilledButton|Icon)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(bodySection)) !== null) {
    const widgetType = match[1];
    const openParenIdx = match.index + match[0].length - 1;
    const inner = extractBalancedParen(bodySection, openParenIdx);

    if (widgetType === "Text") {
      const strMatch = inner.match(/^\s*(['"])([\s\S]*?)\1/);
      if (strMatch) {
        const textVal = formatInterpolatedText(strMatch[2]);
        const styleCss = parseTextStyleCss(inner);
        elements.push(`<div class="fl-text" style="${styleCss}">${textVal}</div>`);
      }
    } else if (widgetType === "SizedBox") {
      const hMatch = inner.match(/height\s*:\s*([0-9.]+)/);
      const wMatch = inner.match(/width\s*:\s*([0-9.]+)/);
      const h = hMatch ? `${hMatch[1]}px` : "0px";
      const w = wMatch ? `${wMatch[1]}px` : "100%";
      elements.push(`<div style="height: ${h}; width: ${w}; flex-shrink: 0;"></div>`);
    } else if (widgetType === "ElevatedButton" || widgetType === "FilledButton") {
      const labelMatch = inner.match(/Text\(\s*(['"])([\s\S]*?)\1/);
      const label = labelMatch ? formatInterpolatedText(labelMatch[2]) : "Button";
      const bg = parseDartColor(inner, "#0284c7");
      elements.push(
        `<button class="fl-btn" style="background:${bg}" onclick="window.__incrementFlutterCounter()">${label}</button>`
      );
    } else if (widgetType === "Icon") {
      const sizeMatch = inner.match(/size\s*:\s*([0-9.]+)/);
      const color = parseDartColor(inner, "#ffffff");
      const size = sizeMatch ? `${sizeMatch[1]}px` : "24px";
      elements.push(
        `<div style="color:${color}; font-size:${size}; line-height:1;">★</div>`
      );
    }

    tokenRegex.lastIndex = openParenIdx + inner.length + 1;
  }

  return elements.join("\n");
}

/**
 * Parses a Flutter main.dart source string into a structured preview model.
 */
export function parseFlutterSource(dartSource: string): ParsedFlutterTheme {
  const scaffoldBgMatch = dartSource.match(/scaffoldBackgroundColor\s*:\s*(?:const\s+)?(Color\([^)]+\)|Colors\.[a-zA-Z]+)/);
  const scaffoldBg = scaffoldBgMatch ? parseDartColor(scaffoldBgMatch[1], "#09090b") : "#09090b";

  let hasAppBar = false;
  let appBarTitle = "";
  let appBarBg = "#18181b";

  const appBarIdx = dartSource.indexOf("AppBar(");
  if (appBarIdx !== -1) {
    hasAppBar = true;
    const appBarInner = extractBalancedParen(dartSource, appBarIdx + 6);
    const titleMatch = appBarInner.match(/Text\(\s*(['"])([\s\S]*?)\1/);
    if (titleMatch) {
      appBarTitle = formatInterpolatedText(titleMatch[2]);
    }
    appBarBg = parseDartColor(appBarInner, "#18181b");
  }

  let hasFab = false;
  let fabBg = "#0284c7";
  let fabIcon = "+";

  const fabIdx = dartSource.indexOf("FloatingActionButton(");
  if (fabIdx !== -1) {
    hasFab = true;
    const fabInner = extractBalancedParen(dartSource, fabIdx + 20);
    fabBg = parseDartColor(fabInner, "#0284c7");
    if (fabInner.includes("Icons.remove")) fabIcon = "−";
    else if (fabInner.includes("Icons.refresh")) fabIcon = "↻";
    else if (fabInner.includes("Icons.check")) fabIcon = "✓";
  }

  const bodyHtml = parseBodyWidgets(dartSource);

  return {
    scaffoldBg,
    appBarTitle,
    appBarBg,
    hasAppBar,
    bodyHtml,
    hasFab,
    fabBg,
    fabIcon,
  };
}

/**
 * Renders the full HTML document for the Flutter Fast Preview server with SSE hot-patching.
 */
export function renderFlutterPreviewDocument(parsed: ParsedFlutterTheme): string {
  const payloadJson = JSON.stringify(parsed);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; }
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100vh; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Roboto", "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    #fl-scaffold {
      position: relative; width: 100%; height: 100vh;
      display: flex; flex-direction: column;
      background-color: ${parsed.scaffoldBg}; color: #ffffff;
      transition: background-color 0.08s ease;
    }
    .debug-ribbon {
      position: absolute; top: 12px; right: -28px; width: 96px;
      background: rgba(183, 28, 28, 0.88); color: #ffffff;
      font-size: 8.5px; font-weight: 800; letter-spacing: 0.8px;
      text-align: center; padding: 2px 0; transform: rotate(45deg);
      z-index: 50; pointer-events: none; box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }
    #fl-appbar {
      height: 56px; padding: 0 16px;
      display: ${parsed.hasAppBar ? "flex" : "none"};
      align-items: center;
      background-color: ${parsed.appBarBg};
      font-size: 20px; font-weight: 500; color: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3); flex-shrink: 0;
    }
    #fl-body {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 20px; text-align: center; overflow-y: auto;
    }
    .fl-text { line-height: 1.35; }
    .fl-btn {
      border: none; color: #fff; padding: 10px 20px; border-radius: 20px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .fl-btn:active { transform: scale(0.97); }
    #fl-fab {
      position: absolute; right: 16px; bottom: 16px;
      width: 56px; height: 56px; border-radius: 16px; border: none;
      display: ${parsed.hasFab ? "flex" : "none"};
      align-items: center; justify-content: center;
      background-color: ${parsed.fabBg}; color: #ffffff;
      font-size: 26px; font-weight: 400; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.45);
      transition: transform 0.08s ease, background-color 0.08s ease;
    }
    #fl-fab:active { transform: scale(0.92); }
  </style>
</head>
<body>
  <div id="fl-scaffold">
    <div class="debug-ribbon">DEBUG</div>
    <div id="fl-appbar">${parsed.appBarTitle}</div>
    <div id="fl-body">${parsed.bodyHtml}</div>
    <button id="fl-fab" onclick="window.__incrementFlutterCounter()">${parsed.fabIcon}</button>
  </div>

  <script>
    window.__flutterState = { _counter: 0, counter: 0 };

    function syncStateToDom() {
      document.querySelectorAll('[data-flutter-var]').forEach((el) => {
        const key = el.getAttribute('data-flutter-var');
        if (key && key in window.__flutterState) {
          el.textContent = String(window.__flutterState[key]);
        } else {
          el.textContent = String(window.__flutterState._counter);
        }
      });
    }

    window.__incrementFlutterCounter = function() {
      window.__flutterState._counter += 1;
      window.__flutterState.counter += 1;
      syncStateToDom();
    };

    function applyPatch(model) {
      const scaffold = document.getElementById('fl-scaffold');
      const appbar = document.getElementById('fl-appbar');
      const body = document.getElementById('fl-body');
      const fab = document.getElementById('fl-fab');

      if (scaffold) scaffold.style.backgroundColor = model.scaffoldBg;
      if (appbar) {
        appbar.style.display = model.hasAppBar ? 'flex' : 'none';
        appbar.style.backgroundColor = model.appBarBg;
        appbar.innerHTML = model.appBarTitle;
      }
      if (body) {
        body.innerHTML = model.bodyHtml;
      }
      if (fab) {
        fab.style.display = model.hasFab ? 'flex' : 'none';
        fab.style.backgroundColor = model.fabBg;
        fab.textContent = model.fabIcon;
      }
      syncStateToDom();
    }

    applyPatch(${payloadJson});

    try {
      const es = new EventSource('/__elmas_live_reload');
      es.onmessage = (e) => {
        if (!e.data || e.data === 'connected') return;
        if (e.data === 'reload') { window.location.reload(); return; }
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'flutter-patch') applyPatch(msg.payload);
        } catch {}
      };
    } catch {}
  </script>
</body>
</html>`;
}
