/**
 * High-Fidelity Mobile Virtual Device Stylesheet.
 * Realistic Titanium Chassis, Glass Specular Reflections, Dot-Matrix Canvas.
 * Strictly compliant with ELMAS.md: < 350 lines, pure function.
 */
export function getDeviceFrameStyles(width: number, height: number): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      background-color: #0b0b0e;
      color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Precision Engineering Toolbar */
    .toolbar {
      background: rgba(18, 18, 22, 0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 6px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      gap: 10px;
      flex-shrink: 0;
      z-index: 50;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Segmented Mode Selector */
    .mode-segmented {
      display: inline-flex;
      background: #18181b;
      padding: 2px;
      border-radius: 6px;
      border: 1px solid #27272a;
    }

    .mode-tab {
      border: none;
      background: transparent;
      color: #71717a;
      padding: 3px 9px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 0.6px;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .mode-tab.active-fast {
      background: linear-gradient(135deg, #0284c7, #0369a1);
      color: #ffffff;
      box-shadow: 0 1px 4px rgba(2, 132, 199, 0.4);
    }

    .mode-tab.active-native {
      background: linear-gradient(135deg, #d97706, #b45309);
      color: #ffffff;
      box-shadow: 0 1px 4px rgba(217, 119, 6, 0.4);
    }

    .control-select {
      background: #18181b;
      color: #e4e4e7;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 11px;
      outline: none;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }
    .control-select:focus { border-color: #38bdf8; }

    .tool-btn {
      background: #18181b;
      color: #d4d4d8;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 3px 9px;
      cursor: pointer;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    }
    .tool-btn:hover {
      background: #27272a;
      color: #ffffff;
      border-color: #3f3f46;
    }
    .btn-run {
      background: linear-gradient(135deg, #0284c7, #025ca1);
      color: #ffffff;
      font-weight: 600;
      border-color: #0369a1;
      box-shadow: 0 1px 4px rgba(2, 132, 199, 0.3);
    }
    .btn-run:hover { background: #0284c7; }
    .btn-stop {
      background: #27272a;
      color: #ef4444;
      font-weight: 600;
      border-color: #3f3f46;
    }

    /* Dot-Matrix Studio Canvas */
    .viewport-canvas {
      flex: 1;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background-color: #09090b;
      background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
      background-size: 20px 20px;
      min-height: 0;
      min-width: 0;
      position: relative;
    }

    .canvas-inner {
      margin: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
      transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* Physical Titanium Smartphone Chassis */
    .device-chassis {
      position: relative;
      width: ${width}px;
      height: ${height + 66}px;
      background: #000000;
      border: 12px solid #232327;
      border-radius: 54px;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.18),
        0 0 0 3px #0e0e11,
        0 30px 80px -15px rgba(0, 0, 0, 0.95),
        0 12px 30px -5px rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow: hidden;
    }

    /* Side Physical Hardware Buttons */
    .side-key {
      position: absolute;
      background: linear-gradient(180deg, #3e3e44, #222226);
      border: 1px solid #4a4a52;
      pointer-events: none;
      z-index: 5;
    }
    .key-action { left: -16px; top: 105px; width: 4px; height: 26px; border-radius: 3px 0 0 3px; }
    .key-vol-up { left: -16px; top: 145px; width: 4px; height: 50px; border-radius: 3px 0 0 3px; }
    .key-vol-down { left: -16px; top: 205px; width: 4px; height: 50px; border-radius: 3px 0 0 3px; }
    .key-power { right: -16px; top: 160px; width: 4px; height: 72px; border-radius: 0 3px 3px 0; }

    /* Top Speaker */
    .speaker-earpiece {
      position: absolute;
      top: 5px;
      left: 50%;
      transform: translateX(-50%);
      width: 48px;
      height: 3.5px;
      background: #2a2a2f;
      border-radius: 3px;
      z-index: 45;
    }

    /* Dynamic Island */
    .dynamic-island {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 114px;
      height: 28px;
      background: #000000;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 11px;
      pointer-events: none;
    }

    .camera-lens {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #232252 0%, #0c0b1f 65%, #02020a 100%);
      box-shadow: inset 0 0 2px rgba(120, 119, 198, 0.6);
    }
    .sensor-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #0d0d10;
      box-shadow: inset 0 0 1px rgba(255, 255, 255, 0.1);
    }

    /* Glass Sheen Specular Overlay */
    .glass-sheen {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 30%, transparent 55%);
      pointer-events: none;
      z-index: 35;
      border-radius: 42px;
    }

    /* Status Bar */
    .status-bar {
      height: 42px;
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
      z-index: 30;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.2px;
    }

    .status-icons { display: flex; align-items: center; gap: 7px; font-size: 11px; }

    .signal-bars { display: flex; align-items: flex-end; gap: 1.5px; height: 11px; }
    .sig-bar { width: 3px; background: #ffffff; border-radius: 1px; }

    .battery-pill { display: flex; align-items: center; gap: 4px; }
    .battery-shell {
      width: 22px;
      height: 11px;
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
      right: -2.8px;
      top: 2px;
    }
    .battery-fill { height: 100%; width: 88%; background: #22c55e; border-radius: 1px; }

    /* Screen & Iframe */
    .screen-surface {
      flex: 1;
      background: #000000;
      position: relative;
      overflow: hidden;
      border-radius: 4px;
    }

    iframe { width: 100%; height: 100%; border: none; background: #09090b; }

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
      width: 130px;
      height: 4.5px;
      background: #ffffff;
      border-radius: 10px;
      opacity: 0.85;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }

    /* Standby Lock Screen Experience */
    .standby-lockscreen {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 36px 20px 24px;
      background: radial-gradient(circle at 50% 25%, #1e1b4b 0%, #09090b 75%);
      color: #f4f4f5;
      text-align: center;
    }

    .lock-time {
      font-size: 56px;
      font-weight: 700;
      letter-spacing: -1.5px;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      margin-bottom: 4px;
    }

    .lock-date {
      font-size: 13px;
      color: #93c5fd;
      font-weight: 500;
    }

    .lock-card {
      background: rgba(24, 24, 27, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 18px;
      width: 100%;
      max-width: 280px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
    }

    .lock-card h3 {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 4px;
      color: #ffffff;
    }

    .lock-card p {
      font-size: 11px;
      color: #a1a1aa;
      line-height: 1.4;
      margin-bottom: 12px;
    }

    .btn-launch-preview {
      width: 100%;
      background: linear-gradient(135deg, #0284c7, #0369a1);
      color: #ffffff;
      border: none;
      padding: 10px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
      transition: transform 0.1s;
    }
    .btn-launch-preview:hover { filter: brightness(1.1); }
    .btn-launch-preview:active { transform: scale(0.98); }

    .lock-quick-actions {
      display: flex;
      justify-content: space-between;
      width: 100%;
      padding: 0 20px;
    }

    .quick-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }

    /* Bottom Dimension Badge */
    .device-metrics-badge {
      margin-top: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      color: #71717a;
      background: #121215;
      padding: 3px 10px;
      border-radius: 9999px;
      border: 1px solid #27272a;
      letter-spacing: 0.3px;
    }
  `;
}
