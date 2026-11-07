import { DeviceProfile, DeviceOrientation, PreviewMode, calculateDeviceDimensions } from "./device-profiles";
import { getDeviceFrameStyles } from "./device-frame-styles";
import {
  renderTopBar,
  renderFloatingZoom,
  renderPhoneBezel,
  renderBottomBar,
} from "./device-ui-templates";

export interface DeviceHtmlOptions {
  profile: DeviceProfile;
  orientation: DeviceOrientation;
  mode: PreviewMode;
  previewUrl: string | null;
  status: "idle" | "starting" | "running" | "error";
  errorMessage?: string;
  zoom: number;
}

export function generateDeviceHtml(options: DeviceHtmlOptions): string {
  const { width, height } = calculateDeviceDimensions(options.profile, options.orientation);
  const styles = getDeviceFrameStyles(width, height);
  const topBarHtml = renderTopBar(options);
  const zoomHtml = renderFloatingZoom();
  const phoneHtml = renderPhoneBezel(options);
  const bottomBarHtml = renderBottomBar(options);

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

    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === "reloadFrame") {
        const frame = document.getElementById("preview-frame");
        if (frame && frame.src) {
          const base = frame.src.split("?")[0];
          frame.src = base + "?t=" + Date.now();
        }
      }
    });

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
