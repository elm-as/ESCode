"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTopBar = renderTopBar;
exports.renderFloatingZoom = renderFloatingZoom;
exports.renderBottomBar = renderBottomBar;
exports.renderPhoneBezel = renderPhoneBezel;
const device_profiles_1 = require("./device-profiles");
function renderTopBar(options) {
    const isRunning = options.status === "running";
    const displayUrl = options.previewUrl ? options.previewUrl.replace("http://localhost:", ":") : "/";
    return `
  <div class="top-bar">
    <div class="nav-group">
      <button class="icon-btn" title="Back" onclick="sendMsg('back')">
        <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <button class="icon-btn" title="Forward" onclick="sendMsg('forward')">
        <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
      <button class="icon-btn" title="Reload preview" onclick="sendMsg('reload')">
        <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
      </button>
    </div>

    <div class="nav-center">
      <div class="address-pill">
        <span class="path-text">${displayUrl}</span>
      </div>
    </div>

    <div class="nav-group">
      ${isRunning
        ? `<button class="pill-btn run-active" title="Stop Preview Server" onclick="sendMsg('stopProject')">
               <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none"/></svg>
               <span>Live</span>
             </button>`
        : `<button class="pill-btn" title="Start Preview Server" onclick="sendMsg('runProject')">
               <svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg>
               <span>Run</span>
             </button>`}
      <button class="pill-btn" title="Open Output Logs" onclick="sendMsg('openLogs')">
        <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
        <span>Logs</span>
      </button>
      <button class="icon-btn" title="SDK & Toolchain Manager" onclick="sendMsg('openSdkManager')">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </div>
  </div>
  `;
}
function renderFloatingZoom() {
    return `
  <div class="floating-zoom-pill">
    <button class="zoom-btn" title="Zoom In" onclick="adjustZoom(0.08)">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>
    </button>
    <button class="zoom-btn" title="Fit to View" onclick="resetZoomFit()">Fit</button>
    <button class="zoom-btn" title="Zoom Out" onclick="adjustZoom(-0.08)">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></svg>
    </button>
  </div>
  `;
}
function renderBottomBar(options) {
    const uniqueProfiles = device_profiles_1.STANDARD_PROFILES.filter((p, i, a) => a.findIndex((t) => t.name === p.name) === i);
    return `
  <div class="bottom-bar">
    <div class="nav-group">
      <button class="icon-btn" title="Rotate Portrait / Landscape" onclick="sendMsg('toggleOrientation')">
        <svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
      </button>
    </div>

    <div>
      <select class="device-picker-pill" onchange="sendMsg('setProfile', this.value)">
        ${uniqueProfiles
        .map((p) => `<option value="${p.id}" ${options.profile.name === p.name ? "selected" : ""}>
                ${p.name}
              </option>`)
        .join("")}
      </select>
    </div>

    <div class="nav-group" style="color: var(--vscode-descriptionForeground, #858585); font-size: 10px;">
      <span>1.0.0: Elmas Studio</span>
    </div>
  </div>
  `;
}
function renderPhoneBezel(options) {
    const isRunning = options.status === "running" && options.previewUrl;
    return `
  <div class="device-chassis" id="chassis">
    <div class="dynamic-island"></div>

    <div class="status-bar">
      <span id="clock">15:48</span>
      <div class="status-icons">
        <svg viewBox="0 0 16 12" style="width:14px;height:10px;">
          <rect x="1" y="8" width="2.2" height="3.5" rx="0.6"/>
          <rect x="4.5" y="6" width="2.2" height="5.5" rx="0.6"/>
          <rect x="8" y="3.5" width="2.2" height="8" rx="0.6"/>
          <rect x="11.5" y="1" width="2.2" height="10.5" rx="0.6" opacity="0.35"/>
        </svg>
        <svg viewBox="0 0 16 12" style="width:13px;height:10px;">
          <path d="M8 9.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm-3.6-1.8a5.2 5.2 0 0 1 7.2 0l1.1-1.1a6.8 6.8 0 0 0-9.4 0l1.1 1.1zm-2.5-2.5a8.8 8.8 0 0 1 12.2 0l1.1-1.1a10.4 10.4 0 0 0-14.4 0l1.1 1.1z"/>
        </svg>
        <svg viewBox="0 0 24 12" style="width:20px;height:10px;">
          <rect x="1" y="1" width="19" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <rect x="3" y="3" width="14" height="6" rx="1"/>
          <path d="M21.5 4v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </div>

    <div class="screen-surface" id="screen">
      ${isRunning
        ? `<iframe id="preview-frame" src="${options.previewUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>`
        : `<div class="phone-standby">
              <div>
                ${options.status === "starting"
            ? "Starting mobile preview..."
            : options.status === "error"
                ? options.errorMessage || "Launch error"
                : "This app is emulated over VSCode via Elmas Studio"}
              </div>
            </div>`}
    </div>

    <div class="home-bar-row">
      <div class="home-indicator"></div>
    </div>
  </div>
  `;
}
//# sourceMappingURL=device-ui-templates.js.map