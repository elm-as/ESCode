import { CompiledFlutterPayload } from "./flutter-live-compiler";

/**
 * Generates the interactive HTML document for the Flutter Fast Preview server.
 * Pure mobile viewport without artificial debug bars overlapping the phone bezel.
 */
export function renderFlutterPreviewDocument(payload: CompiledFlutterPayload): string {
  const payloadJson = JSON.stringify(payload);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; }
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100vh; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Outfit", "Roboto", "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    #fl-scaffold {
      position: relative; width: 100%; height: 100vh;
      display: flex; flex-direction: column;
      transition: background 0.12s ease;
    }
    #fl-appbar {
      min-height: 54px; padding: 8px 16px;
      display: flex; align-items: center; gap: 12px;
      color: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.16); flex-shrink: 0; z-index: 10;
    }
    #fl-back-btn {
      width: 32px; height: 32px; border-radius: 50%; border: none;
      background: rgba(255,255,255,0.12); color: #ffffff;
      display: none; align-items: center; justify-content: center;
      font-size: 16px; cursor: pointer; flex-shrink: 0;
    }
    #fl-back-btn:active { background: rgba(255,255,255,0.24); transform: scale(0.94); }
    #fl-appbar-titles { display: flex; flex-direction: column; justify-content: center; }
    #fl-appbar-title { font-size: 18px; font-weight: 700; line-height: 1.2; }
    #fl-appbar-sub { font-size: 11px; color: rgba(255,255,255,0.75); margin-top: 2px; }
    #fl-body {
      flex: 1; display: flex; flex-direction: column;
      padding: 18px 16px 24px 16px; overflow-y: auto; gap: 4px;
    }
    #fl-body::-webkit-scrollbar { width: 0; height: 0; }
    .fl-text { line-height: 1.35; }
    .fl-btn {
      border: none; color: #fff; padding: 13px 22px; border-radius: 14px;
      font-size: 15px; font-weight: 700; cursor: pointer; width: 100%;
      box-shadow: 0 3px 8px rgba(0,0,0,0.2); margin-top: 6px;
      transition: transform 0.08s ease;
    }
    .fl-btn:active { transform: scale(0.97); }
    .fl-summary-card {
      width: 100%; border-radius: 18px; padding: 16px; color: #fff;
      box-shadow: 0 6px 16px rgba(0,0,0,0.2); margin-bottom: 12px; text-align: left;
    }
    .fl-summary-box {
      background: rgba(255,255,255,0.09); border-radius: 10px; padding: 10px 12px;
      display: flex; flex-direction: column; gap: 4px; font-size: 12px;
    }
    .fl-summary-row { display: flex; justify-content: space-between; align-items: center; }
    .fl-action-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; margin: 8px 0;
    }
    .fl-grid-card {
      background: #ffffff; border-radius: 16px; padding: 14px 10px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); cursor: pointer;
      transition: transform 0.08s ease;
    }
    .fl-grid-card:active { transform: scale(0.96); }
    .fl-grid-icon {
      width: 42px; height: 42px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; margin-bottom: 6px;
    }
    .fl-grid-label { font-size: 13px; font-weight: 700; color: #1f2937; }
    .fl-input-group { display: flex; flex-direction: column; text-align: left; width: 100%; }
    .fl-input-label { font-size: 11px; font-weight: 600; color: #6b7280; margin-bottom: 3px; }
    .fl-input {
      width: 100%; padding: 10px 12px; border-radius: 10px;
      border: 1.5px solid #d1d5db; background: #ffffff; color: #111827;
      font-size: 13px; outline: none; user-select: text;
    }
    .fl-pin-dots { display: flex; gap: 14px; justify-content: center; margin: 14px 0 18px 0; }
    .fl-pin-dot {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.45); background: transparent;
      transition: all 0.12s ease;
    }
    .fl-pin-dot.filled { background: #c6ff00; border-color: #c6ff00; box-shadow: 0 0 8px rgba(198,255,0,0.6); }
    .fl-keypad {
      display: grid; grid-template-columns: repeat(3, 62px); gap: 12px;
      justify-content: center; margin: 4px auto;
    }
    .fl-key {
      width: 62px; height: 62px; border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.22); background: rgba(255,255,255,0.08);
      color: #ffffff; font-size: 22px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .fl-key:active { background: rgba(255,255,255,0.25); transform: scale(0.93); }
    #fl-fab {
      position: absolute; right: 16px; bottom: 18px;
      height: 48px; min-width: 48px; padding: 0 16px; border-radius: 14px; border: none;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      color: #ffffff; font-size: 13px; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.35); z-index: 20;
    }
    #fl-fab:active { transform: scale(0.94); }
  </style>
</head>
<body>
  <div id="fl-scaffold">
    <div id="fl-appbar">
      <button id="fl-back-btn" onclick="window.__switchFlutterScreen('HomeScreen')" title="Retour">←</button>
      <div id="fl-appbar-titles">
        <div id="fl-appbar-title"></div>
        <div id="fl-appbar-sub"></div>
      </div>
    </div>
    <div id="fl-body"></div>
    <button id="fl-fab" onclick="window.__incrementFlutterCounter()"></button>
  </div>

  <script>
    window.__flutterState = { _counter: 0, counter: 0, pin: "" };

    function syncStateToDom() {
      document.querySelectorAll('[data-flutter-var]').forEach((el) => {
        el.textContent = String(window.__flutterState._counter);
      });
      document.querySelectorAll('.fl-pin-dot').forEach((dot, idx) => {
        if (idx < window.__flutterState.pin.length) dot.classList.add('filled');
        else dot.classList.remove('filled');
      });
    }

    window.__incrementFlutterCounter = function() {
      window.__flutterState._counter += 1;
      window.__flutterState.counter += 1;
      syncStateToDom();
    };

    window.__pressPinDigit = function(d) {
      if (window.__flutterState.pin.length < 4) {
        window.__flutterState.pin += d;
        syncStateToDom();
        if (window.__flutterState.pin.length === 4) {
          setTimeout(() => {
            window.__flutterState.pin = "";
            syncStateToDom();
            window.__switchFlutterScreen("HomeScreen");
          }, 160);
        }
      }
    };

    window.__pressPinBackspace = function() {
      window.__flutterState.pin = window.__flutterState.pin.slice(0, -1);
      syncStateToDom();
    };

    window.__switchFlutterScreen = function(screenId) {
      if (!screenId) return;
      fetch('/__switch_screen?id=' + encodeURIComponent(screenId)).catch(() => {});
    };

    function applyPatch(model) {
      const scaffold = document.getElementById('fl-scaffold');
      const appbar = document.getElementById('fl-appbar');
      const backBtn = document.getElementById('fl-back-btn');
      const appbarTitle = document.getElementById('fl-appbar-title');
      const appbarSub = document.getElementById('fl-appbar-sub');
      const body = document.getElementById('fl-body');
      const fab = document.getElementById('fl-fab');

      if (scaffold) {
        scaffold.style.background = model.scaffoldGradient || model.scaffoldBg;
        scaffold.style.color = (model.isDark || model.scaffoldGradient) ? '#ffffff' : '#1f2937';
      }
      if (appbar && appbarTitle && appbarSub) {
        appbar.style.display = model.hasAppBar ? 'flex' : 'none';
        appbar.style.backgroundColor = model.appBarBg;
        appbarTitle.innerHTML = model.appBarTitle;
        appbarSub.textContent = model.appBarSubtitle || '';
        appbarSub.style.display = model.appBarSubtitle ? 'block' : 'none';
      }
      if (backBtn) {
        const isRoot = !model.activeScreenId || model.activeScreenId === 'LockScreen' || model.activeScreenId === 'HomeScreen';
        backBtn.style.display = (!isRoot && model.screens && model.screens.length > 1) ? 'inline-flex' : 'none';
      }
      if (body) {
        body.style.justifyContent = model.bodyAlignCenter ? 'center' : 'flex-start';
        body.style.alignItems = 'center';
        body.style.textAlign = model.bodyAlignCenter ? 'center' : 'left';
        body.innerHTML = model.bodyHtml;
      }
      if (fab) {
        fab.style.display = model.hasFab ? 'flex' : 'none';
        fab.style.backgroundColor = model.fabBg;
        fab.onclick = function() {
          if (model.fabTargetScreen) window.__switchFlutterScreen(model.fabTargetScreen);
          else window.__incrementFlutterCounter();
        };
        fab.innerHTML = model.fabLabel
          ? '<span>' + model.fabIcon + '</span><span>' + model.fabLabel + '</span>'
          : '<span style="font-size:24px;font-weight:400">' + model.fabIcon + '</span>';
      }
      syncStateToDom();
    }

    applyPatch(${payloadJson});

    try {
      const es = new EventSource('/__elmas_live_reload');
      es.onmessage = (e) => {
        if (!e.data || e.data === 'connected') return;
        if (e.data === 'reload') { window.location.reload(); return; }
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'flutter-patch') applyPatch(msg.payload);
        } catch {}
      };
    } catch {}
  </script>
</body>
</html>`;
}
