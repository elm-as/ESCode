import fs from "fs";
import path from "path";
import crypto from "crypto";

const desktopDir = path.resolve("Elmas-Studio-Desktop");

// 1. Custom SVG Logos (Smartphone + </> in Amber Forge Gold)
const colorLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="elmasGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="screenBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1C1917"/>
      <stop offset="100%" stop-color="#0C0A09"/>
    </linearGradient>
  </defs>
  <rect x="18" y="6" width="64" height="88" rx="14" fill="url(#elmasGold)"/>
  <rect x="23" y="11" width="54" height="78" rx="10" fill="url(#screenBg)"/>
  <rect x="41" y="15" width="18" height="4.5" rx="2.25" fill="#292524"/>
  <path d="M38 42 L29 50 L38 58" fill="none" stroke="url(#elmasGold)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M62 42 L71 50 L62 58" fill="none" stroke="url(#elmasGold)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="54" y1="39" x2="46" y2="61" stroke="#FBBF24" stroke-width="4" stroke-linecap="round"/>
  <rect x="40" y="82" width="20" height="2.5" rx="1.25" fill="#F59E0B" opacity="0.8"/>
</svg>`;

const letterpressDarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 100 100">
  <g fill="none" stroke="#F59E0B" stroke-opacity="0.22">
    <rect x="22" y="8" width="56" height="84" rx="12" stroke-width="3.5"/>
    <rect x="42" y="14" width="16" height="3.5" rx="1.75" fill="#F59E0B" fill-opacity="0.22" stroke="none"/>
    <path d="M39 43 L31 50 L39 57" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M61 43 L69 50 L61 57" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="53" y1="40" x2="47" y2="60" stroke-width="3.5" stroke-linecap="round"/>
    <rect x="41" y="84" width="18" height="2" rx="1" fill="#F59E0B" fill-opacity="0.22" stroke="none"/>
  </g>
</svg>`;

const activityBarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <rect x="5" y="2" width="14" height="20" rx="3"/>
  <line x1="10" y1="5" x2="14" y2="5"/>
  <path d="M10 10l-2 2 2 2"/>
  <path d="M14 10l2 2-2 2"/>
  <line x1="10" y1="19" x2="14" y2="19"/>
