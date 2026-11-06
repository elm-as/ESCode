import { DeviceHtmlOptions } from "./get-device-html";
import { STANDARD_PROFILES } from "./device-profiles";

export function renderTopBar(options: DeviceHtmlOptions): string {
  const isRunning = options.status === "running";
  const displayUrl = options.previewUrl ? options.previewUrl.replace("http://localhost:", ":") : "/";

  return `
  <div class="top-bar">
    <div class="nav-group">
      <button class="icon-btn" title="Back" onclick="sendMsg('back')">←</button>
      <button class="icon-btn" title="Forward" onclick="sendMsg('forward')">→</button>
      <button class="icon-btn" title="Reload preview" onclick="sendMsg('reload')">↻</button>
      
      <div class="address-pill">
        <span>🌐</span>
        <span class="path-text">${displayUrl}</span>
      </div>
    </div>

    <div class="nav-group">
      ${
        isRunning
          ? `<button class="btn-action-stop" onclick="sendMsg('stopProject')">■ Stop</button>`
          : `<button class="btn-action-primary" onclick="sendMsg('runProject')">▶ Run</button>`
      }
      <button class="btn-logs" title="Open Mobile Output Logs" onclick="sendMsg('openLogs')">
        📋 Logs
      </button>
      <button class="icon-btn" title="SDK & Toolchain Manager" onclick="sendMsg('openSdkManager')">⚙️</button>
    </div>
  </div>
  `;
}

export function renderFloatingZoom(): string {
  return `
  <div class="floating-zoom-pill">
    <button class="zoom-btn" title="Zoom In" onclick="adjustZoom(0.1)">🔍+</button>
    <button class="zoom-btn" title="Fit to View" onclick="resetZoomFit()">Fit</button>
    <button class="zoom-btn" title="Zoom Out" onclick="adjustZoom(-0.1)">🔍−</button>
  </div>
  `;
}

export function renderBottomBar(options: DeviceHtmlOptions): string {
  return `
  <div class="bottom-bar">
    <div class="bottom-left">
      <button class="icon-btn" title="Rotate device" onclick="sendMsg('toggleOrientation')">🔄</button>
      <button class="icon-btn" title="Screenshot capture" onclick="sendMsg('screenshot')">📸</button>
    </div>

    <div class="bottom-center">
      <select class="device-picker-pill" onchange="sendMsg('setProfile', this.value)">
        ${STANDARD_PROFILES.filter((p, i, a) => a.findIndex((t) => t.name === p.name) === i)
          .map(
            (p) =>
              `<option value="${p.id}" ${options.profile.name === p.name ? "selected" : ""}>
                📱 ${p.name}
              </option>`
          )
          .join("")}
      </select>
    </div>

    <div class="bottom-right">
      <span class="bottom-link">
        ${options.mode === "fast" ? "⚡ Fast Mode" : "🤖 Native Mode"}
      </span>
      <span style="color: #3f3f46;">•</span>
      <span class="bottom-link">Elmas Studio</span>
    </div>
  </div>
  `;
}

export function renderPhoneBezel(options: DeviceHtmlOptions): string {
  const isRunning = options.status === "running" && options.previewUrl;

  return `
  <div class="device-chassis" id="chassis">
    <div class="speaker-earpiece"></div>
    <div class="dynamic-island"></div>

    <div class="status-bar">
      <span id="clock">15:48</span>
      <div class="status-icons">
        <div class="cellular-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot" style="opacity: 0.4;"></div>
        </div>
        <span>5G</span>
        <div class="battery-icon">
          <div class="battery-charge"></div>
        </div>
      </div>
    </div>

    <div class="screen-surface" id="screen">
      ${
        isRunning
          ? `<iframe id="preview-frame" src="${options.previewUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>`
          : `<div class="phone-standby">
              <div class="standby-msg">
                ${
                  options.status === "starting"
                    ? "Démarrage de l'application..."
                    : options.status === "error"
                    ? options.errorMessage || "Erreur de lancement"
                    : "This app is ready to run via Elmas Studio"
                }
              </div>
            </div>`
      }
    </div>

    <div class="home-indicator"></div>
  </div>
  `;
}
