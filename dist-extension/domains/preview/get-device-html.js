"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDeviceHtml = generateDeviceHtml;
const device_profiles_1 = require("./device-profiles");
const device_frame_styles_1 = require("./device-frame-styles");
const device_ui_templates_1 = require("./device-ui-templates");
function generateDeviceHtml(options) {
    const { width, height } = (0, device_profiles_1.calculateDeviceDimensions)(options.profile, options.orientation);
    const styles = (0, device_frame_styles_1.getDeviceFrameStyles)(width, height);
    const topBarHtml = (0, device_ui_templates_1.renderTopBar)(options);
    const zoomHtml = (0, device_ui_templates_1.renderFloatingZoom)();
    const phoneHtml = (0, device_ui_templates_1.renderPhoneBezel)(options);
    const bottomBarHtml = (0, device_ui_templates_1.renderBottomBar)(options);
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Elmas Studio</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  ${topBarHtml}

  <div class="viewport-canvas">
    ${zoomHtml}

    <div class="canvas-inner" id="canvas-inner">
      ${phoneHtml}
    </div>
  </div>

  ${bottomBarHtml}

  <script>
    const vscode = acquireVsCodeApi();
    function sendMsg(type, value) {
      if (type === 'back') {
        const frame = document.getElementById('preview-frame');
        if (frame && frame.contentWindow) { frame.contentWindow.history.back(); return; }
      }
      if (type === 'forward') {
        const frame = document.getElementById('preview-frame');
        if (frame && frame.contentWindow) { frame.contentWindow.history.forward(); return; }
      }
      vscode.postMessage({ type, value });
    }

    let currentScale = 1.0;
    let isFitMode = true;
    const canvas = document.querySelector(".viewport-canvas");
    const inner = document.getElementById("canvas-inner");

    function applyScale() {
      if (!canvas || !inner) return;
      if (isFitMode) {
        const padX = 48;
        const padY = 48;
        const availW = Math.max(canvas.clientWidth - padX, 200);
        const availH = Math.max(canvas.clientHeight - padY, 200);
        const devW = ${width} + 16;
        const devH = ${height} + 16;
        const scale = Math.min(availW / devW, availH / devH, 1.0);
        currentScale = scale;
        inner.style.transform = "scale(" + Math.max(scale, 0.25).toFixed(3) + ")";
      } else {
        inner.style.transform = "scale(" + currentScale.toFixed(3) + ")";
      }
    }

    function adjustZoom(delta) {
      isFitMode = false;
      currentScale = Math.min(Math.max(currentScale + delta, 0.3), 2.0);
      applyScale();
    }

    function resetZoomFit() {
      isFitMode = true;
      applyScale();
    }

    window.addEventListener("resize", () => {
      if (isFitMode) applyScale();
    });
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (isFitMode) applyScale();
      }).observe(canvas);
    }
    setTimeout(applyScale, 25);

    function updateLiveClock() {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      const clockEl = document.getElementById("clock");
      if (clockEl) clockEl.textContent = h + ":" + m;
    }
    updateLiveClock();
    setInterval(updateLiveClock, 10000);
  </script>
</body>
</html>`;
}
//# sourceMappingURL=get-device-html.js.map