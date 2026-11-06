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

  <div class="viewport-canvas" id="viewport-canvas">
    ${zoomHtml}

    <div class="canvas-sizer" id="canvas-sizer">
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
    const devW = ${width};
    const devH = ${height};
    const canvas = document.getElementById("viewport-canvas");
    const sizer = document.getElementById("canvas-sizer");
    const chassis = document.getElementById("chassis");

    function applyScale() {
      if (!canvas || !sizer || !chassis) return;
      if (isFitMode) {
        const padX = 64;
        const padY = 24;
        const availW = Math.max(canvas.clientWidth - padX, 160);
        const availH = Math.max(canvas.clientHeight - padY, 160);
        const scale = Math.min(availW / devW, availH / devH, 1.0);
        currentScale = Math.max(scale, 0.25);
      }
      const scaledW = Math.round(devW * currentScale);
      const scaledH = Math.round(devH * currentScale);
      sizer.style.width = scaledW + "px";
      sizer.style.height = scaledH + "px";
      chassis.style.transform = "scale(" + currentScale.toFixed(4) + ")";
    }

    function adjustZoom(delta) {
      isFitMode = false;
      currentScale = Math.min(Math.max(currentScale + delta, 0.25), 1.5);
      applyScale();
    }

    function resetZoomFit() {
      isFitMode = true;
      applyScale();
    }

    window.addEventListener("resize", applyScale);
    if (window.ResizeObserver && canvas) {
      new ResizeObserver(applyScale).observe(canvas);
    }
    requestAnimationFrame(applyScale);
    setTimeout(applyScale, 50);

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