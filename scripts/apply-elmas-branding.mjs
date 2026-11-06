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

// 2. Configure French Locale & Language Pack
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

// 3. Apply Elmas Amber Forge Theme & Layout in settings.json
const settings = {
  "workbench.colorTheme": "Default Dark Modern",
  "workbench.startupEditor": "none",
  "workbench.sideBar.location": "left",
  "workbench.editor.openSideBySideDirection": "right",
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 300,
  "elmasStudio.sdkPaths.androidSdk": "C:\\Users\\elmas\\AppData\\Local\\Android\\Sdk",
  "workbench.colorCustomizations": {
    "titleBar.activeBackground": "#0d0d0f",
    "titleBar.inactiveBackground": "#0d0d0f",
    "titleBar.activeForeground": "#e4e4e7",
    "titleBar.border": "#1f1f23",
    "activityBar.background": "#0d0d0f",
    "activityBar.foreground": "#f59e0b",
    "activityBar.inactiveForeground": "#71717a",
    "activityBar.activeBorder": "#f59e0b",
    "activityBar.border": "#1f1f23",
    "activityBarBadge.background": "#d97706",
    "activityBarBadge.foreground": "#09090b",
    "sideBar.background": "#101013",
    "sideBar.foreground": "#d4d4d8",
    "sideBar.border": "#1f1f23",
    "sideBarSectionHeader.background": "#141418",
    "sideBarSectionHeader.foreground": "#f59e0b",
    "editor.background": "#121215",
    "editorGroupHeader.tabsBackground": "#0e0e11",
    "editorGroupHeader.tabsBorder": "#1f1f23",
    "tab.activeBackground": "#121215",
    "tab.activeForeground": "#fafafa",
    "tab.activeBorderTop": "#f59e0b",
    "tab.inactiveBackground": "#0e0e11",
    "tab.inactiveForeground": "#71717a",
    "tab.border": "#1f1f23",
    "statusBar.background": "#0d0d0f",
    "statusBar.noFolderBackground": "#0d0d0f",
    "statusBar.debuggingBackground": "#b45309",
    "statusBar.foreground": "#a1a1aa",
    "statusBar.border": "#1f1f23",
    "button.background": "#d97706",
    "button.hoverBackground": "#f59e0b",
    "button.foreground": "#09090b",
    "focusBorder": "#d97706",
    "input.background": "#18181c",
    "input.border": "#27272c",
    "list.activeSelectionBackground": "#271f14",
    "list.activeSelectionForeground": "#fbbf24",
    "list.inactiveSelectionBackground": "#1c1915",
    "list.hoverBackground": "#18181c",
    "editorCursor.foreground": "#f59e0b",
    "editor.selectionBackground": "#d9770633",
    "editor.lineHighlightBackground": "#18181c",
    "panel.background": "#101013",
    "panel.border": "#1f1f23",
    "panelTitle.activeBorder": "#f59e0b",
    "panelTitle.activeForeground": "#fafafa"
  }
};

fs.writeFileSync(path.join(userDir, "settings.json"), JSON.stringify(settings, null, 2));
console.log("Elmas Amber Forge branding, French locale, and custom logos applied.");
