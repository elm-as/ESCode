"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIVE_RELOAD_SNIPPET = exports.MIME_MAP = void 0;
exports.normalizeKey = normalizeKey;
exports.formatHtmlForMobile = formatHtmlForMobile;
const path = __importStar(require("path"));
exports.MIME_MAP = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".wasm": "application/wasm",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};
exports.LIVE_RELOAD_SNIPPET = `
<script id="__elmas_reload">
  (() => {
    function hotSwapHtml() {
      fetch(window.location.href, { cache: 'no-store' })
        .then((r) => r.text())
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const scriptEl = doc.getElementById('__elmas_reload');
          if (scriptEl) scriptEl.remove();
          const currentScript = document.getElementById('__elmas_reload');
          Array.from(document.body.childNodes).forEach((node) => {
            if (node !== currentScript) node.remove();
          });
          Array.from(doc.body.childNodes).forEach((node) => {
            document.body.insertBefore(node, currentScript);
          });
          const oldStyles = document.head.querySelectorAll('style');
          const newStyles = doc.head.querySelectorAll('style');
          oldStyles.forEach((s) => s.remove());
          newStyles.forEach((s) => document.head.appendChild(s));
        })
        .catch(() => window.location.reload());
    }

    function hotSwapCss() {
      document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;
        const base = href.split('?')[0];
        link.setAttribute('href', base + '?t=' + Date.now());
      });
    }

    try {
      const es = new EventSource('/__elmas_live_reload');
      es.onmessage = (e) => {
        if (e.data === 'html-update') hotSwapHtml();
        else if (e.data === 'css-update') hotSwapCss();
        else if (e.data === 'reload') window.location.reload();
      };
    } catch {}
  })();
</script>
`;
function normalizeKey(filePath) {
    return path.resolve(filePath).toLowerCase();
}
function formatHtmlForMobile(rawHtml) {
    const hasHtmlTag = rawHtml.toLowerCase().includes("<html");
    const hasViewport = rawHtml.toLowerCase().includes('name="viewport"');
    if (hasHtmlTag) {
        let result = rawHtml;
        if (!hasViewport && result.includes("<head>")) {
            result = result.replace("<head>", '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">');
        }
        if (result.includes("</body>")) {
            return result.replace("</body>", `${exports.LIVE_RELOAD_SNIPPET}</body>`);
        }
        return result + exports.LIVE_RELOAD_SNIPPET;
    }
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body {
      margin: 0; padding: 0; min-height: 100vh;
      background-color: #ffffff; color: #18181b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    body { padding: 24px 20px; line-height: 1.5; }
    h1, h2, h3 { color: #09090b; font-weight: 700; margin-bottom: 8px; }
    p { color: #52525b; font-size: 15px; margin-bottom: 16px; }
  </style>
</head>
<body>
  ${rawHtml}
  ${exports.LIVE_RELOAD_SNIPPET}
</body>
</html>`;
}
//# sourceMappingURL=vanilla-web-html.js.map