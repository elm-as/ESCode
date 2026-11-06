import { DeviceProfile, DeviceOrientation, PreviewMode, calculateDeviceDimensions } from "./device-profiles";

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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      background-color: #0d0d10;
      color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* High-Density Toolbar */
    .toolbar {
      background: #141417;
      border-bottom: 1px solid #27272a;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      gap: 8px;
      flex-shrink: 0;
      z-index: 50;
    }

    .btn-group {
      display: inline-flex;
      background: #202024;
      padding: 2px;
      border-radius: 4px;
      border: 1px solid #2e2e33;
    }

    .btn-toggle {
      border: none;
      background: transparent;
      color: #8e8e93;
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 0.5px;
    }

    .btn-toggle.active-fast {
      background: #0284c7;
      color: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    .btn-toggle.active-native {
      background: #d97706;
      color: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    .select-control {
      background: #202024;
      color: #e4e4e7;
      border: 1px solid #2e2e33;
      border-radius: 4px;
      padding: 3px 6px;
      font-size: 11px;
      outline: none;
      font-variant-numeric: tabular-nums;
    }
    .select-control:focus { border-color: #0284c7; }

    .btn-action {
      background: #202024;
      color: #e4e4e7;
      border: 1px solid #2e2e33;
      border-radius: 4px;
      padding: 3px 8px;
      cursor: pointer;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .btn-action:hover { background: #2e2e33; }

    /* Canvas with Responsive Auto-Fit Scaling */
    .viewport-canvas {
      flex: 1;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: #09090b;
      min-height: 0;
      min-width: 0;
      position: relative;
    }

    .canvas-inner {
      margin: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
      transition: transform 0.15s ease-out;
    }

    /* Realistic Mobile Phone Chassis */
    .device-chassis {
      position: relative;
      width: ${width}px;
      height: ${height + 66}px;
      background: #000000;
      border: 12px solid #1c1c1f;
      border-radius: 50px;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.12),
        0 0 0 4px #09090b,
        0 25px 60px -10px rgba(0, 0, 0, 0.95),
        0 10px 25px -5px rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow: hidden;
    }

    /* Side Hardware Buttons */
    .side-btn {
      position: absolute;
      background: #2e2e33;
      border: 1px solid #3f3f46;
      pointer-events: none;
      z-index: 10;
    }
    .btn-action-key { left: -16px; top: 95px; width: 4px; height: 26px; border-radius: 2px 0 0 2px; }
    .btn-vol-up { left: -16px; top: 135px; width: 4px; height: 48px; border-radius: 2px 0 0 2px; }
    .btn-vol-down { left: -16px; top: 195px; width: 4px; height: 48px; border-radius: 2px 0 0 2px; }
    .btn-power { right: -16px; top: 150px; width: 4px; height: 70px; border-radius: 0 2px 2px 0; }

    /* Top Speaker */
    .speaker-slit {
      position: absolute;
      top: 6px;
      left: 50%;
      transform: translateX(-50%);
      width: 44px;
      height: 3px;
      background: #27272a;
      border-radius: 2px;
      z-index: 45;
    }

    /* Dynamic Island */
    .dynamic-island {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 105px;
      height: 26px;
      background: #000000;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px;
      pointer-events: none;
    }

    .camera-lens {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #2a225e, #050512 80%);
      box-shadow: inset 0 0 2px rgba(255, 255, 255, 0.2);
    }
    .sensor-dot { width: 5px; height: 5px; border-radius: 50%; background: #0c0c0e; }

    /* Status Bar */
    .status-bar {
      height: 42px;
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 22px;
      font-size: 12px;
      font-weight: 600;
      color: #ffffff;
      z-index: 30;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
    }

    .status-icons { display: flex; align-items: center; gap: 6px; }

    .signal-bars { display: flex; align-items: flex-end; gap: 1.5px; height: 10px; }
    .sig-bar { width: 2.5px; background: #ffffff; border-radius: 1px; }

    .battery-pill { display: flex; align-items: center; gap: 4px; }
    .battery-shell {
      width: 20px;
      height: 10px;
      border: 1.2px solid #ffffff;
      border-radius: 3px;
      padding: 1px;
      position: relative;
    }
    .battery-terminal {
      width: 1.5px;
      height: 4px;
      background: #ffffff;
      border-radius: 0 1px 1px 0;
      position: absolute;
      right: -2.5px;
      top: 2px;
    }
    .battery-fill { height: 100%; width: 85%; background: #22c55e; border-radius: 1px; }

    /* Screen & Iframe */
    .screen-surface {
      flex: 1;
      background: #ffffff;
      position: relative;
      overflow: hidden;
    }

    iframe { width: 100%; height: 100%; border: none; background: #ffffff; }

    /* Bottom Navigation Bar */
    .nav-gesture-bar {
      height: 24px;
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 30;
      flex-shrink: 0;
    }

    .gesture-pill {
      width: 120px;
      height: 4.5px;
      background: #ffffff;
      border-radius: 10px;
      opacity: 0.85;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }

    /* Standby overlay */
    .standby-overlay {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
      background: #121214;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div style="display: flex; align-items: center; gap: 8px;">
      <div class="btn-group">
        <button class="btn-toggle ${options.mode === "fast" ? "active-fast" : ""}" onclick="sendMsg('setMode', 'fast')">FAST</button>
        <button class="btn-toggle ${options.mode === "native" ? "active-native" : ""}" onclick="sendMsg('setMode', 'native')">NATIVE</button>
      </div>

      <select class="select-control" onchange="sendMsg('setProfile', this.value)">
        <option value="compact-360" ${options.profile.id === "compact-360" ? "selected" : ""}>Compact (360×800)</option>
        <option value="standard-375" ${options.profile.id === "standard-375" ? "selected" : ""}>iPhone SE (375×812)</option>
        <option value="flagship-390" ${options.profile.id === "flagship-390" ? "selected" : ""}>Flagship (390×844)</option>
        <option value="pixel-412" ${options.profile.id === "pixel-412" ? "selected" : ""}>Pixel 8 (412×915)</option>
        <option value="pro-max-432" ${options.profile.id === "pro-max-432" ? "selected" : ""}>Pro Max (432×960)</option>
      </select>

      <select class="select-control" id="zoom-select" onchange="onZoomChange(this.value)">
        <option value="fit" selected>Fit to View (Auto)</option>
        <option value="0.5">50%</option>
        <option value="0.75">75%</option>
        <option value="0.85">85%</option>
        <option value="1.0">100%</option>
      </select>
    </div>

    <div style="display: flex; align-items: center; gap: 6px;">
      <button class="btn-action" title="Rotate device" onclick="sendMsg('toggleOrientation')">↻ Rotate</button>
      <button class="btn-action" title="Reload preview" onclick="sendMsg('reload')">⟳ Reload</button>
      <button class="btn-action" onclick="sendMsg('runProject')" style="color: #38bdf8; font-weight: 600;">▶ Run</button>
      <button class="btn-action" onclick="sendMsg('stopProject')" style="color: #ef4444;">■ Stop</button>
    </div>
  </div>

  <div class="viewport-canvas">
    <div class="canvas-inner" id="canvas-inner">
      <div class="side-btn btn-action-key"></div>
      <div class="side-btn btn-vol-up"></div>
      <div class="side-btn btn-vol-down"></div>
      <div class="side-btn btn-power"></div>

      <div class="device-chassis" id="chassis">
        <div class="speaker-slit"></div>
        <div class="dynamic-island">
          <div class="camera-lens"></div>
          <div class="sensor-dot"></div>
        </div>

        <div class="status-bar">
          <span id="clock">09:41</span>
          <div class="status-icons">
            <div class="signal-bars">
              <div class="sig-bar" style="height: 3px;"></div>
              <div class="sig-bar" style="height: 5px;"></div>
              <div class="sig-bar" style="height: 7px;"></div>
              <div class="sig-bar" style="height: 10px;"></div>
            </div>
            <span>5G</span>
            <div class="battery-pill">
              <div class="battery-shell">
                <div class="battery-fill"></div>
                <div class="battery-terminal"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="screen-surface" id="screen">
          ${
            options.status === "running" && options.previewUrl
              ? `<iframe src="${options.previewUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>`
              : `<div class="standby-overlay">
                  <div style="font-size: 13px; font-weight: 600; color: #d4d4d8; margin-bottom: 6px;">
                    ${options.status === "starting" ? "Starting Dev Server..." : "Mobile Preview Ready"}
                  </div>
                  <div style="font-size: 11px; max-width: 280px; line-height: 1.5;">
                    ${options.status === "error" ? options.errorMessage || "Launch error" : "Click ▶ Run to start real-time UI preview."}
                  </div>
                </div>`
          }
        </div>

        <div class="nav-gesture-bar"><div class="gesture-pill"></div></div>
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
        const padX = 36;
        const padY = 36;
        const availW = Math.max(canvas.clientWidth - padX, 150);
        const availH = Math.max(canvas.clientHeight - padY, 150);
        const devW = ${width} + 32;
        const devH = ${height} + 66 + 32;
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
    setTimeout(applyScale, 30);

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
