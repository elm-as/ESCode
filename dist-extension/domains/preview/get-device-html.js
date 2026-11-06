"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDeviceHtml = generateDeviceHtml;
const device_profiles_1 = require("./device-profiles");
const device_frame_styles_1 = require("./device-frame-styles");
const device_ui_templates_1 = require("./device-ui-templates");
function generateDeviceHtml(options) {
    const { width, height } = (0, device_profiles_1.calculateDeviceDimensions)(options.profile, options.orientation);
    const styles = (0, device_frame_styles_1.getDeviceFrameStyles)(width, height);
    const toolbarHtml = (0, device_ui_templates_1.renderToolbar)(options);
    const statusBarHtml = (0, device_ui_templates_1.renderStatusBar)();
    const standbyHtml = (0, device_ui_templates_1.renderStandbyScreen)(options.status, options.errorMessage);
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Elmas Studio Mobile Virtual Device</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  ${toolbarHtml}

  <div class="viewport-canvas">
    <div class="canvas-inner" id="canvas-inner">
      <div class="device-chassis" id="chassis">
        <div class="side-key key-action"></div>
        <div class="side-key key-vol-up"></div>
        <div class="side-key key-vol-down"></div>
        <div class="side-key key-power"></div>

        <div class="speaker-earpiece"></div>

        <div class="dynamic-island">
          <div class="camera-lens"></div>
          <div class="sensor-dot"></div>
        </div>

        ${statusBarHtml}

        <div class="screen-surface" id="screen">
          <div class="glass-sheen"></div>
          ${options.status === "running" && options.previewUrl
        ? `<iframe src="${options.previewUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>`
        : standbyHtml}
        </div>

        <div class="nav-gesture-bar"><div class="gesture-pill"></div></div>
      </div>

      <div class="device-metrics-badge">
        ${width} × ${height} px • ${options.profile.dpi}x • ${options.orientation.toUpperCase()}
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function sendMsg(type, value) {
      vscode.postMessage({ type, value });
    }

    let zoomMode = "fit";
    const canvas = document.querySelector(".viewport-canvas");
    const inner = document.getElementById("canvas-inner");

    function applyScale() {
      if (!canvas || !inner) return;
      if (zoomMode === "fit") {
        const padX = 40;
        const padY = 40;
        const availW = Math.max(canvas.clientWidth - padX, 160);
        const availH = Math.max(canvas.clientHeight - padY, 160);
        const devW = ${width} + 36;
        const devH = ${height} + 66 + 50; // chassis + status/nav + metrics badge
        const scale = Math.min(availW / devW, availH / devH, 1.0);
        inner.style.transform = "scale(" + Math.max(scale, 0.25).toFixed(3) + ")";
      } else {
        const s = parseFloat(zoomMode);
        inner.style.transform = "scale(" + s + ")";
      }
    }

    function onZoomChange(val) {
      zoomMode = val;
      applyScale();
    }

    window.addEventListener("resize", applyScale);
    if (window.ResizeObserver) {
      new ResizeObserver(applyScale).observe(canvas);
    }
    setTimeout(applyScale, 20);

    function updateLiveClock() {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      const timeStr = h + ":" + m;

      const clockEl = document.getElementById("clock");
      if (clockEl) clockEl.textContent = timeStr;

      const lockClockEl = document.getElementById("lock-time");
      if (lockClockEl) lockClockEl.textContent = timeStr;

      const lockDateEl = document.getElementById("lock-date");
      if (lockDateEl) {
        const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
        const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        lockDateEl.textContent = days[d.getDay()] + " " + d.getDate() + " " + months[d.getMonth()];
      }
    }
    updateLiveClock();
    setInterval(updateLiveClock, 10000);
  </script>
</body>
</html>`;
}
//# sourceMappingURL=get-device-html.js.map