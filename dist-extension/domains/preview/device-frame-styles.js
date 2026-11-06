"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeviceFrameStyles = getDeviceFrameStyles;
/**
 * Native VS Code Theme-Integrated Stylesheet for Elmas Studio Mobile Preview.
 * Uses VS Code CSS variables, zero-overflow sizer layout, and monochrome SVG icons.
 * Strictly compliant with ELMAS.md: < 350 lines, pure function.
 */
function getDeviceFrameStyles(width, height) {
    return `
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    html, body {
      background-color: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-foreground, #cccccc);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Compact Native IDE Top Bar */
    .top-bar {
      height: 36px;
      background: var(--vscode-editor-background, #1e1e1e);
      border-bottom: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.07));
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
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: var(--vscode-icon-foreground, #9da5b4);
      border-radius: 4px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.12s, color 0.12s;
    }
    .icon-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.08));
      color: var(--vscode-foreground, #ffffff);
    }
    .icon-btn svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* URL / Route Address Pill */
    .address-pill {
      width: 100%;
      height: 24px;
      background: var(--vscode-input-background, #2a2a2d);
      border: 1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.06));
      border-radius: 12px;
      padding: 0 10px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #858585);
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      white-space: nowrap;
    }
    .address-pill .path-text {
      color: var(--vscode-input-foreground, #cccccc);
      font-family: var(--vscode-editor-font-family, ui-monospace, monospace);
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Compact Toolbar Pill Buttons */
    .pill-btn {
      height: 24px;
      padding: 0 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      flex-shrink: 0;
      border: 1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.08));
      background: var(--vscode-input-background, #2a2a2d);
      color: var(--vscode-foreground, #cccccc);
      transition: background 0.12s;
    }
    .pill-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.1));
    }
    .pill-btn svg {
      width: 12px;
      height: 12px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.8;
    }
    .pill-btn.run-active {
      color: #4ade80;
      border-color: rgba(74, 222, 128, 0.25);
    }

    /* Viewport Canvas — Zero Scrollbar, True Centering */
    .viewport-canvas {
      flex: 1;
      width: 100%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--vscode-editor-background, #1e1e1e);
      position: relative;
      min-height: 0;
      min-width: 0;
    }

    /* Left Floating Zoom Pill (Monochrome SVG) */
    .floating-zoom-pill {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      background: var(--vscode-input-background, #252528);
      border: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.08));
      border-radius: 16px;
      padding: 4px 3px;
      gap: 2px;
      z-index: 45;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    }

    .zoom-btn {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: var(--vscode-icon-foreground, #9da5b4);
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 12px;
      transition: background 0.12s, color 0.12s;
    }
    .zoom-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.1));
      color: var(--vscode-foreground, #ffffff);
    }
    .zoom-btn svg {
      width: 13px;
      height: 13px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.6;
    }

    /* Exact Visual Box Sizer to eliminate ghost scrollbars */
    .canvas-sizer {
      position: relative;
      flex-shrink: 0;
    }

    /* iPhone 15 Pro Precision Chassis */
    .device-chassis {
      position: absolute;
      top: 0;
      left: 0;
      width: ${width}px;
      height: ${height}px;
      transform-origin: top left;
      background: #ffffff;
      border: 6px solid #18181b;
      border-radius: 54px;
      box-shadow:
        0 0 0 1.5px #3f3f46,
        0 20px 50px rgba(0, 0, 0, 0.65);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Dynamic Island */
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

    /* Dedicated Status Bar Row */
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

    /* Screen Surface */
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

    /* Home Indicator Row */
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

    /* Bottom Status / Device Picker Bar */
    .bottom-bar {
      height: 32px;
      background: var(--vscode-editor-background, #1e1e1e);
      border-top: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.07));
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      font-size: 11px;
      flex-shrink: 0;
      z-index: 50;
    }

    .device-picker-pill {
      background: var(--vscode-input-background, #252528);
      border: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.08));
      border-radius: 12px;
      padding: 2px 12px;
      font-size: 11px;
      color: var(--vscode-foreground, #cccccc);
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