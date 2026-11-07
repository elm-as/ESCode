"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeviceFrameStyles = getDeviceFrameStyles;
/**
 * macOS Sequoia / Xcode Simulator-inspired Stylesheet for Elmas Studio Mobile Preview.
 * Uses frosted glass toolbars, Natural Titanium bezel shadows, and zero-overflow sizer layout.
 * Strictly compliant with ELMAS.md: < 350 lines, pure function.
 */
function getDeviceFrameStyles(width, height) {
    return `
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-font-smoothing: antialiased; }
    html, body {
      background-color: var(--vscode-editor-background, #111115);
      color: var(--vscode-foreground, #e4e4e7);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", system-ui, sans-serif;
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* macOS Xcode Frosted Glass Top Toolbar */
    .top-bar {
      height: 38px;
      background: rgba(16, 16, 20, 0.82);
      backdrop-filter: blur(20px) saturate(180%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px;
      gap: 8px;
      flex-shrink: 0;
      z-index: 50;
    }

    .nav-group {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .nav-center {
      flex: 1;
      min-width: 60px;
      max-width: 280px;
      display: flex;
      align-items: center;
    }

    .icon-btn {
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid transparent;
      color: #a1a1aa;
      border-radius: 6px;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.14s ease;
    }
    .icon-btn:hover {
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(255, 255, 255, 0.08);
      color: #fafafa;
    }
    .icon-btn svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.65;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* macOS Safari-Style Capsule Address Bar */
    .address-pill {
      width: 100%;
      height: 25px;
      background: rgba(0, 0, 0, 0.28);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35);
      border-radius: 7px;
      padding: 0 10px;
      font-size: 11px;
      color: #71717a;
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      white-space: nowrap;
    }
    .address-pill .path-text,
    .address-pill .path-input {
      width: 100%;
      background: transparent;
      border: none;
      outline: none;
      color: #d4d4d8;
      font-family: "SF Mono", "JetBrains Mono", "Cascadia Code", ui-monospace, monospace;
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: text;
    }

    /* macOS Segmented Pill Buttons */
    .pill-btn {
      height: 25px;
      padding: 0 9px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      flex-shrink: 0;
      border: 1px solid rgba(255, 255, 255, 0.09);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.03) 100%);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.07);
      color: #e4e4e7;
      transition: all 0.14s ease;
    }
    .pill-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.15);
    }
    .pill-btn svg {
      width: 12px;
      height: 12px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.8;
    }
    .pill-btn.run-active {
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.38);
      background: linear-gradient(180deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.09) 100%);
      box-shadow: 0 1px 4px rgba(245, 158, 11, 0.15), inset 0 1px 0 rgba(251, 191, 36, 0.2);
    }
    .pill-btn.run-idle {
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.35);
    }

    /* Viewport Canvas — Studio Spotlight & Zero Scrollbar */
    .viewport-canvas {
      flex: 1;
      width: 100%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(circle at 50% 46%, rgba(255, 255, 255, 0.035) 0%, rgba(0, 0, 0, 0) 68%),
        var(--vscode-editor-background, #111115);
      position: relative;
      min-height: 0;
      min-width: 0;
    }

    /* Left Floating Frosted Glass Zoom Pill */
    .floating-zoom-pill {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      background: rgba(24, 24, 30, 0.78);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 4px 3px;
      gap: 2px;
      z-index: 45;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .zoom-btn {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: #a1a1aa;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 12px;
      transition: all 0.12s ease;
    }
    .zoom-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
    .zoom-btn svg {
      width: 13px;
      height: 13px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.6;
    }

    .canvas-sizer {
      position: relative;
      flex-shrink: 0;
    }

    /* iPhone 15 Pro Natural Titanium Multi-Layer Bezel */
    .device-chassis {
      position: absolute;
      top: 0;
      left: 0;
      width: ${width}px;
      height: ${height}px;
      transform-origin: top left;
      background: #ffffff;
      border: 7px solid #141417;
      border-radius: 54px;
      box-shadow:
        0 0 0 1px #52525b,
        0 0 0 3px #27272a,
        0 28px 65px rgba(0, 0, 0, 0.72);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .dynamic-island {
      position: absolute;
      top: 11px;
      left: 50%;
      transform: translateX(-50%);
      width: 116px;
      height: 31px;
      background: #000000;
      border-radius: 20px;
      z-index: 40;
      pointer-events: none;
    }

    .status-bar {
      height: 48px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
      z-index: 30;
      flex-shrink: 0;
      font-size: 14px;
      font-weight: 700;
      color: #09090b;
      letter-spacing: -0.3px;
      font-variant-numeric: tabular-nums;
    }

    .status-icons {
      display: flex;
      align-items: center;
      gap: 5px;
      color: #09090b;
    }
    .status-icons svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .screen-surface {
      flex: 1;
      width: 100%;
      background: #ffffff;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #ffffff;
      flex: 1;
    }

    .home-bar-row {
      height: 22px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      z-index: 30;
    }
    .home-indicator {
      width: 132px;
      height: 4.5px;
      background: #09090b;
      border-radius: 10px;
      opacity: 0.85;
    }

    /* Bottom Frosted Bar */
    .bottom-bar {
      height: 32px;
      background: rgba(16, 16, 20, 0.82);
      backdrop-filter: blur(16px);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      font-size: 11px;
      flex-shrink: 0;
      z-index: 50;
    }

    .device-picker-pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.09);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      border-radius: 999px;
      padding: 2px 12px;
      font-size: 11px;
      font-weight: 500;
      color: #e4e4e7;
      cursor: pointer;
      outline: none;
      height: 22px;
    }

    .phone-standby {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px;
      text-align: center;
      color: #27272a;
      font-size: 14px;
    }
  `;
}
//# sourceMappingURL=device-frame-styles.js.map