</svg>`;

const colorTargets = [
  "resources/app/out/media/code-icon.svg",
  "resources/app/out/vs/workbench/browser/media/code-icon.svg",
  "resources/app/out/media/vscode-icon.svg",
  "resources/app/out/media/sessions-icon.svg",
];

for (const rel of colorTargets) {
  const full = path.join(desktopDir, rel);
  if (fs.existsSync(full)) fs.writeFileSync(full, colorLogoSvg);
}

const letterpressTargets = [
  "resources/app/out/media/letterpress-dark.svg",
  "resources/app/out/media/letterpress-hcDark.svg",
  "resources/app/out/media/letterpress-light.svg",
  "resources/app/out/media/letterpress-hcLight.svg",
  "resources/app/out/vs/workbench/browser/parts/editor/media/letterpress-dark.svg",
  "resources/app/out/vs/workbench/browser/parts/editor/media/letterpress-hcDark.svg",
  "resources/app/out/vs/workbench/browser/parts/editor/media/letterpress-light.svg",
  "resources/app/out/vs/workbench/browser/parts/editor/media/letterpress-hcLight.svg",
];

for (const rel of letterpressTargets) {
  const full = path.join(desktopDir, rel);
  if (fs.existsSync(full)) fs.writeFileSync(full, letterpressDarkSvg);
}

fs.writeFileSync(path.resolve("dist-extension/media/device-icon.svg"), activityBarSvg);
const bundledIcon = path.join(desktopDir, "data/extensions/elmas-studio-core/media/device-icon.svg");
if (fs.existsSync(path.dirname(bundledIcon))) {
  fs.writeFileSync(bundledIcon, activityBarSvg);
}

// 2. Inject macOS Sequoia / Xcode Dark Glass CSS into workbench.desktop.main.css & update checksum
const workbenchCssPath = path.join(desktopDir, "resources/app/out/vs/workbench/workbench.desktop.main.css");
const macosCssPath = path.resolve("scripts/elmas-macos-theme.css");
if (fs.existsSync(workbenchCssPath) && fs.existsSync(macosCssPath)) {
  const startMarker = "/* === ELMAS MACOS SEQUOIA / XCODE DARK GLASS UI === */";
  const endMarker = "/* === END ELMAS MACOS SEQUOIA UI === */";
  let cssContent = fs.readFileSync(workbenchCssPath, "utf8");
  const customCss = fs.readFileSync(macosCssPath, "utf8");

  const startIdx = cssContent.indexOf(startMarker);
  const endIdx = cssContent.indexOf(endMarker);
  if (startIdx !== -1 && endIdx !== -1) {
    cssContent = cssContent.slice(0, startIdx).trimEnd();
  }

  cssContent = `${cssContent}\n\n${customCss}\n`;
  fs.writeFileSync(workbenchCssPath, cssContent, "utf8");

  const productJsonPath = path.join(desktopDir, "resources/app/product.json");
  if (fs.existsSync(productJsonPath)) {
    const product = JSON.parse(fs.readFileSync(productJsonPath, "utf8"));
    const newHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(workbenchCssPath))
      .digest("base64")
      .replace(/=+$/, "");
    if (product.checksums) {
      product.checksums["vs/workbench/workbench.desktop.main.css"] = newHash;
      fs.writeFileSync(productJsonPath, JSON.stringify(product, null, 2), "utf8");
    }
  }
}

// 3. Configure French Locale & Language Pack
const argvPath = path.join(desktopDir, "data/argv.json");
fs.mkdirSync(path.dirname(argvPath), { recursive: true });
fs.writeFileSync(
  argvPath,
  JSON.stringify(
    {
      "enable-crash-reporter": false,
      "crash-reporter-id": "a31ba260-01c1-4f4c-a5f8-803fdf8aa364",
      locale: "fr",
    },
    null,
    2
  )
);

const userDir = path.join(desktopDir, "data/user-data/User");
fs.mkdirSync(userDir, { recursive: true });
fs.writeFileSync(path.join(userDir, "locale.json"), JSON.stringify({ locale: "fr" }, null, 2));

const extRoot = path.join(desktopDir, "data/extensions");
if (fs.existsSync(extRoot)) {
  const frDirName = fs.readdirSync(extRoot).find((d) => d.startsWith("ms-ceintl.vscode-language-pack-fr"));
  if (frDirName) {
    const frExtDir = path.join(extRoot, frDirName);
    const pkg = JSON.parse(fs.readFileSync(path.join(frExtDir, "package.json"), "utf8"));
    const loc = pkg.contributes.localizations[0];
    const translations = {};
    for (const t of loc.translations) {
      translations[t.id] = path.join(frExtDir, t.path);
    }
    const hash = crypto
      .createHash("md5")
      .update(pkg.version + JSON.stringify(translations))
      .digest("hex");
    const lp = {
      fr: {
        hash,
        extensions: [
          {
            extensionIdentifier: {
              id: "ms-ceintl.vscode-language-pack-fr",
              uuid: "c8f5e0c2-75b1-4e6b-8790-4a80217b7e5e",
            },
            version: pkg.version,
          },
        ],
        translations,
      },
    };
    fs.writeFileSync(path.join(desktopDir, "data/user-data/languagepacks.json"), JSON.stringify(lp, null, 2));
  }
}

// 4. Apply Elmas Amber Forge + macOS Sequoia Typography & Smooth Motion in settings.json
const settings = {
  "workbench.colorTheme": "Default Dark Modern",
  "workbench.startupEditor": "none",
  "workbench.sideBar.location": "left",
  "workbench.editor.openSideBySideDirection": "right",
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 100,
  "editor.fontFamily": "'JetBrains Mono', 'Cascadia Code', 'SF Mono', 'Fira Code', Consolas, monospace",
  "editor.fontLigatures": true,
  "editor.fontSize": 13.5,
  "editor.lineHeight": 22,
  "editor.letterSpacing": 0.2,
  "editor.padding": { "top": 16, "bottom": 16 },
  "editor.cursorBlinking": "smooth",
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.cursorWidth": 2,
  "editor.smoothScrolling": true,
  "workbench.list.smoothScrolling": true,
  "terminal.integrated.smoothScrolling": true,
  "editor.minimap.enabled": false,
  "editor.renderLineHighlight": "all",
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": "active",
  "editor.guides.indentation": true,
  "editor.scrollbar.verticalScrollbarSize": 6,
  "editor.scrollbar.horizontalScrollbarSize": 6,
  "workbench.tree.indent": 16,
  "workbench.tree.renderIndentGuides": "onHover",
  "window.commandCenter": true,
  "elmasStudio.sdkPaths.androidSdk": "C:\\Users\\elmas\\AppData\\Local\\Android\\Sdk",
  "workbench.colorCustomizations": {
    "titleBar.activeBackground": "#0b0b0e",
    "titleBar.inactiveBackground": "#0b0b0e",
    "titleBar.activeForeground": "#e4e4e7",
    "titleBar.border": "#19191f",
    "activityBar.background": "#0b0b0e",
    "activityBar.foreground": "#f59e0b",
    "activityBar.inactiveForeground": "#63636e",
    "activityBar.activeBorder": "#00000000",
    "activityBar.border": "#19191f",
    "activityBarBadge.background": "#d97706",
    "activityBarBadge.foreground": "#09090b",
    "sideBar.background": "#0e0e12",
    "sideBar.foreground": "#d4d4d8",
    "sideBar.border": "#19191f",
    "sideBarSectionHeader.background": "#0e0e12",
    "sideBarSectionHeader.foreground": "#a1a1aa",
    "sideBarSectionHeader.border": "#19191f",
    "editor.background": "#111115",
    "editorGroupHeader.tabsBackground": "#0b0b0e",
    "editorGroupHeader.tabsBorder": "#19191f",
    "tab.activeBackground": "#1a1a20",
    "tab.activeForeground": "#fafafa",
    "tab.activeBorderTop": "#00000000",
    "tab.inactiveBackground": "#0b0b0e",
    "tab.inactiveForeground": "#71717a",
    "tab.border": "#00000000",
    "statusBar.background": "#0b0b0e",
    "statusBar.noFolderBackground": "#0b0b0e",
    "statusBar.debuggingBackground": "#b45309",
    "statusBar.foreground": "#8e8e99",
    "statusBar.border": "#19191f",
    "button.background": "#d97706",
    "button.hoverBackground": "#f59e0b",
    "button.foreground": "#09090b",
    "focusBorder": "#d9770688",
    "input.background": "#16161b",
    "input.border": "#26262e",
    "list.activeSelectionBackground": "#231d15",
    "list.activeSelectionForeground": "#fbbf24",
    "list.inactiveSelectionBackground": "#191714",
    "list.hoverBackground": "#17171d",
    "editorCursor.foreground": "#f59e0b",
    "editor.selectionBackground": "#d9770633",
    "editor.lineHighlightBackground": "#17171d",
    "editor.lineHighlightBorder": "#00000000",
    "panel.background": "#0e0e12",
    "panel.border": "#19191f",
    "panelTitle.activeBorder": "#f59e0b",
    "panelTitle.activeForeground": "#fafafa",
    "quickInput.background": "#141419",
    "quickInput.foreground": "#e4e4e7",
    "menu.background": "#16161c",
    "menu.border": "#272730",
    "menu.selectionBackground": "#271f14",
    "menu.selectionForeground": "#fbbf24"
  }
};

fs.writeFileSync(path.join(userDir, "settings.json"), JSON.stringify(settings, null, 2));
console.log("Elmas macOS Sequoia UI, Amber Forge branding, French locale, and custom logos applied.");
