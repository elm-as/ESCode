import { DeviceHtmlOptions } from "./get-device-html";

export function renderToolbar(options: DeviceHtmlOptions): string {
  const isRunning = options.status === "running";

  return `
  <div class="toolbar">
    <div class="toolbar-left">
      <div class="mode-segmented">
        <button class="mode-tab ${options.mode === "fast" ? "active-fast" : ""}" 
                title="Fast Mode: Lightweight zero-overhead Web & Desktop target" 
                onclick="sendMsg('setMode', 'fast')">
          ⚡ FAST
        </button>
        <button class="mode-tab ${options.mode === "native" ? "active-native" : ""}" 
                title="Native Mode: Real Android SDK & ADB execution" 
                onclick="sendMsg('setMode', 'native')">
          🤖 NATIVE
        </button>
      </div>

      <select class="control-select" onchange="sendMsg('setProfile', this.value)">
        <option value="flagship-390" ${options.profile.id === "flagship-390" ? "selected" : ""}>Flagship (390×844)</option>
        <option value="pixel-412" ${options.profile.id === "pixel-412" ? "selected" : ""}>Pixel 8 (412×915)</option>
        <option value="pro-max-432" ${options.profile.id === "pro-max-432" ? "selected" : ""}>Pro Max (432×960)</option>
        <option value="standard-375" ${options.profile.id === "standard-375" ? "selected" : ""}>iPhone SE (375×812)</option>
        <option value="compact-360" ${options.profile.id === "compact-360" ? "selected" : ""}>Compact (360×800)</option>
      </select>

      <select class="control-select" id="zoom-select" onchange="onZoomChange(this.value)">
        <option value="fit" selected>Fit (Auto)</option>
        <option value="0.5">50%</option>
        <option value="0.75">75%</option>
        <option value="0.85">85%</option>
        <option value="1.0">100%</option>
      </select>
    </div>

    <div class="toolbar-right">
      <button class="tool-btn" title="Rotate portrait/landscape" onclick="sendMsg('toggleOrientation')">↻</button>
      <button class="tool-btn" title="Hard reload" onclick="sendMsg('reload')">⟳</button>
      
      ${
        isRunning
          ? `<button class="tool-btn btn-stop" onclick="sendMsg('stopProject')">■ Stop</button>`
          : `<button class="tool-btn btn-run" onclick="sendMsg('runProject')">▶ Run</button>`
      }
    </div>
  </div>
  `;
}

export function renderStandbyScreen(status: string, errorMessage?: string): string {
  if (status === "starting") {
    return `
    <div class="standby-lockscreen">
      <div></div>
      <div class="lock-card">
        <h3>🚀 Démarrage du serveur...</h3>
        <p>Attribution du port dynamique et compilation de l'interface mobile.</p>
        <div style="font-size: 20px; animation: spin 1s linear infinite;">⏳</div>
      </div>
      <div></div>
    </div>`;
  }

  if (status === "error") {
    return `
    <div class="standby-lockscreen">
      <div></div>
      <div class="lock-card" style="border-color: rgba(239, 68, 68, 0.4);">
        <h3 style="color: #ef4444;">Erreur d'exécution</h3>
        <p>${errorMessage || "Échec du démarrage de l'environnement."}</p>
        <button class="btn-launch-preview" onclick="sendMsg('runProject')">Réessayer</button>
      </div>
      <div></div>
    </div>`;
  }

  return `
  <div class="standby-lockscreen">
    <div>
      <div class="lock-time" id="lock-time">09:41</div>
      <div class="lock-date" id="lock-date">Vendredi 6 Novembre</div>
    </div>

    <div class="lock-card">
      <h3>Elmas Core Mobile</h3>
      <p>Prêt pour le rendu temps réel React, Flutter, Kotlin ou HTML/JS.</p>
      <button class="btn-launch-preview" onclick="sendMsg('runProject')">▶ Lancer la Preview</button>
    </div>

    <div class="lock-quick-actions">
      <div class="quick-circle" title="Lampe torche">🔦</div>
      <div class="quick-circle" title="Appareil photo">📷</div>
    </div>
  </div>
  `;
}

export function renderStatusBar(): string {
  return `
  <div class="status-bar">
    <span id="clock">09:41</span>
    <div class="status-icons">
      <div class="signal-bars">
        <div class="sig-bar" style="height: 3px;"></div>
        <div class="sig-bar" style="height: 5px;"></div>
        <div class="sig-bar" style="height: 8px;"></div>
        <div class="sig-bar" style="height: 11px;"></div>
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
  `;
}
