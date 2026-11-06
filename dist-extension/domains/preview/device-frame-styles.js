"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeviceFrameStyles = getDeviceFrameStyles;
/**
 * React Native IDE-Inspired Stylesheet for Elmas Studio Mobile Virtual Device.
 * Clean, modern, minimalist iPhone 15 Pro frame with top/bottom toolbars.
 * Strictly compliant with ELMAS.md: < 350 lines, pure function.
 */
function getDeviceFrameStyles(width, height) {
    return `
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      background-color: #121214;
      color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Top Browser-Style Navigation Bar */
    .top-bar {
      height: 40px;
      background: #18181b;
      border-bottom: 1px solid #27272a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      font-size: 12px;
      flex-shrink: 0;
      z-index: 50;
    }

    .nav-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .icon-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: #a1a1aa;
      border-radius: 5px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }
    .icon-btn:hover {
      background: #27272a;
      color: #ffffff;
    }

    /* URL / Path Address Bar Pill */
    .address-pill {
      background: #202024;
      border: 1px solid #2e2e33;
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 11px;
      color: #71717a;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 160px;
      cursor: default;
    }
    .address-pill .path-text {
      color: #d4d4d8;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }

    /* Top Right Action Buttons */
    .btn-action-primary {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 4px 10px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.15s;
    }
    .btn-action-primary:hover { background: #0369a1; }

    .btn-action-stop {
      background: #27272a;
      color: #ef4444;
      border: 1px solid #3f3f46;
      padding: 4px 10px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-logs {
      background: #202024;
      color: #a1a1aa;
      border: 1px solid #2e2e33;
      padding: 4px 8px;
      border-radius: 5px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .btn-logs:hover { background: #27272a; color: #ffffff; }

    /* Canvas Area */
    .viewport-canvas {
      flex: 1;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #121214;
      position: relative;
      min-height: 0;
      min-width: 0;
      padding: 24px;
    }

    /* Left Floating Zoom Pill */
    .floating-zoom-pill {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      background: rgba(32, 32, 36, 0.9);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
      z-index: 45;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
    }

    .zoom-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: #a1a1aa;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 5px;
      transition: all 0.15s;
    }
    .zoom-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    .canvas-inner {
      margin: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
      transition: transform 0.15s ease-out;
    }

    /* iPhone 15 Pro Precision Chassis */
    .device-chassis {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      background: #ffffff;
      border: 4px solid #1c1c1f;
      border-radius: 54px;
      box-shadow:
        0 0 0 1px #38383e,
        0 25px 65px rgba(0, 0, 0, 0.85);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow: hidden;
    }

    /* Speaker Earpiece */
    .speaker-earpiece {
      position: absolute;
      top: 4px;
      left: 50%;
      transform: translateX(-50%);
      width: 44px;
      height: 3px;
      background: #26262a;
      border-radius: 2px;
      z-index: 45;
      pointer-events: none;
    }

    /* Dynamic Island */
    .dynamic-island {
      position: absolute;
      top: 11px;
      left: 50%;
      transform: translateX(-50%);
      width: 120px;
      height: 32px;
      background: #000000;
      border-radius: 20px;
      z-index: 40;
      pointer-events: none;
    }

    /* Status Bar */
    .status-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
      z-index: 30;
      pointer-events: none;
      font-size: 14px;
      font-weight: 700;
      color: #000000;
      letter-spacing: -0.3px;
      font-variant-numeric: tabular-nums;
    }

    .status-icons {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }

    /* Cellular signal dots */
    .cellular-dots {
      display: flex;
      align-items: center;
      gap: 2.5px;
    }
    .dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #000000;
    }

    /* Battery icon */
    .battery-icon {
      width: 22px;
      height: 11px;
      border: 1.5px solid #000000;
      border-radius: 3.5px;
      padding: 1.5px;
      position: relative;
      display: flex;
      align-items: center;
    }
    .battery-icon::after {
      content: "";
      width: 1.5px;
      height: 4px;
      background: #000000;
      position: absolute;
      right: -3px;
      border-radius: 0 1px 1px 0;
    }
    .battery-charge {
      height: 100%;
      width: 75%;
      background: #000000;
      border-radius: 1px;
    }

    /* Screen Surface */
    .screen-surface {
      width: 100%;
      height: 100%;
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

    /* Home Indicator */
    .home-indicator {
      position: absolute;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 135px;
      height: 4.5px;
      background: #000000;
      border-radius: 10px;
      opacity: 0.8;
      z-index: 30;
      pointer-events: none;
    }

    /* Bottom Status / Device Picker Bar */
    .bottom-bar {
      height: 38px;
      background: #18181b;
      border-top: 1px solid #27272a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      font-size: 11px;
      flex-shrink: 0;
      z-index: 50;
    }

    .bottom-left, .bottom-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Device Selector Pill Button */
    .device-picker-pill {
      background: #202024;
      border: 1px solid #2e2e33;
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 11px;
      color: #e4e4e7;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      outline: none;
    }
    .device-picker-pill:focus { border-color: #0284c7; }

    .bottom-link {
      color: #71717a;
      text-decoration: none;
    }
    .bottom-link:hover { color: #a1a1aa; }

    /* Clean Empty Standby View inside the phone */
    .phone-standby {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      text-align: center;
      color: #18181b;
    }
    .standby-msg {
      font-size: 15px;
      font-weight: 500;
      color: #27272a;
      line-height: 1.5;
      max-width: 260px;
    }
  `;
}
//# sourceMappingURL=device-frame-styles.js.map