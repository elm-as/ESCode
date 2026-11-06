"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDeviceHtml = generateDeviceHtml;
const device_profiles_1 = require("./device-profiles");
function generateDeviceHtml(options) {
    const { width, height } = (0, device_profiles_1.calculateDeviceDimensions)(options.profile, options.orientation);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      background-color: #121214;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .toolbar {
      background: #18181b;
      border-bottom: 1px solid #27272a;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn-group {
      display: flex;
      background: #27272a;
      padding: 2px;
      border-radius: 4px;
    }

    .btn-toggle {
      border: none;
      background: transparent;
      color: #a1a1aa;
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-weight: 600;
      font-size: 10px;
    }

    .btn-toggle.active-fast {
      background: #38bdf8;
      color: #09090b;
    }

    .btn-toggle.active-native {
      background: #f59e0b;
      color: #09090b;
    }

    .btn-action {
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
      border-radius: 4px;
      padding: 3px 8px;
      cursor: pointer;
      font-size: 11px;
    }
    .btn-action:hover { background: #3f3f46; }

    .select-profile {
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 11px;
      outline: none;
    }

    .viewport-canvas {
      flex: 1;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: #09090b;
    }

    .device-bezel {
      width: ${width}px;
      height: ${height}px;
      transform: scale(${options.zoom});
      transform-origin: center center;
      background: #000000;
      border: 10px solid #27272a;
      border-radius: 38px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
      transition: width 0.2s, height 0.2s;
    }

    .dynamic-island {
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 90px;
      height: 18px;
      background: #000000;
      border-radius: 12px;
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .speaker-slit {
      width: 40px;
      height: 3px;
      background: #27272a;
      border-radius: 2px;
    }

    .status-bar {
      height: 28px;
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      font-size: 11px;
      font-weight: 600;
      color: #ffffff;
      z-index: 30;
      flex-shrink: 0;
    }

    .screen-surface {
      flex: 1;
      background: #18181b;
      position: relative;
      overflow: hidden;
    }

    iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #ffffff;
    }

    .nav-gesture-bar {
      height: 18px;
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 30;
      flex-shrink: 0;
    }

    .gesture-pill {
      width: 100px;
      height: 4px;
      background: #71717a;
      border-radius: 2px;
    }

    .touch-reticle {
      position: absolute;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 1px solid rgba(56, 189, 248, 0.8);
      background: rgba(56, 189, 248, 0.2);
      pointer-events: none;
      z-index: 50;
      transform: translate(-50%, -50%);
      display: none;
    }

    .standby-overlay {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 20px;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="btn-group">
      <button class="btn-toggle ${options.mode === "fast" ? "active-fast" : ""}" onclick="sendMsg('setMode', 'fast')">FAST</button>
      <button class="btn-toggle ${options.mode === "native" ? "active-native" : ""}" onclick="sendMsg('setMode', 'native')">NATIVE</button>
    </div>

    <select class="select-profile" onchange="sendMsg('setProfile', this.value)">
      <option value="compact-360" ${options.profile.id === "compact-360" ? "selected" : ""}>Compact (360×800)</option>
      <option value="standard-375" ${options.profile.id === "standard-375" ? "selected" : ""}>iPhone SE (375×812)</option>
      <option value="flagship-390" ${options.profile.id === "flagship-390" ? "selected" : ""}>Flagship (390×844)</option>
      <option value="pixel-412" ${options.profile.id === "pixel-412" ? "selected" : ""}>Pixel 8 (412×915)</option>
      <option value="pro-max-432" ${options.profile.id === "pro-max-432" ? "selected" : ""}>Pro Max (432×960)</option>
    </select>

    <div style="display: flex; gap: 4px;">
      <button class="btn-action" title="Rotate" onclick="sendMsg('toggleOrientation')">↻</button>
      <button class="btn-action" title="Reload" onclick="sendMsg('reload')">⟳</button>
      <button class="btn-action" title="Run" onclick="sendMsg('runProject')" style="color: #38bdf8; font-weight: 600;">▶ Run</button>
      <button class="btn-action" title="Stop" onclick="sendMsg('stopProject')" style="color: #ef4444;">■ Stop</button>
    </div>
  </div>

  <div class="viewport-canvas">
    <div class="device-bezel" id="bezel">
      <div class="dynamic-island"><div class="speaker-slit"></div></div>
      <div class="status-bar">
        <span id="clock">09:41</span>
        <span>5G • 94%</span>
      </div>
      <div class="screen-surface" id="screen">
        ${options.status === "running" && options.previewUrl
        ? `<iframe src="${options.previewUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>`
        : `<div class="standby-overlay">
                <div style="font-size: 13px; font-weight: 600; color: #a1a1aa; margin-bottom: 6px;">
                  ${options.status === "starting" ? "Starting Preview Server..." : "Mobile Preview Ready"}
                </div>
                <div style="font-size: 11px;">
                  ${options.status === "error" ? options.errorMessage || "Preview launch error" : "Click ▶ Run to start live preview."}
                </div>
              </div>`}
        <div class="touch-reticle" id="reticle"></div>
      </div>
      <div class="nav-gesture-bar"><div class="gesture-pill"></div></div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function sendMsg(type, value) {
      vscode.postMessage({ type, value });
    }

    // Touch reticle emulation
    const screen = document.getElementById("screen");
    const reticle = document.getElementById("reticle");
    if (screen && reticle) {
      screen.addEventListener("mousemove", (e) => {
        const rect = screen.getBoundingClientRect();
        reticle.style.display = "block";
        reticle.style.left = (e.clientX - rect.left) + "px";
        reticle.style.top = (e.clientY - rect.top) + "px";
      });
      screen.addEventListener("mouseleave", () => {
        reticle.style.display = "none";
      });
    }

    // Live clock update
    function updateClock() {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      const el = document.getElementById("clock");
      if (el) el.innerText = h + ":" + m;
    }
    updateClock();
    setInterval(updateClock, 30000);
  </script>
</body>
</html>`;
}
//# sourceMappingURL=get-device-html.js.map