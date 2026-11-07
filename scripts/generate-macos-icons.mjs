import fs from "fs";
import path from "path";

/**
 * Generates the 'elmas-macos-icons' extension inside Elmas-Studio-Desktop/data/extensions.
 * Provides authentic macOS Sequoia rounded folder icons and squircle file badges.
 */
export function generateMacosIconTheme(desktopDir) {
  const extDir = path.join(desktopDir, "data/extensions/elmas-macos-icons");
  const iconsDir = path.join(extDir, "icons");
  fs.mkdirSync(iconsDir, { recursive: true });

  const makeFolderSvg = (topColor, bodyStart, bodyEnd, glyph = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${bodyStart}"/>
      <stop offset="100%" stop-color="${bodyEnd}"/>
    </linearGradient>
  </defs>
  <path d="M2.5 6.5C2.5 5.12 3.62 4 5 4h4.3c.65 0 1.26.32 1.63.85l.82 1.15H19c1.38 0 2.5 1.12 2.5 2.5v9c0 1.38-1.12 2.5-2.5 2.5H5c-1.38 0-2.5-1.12-2.5-2.5v-11z" fill="${topColor}"/>
  <rect x="2.5" y="7.5" width="19" height="12.5" rx="2.6" fill="url(#g)"/>
  <rect x="2.5" y="7.5" width="19" height="1.1" rx="0.5" fill="#ffffff" fill-opacity="0.28"/>
  ${glyph}
</svg>`;

  const makeFolderOpenSvg = (topColor, bodyStart, bodyEnd) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="go" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${bodyStart}"/>
      <stop offset="100%" stop-color="${bodyEnd}"/>
    </linearGradient>
  </defs>
  <path d="M2.5 6.5C2.5 5.12 3.62 4 5 4h4.3c.65 0 1.26.32 1.63.85l.82 1.15H19c1.38 0 2.5 1.12 2.5 2.5v3H2.5v-5z" fill="${topColor}"/>
  <path d="M1.8 10.5C1.8 9.4 2.7 8.5 3.8 8.5h16.4c1.1 0 2 .9 1.85 2l-1.1 7.5c-.15 1.1-1.05 2-2.15 2H5.2c-1.1 0-2-.9-2.15-2L1.8 10.5z" fill="url(#go)"/>
</svg>`;

  const makeFileBadgeSvg = (bgStart, bgEnd, accentColor, label) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="fb" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgStart}"/>
      <stop offset="100%" stop-color="${bgEnd}"/>
    </linearGradient>
  </defs>
  <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#fb)" stroke="${accentColor}" stroke-opacity="0.45" stroke-width="1.2"/>
  <text x="12" y="15.2" text-anchor="middle" fill="${accentColor}" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif" font-weight="800" font-size="8.2" letter-spacing="-0.3">${label}</text>
</svg>`;

  const svgs = {
    "folder.svg": makeFolderSvg("#38BDF8", "#60A5FA", "#2563EB"),
    "folder-open.svg": makeFolderOpenSvg("#2563EB", "#60A5FA", "#1D4ED8"),
    "folder-src.svg": makeFolderSvg("#D97706", "#FBBF24", "#D97706"),
    "folder-src-open.svg": makeFolderOpenSvg("#B45309", "#FBBF24", "#B45309"),
    "folder-ui.svg": makeFolderSvg("#0D9488", "#2DD4BF", "#0F766E"),
    "folder-ui-open.svg": makeFolderOpenSvg("#0F766E", "#2DD4BF", "#115E59"),
    "folder-data.svg": makeFolderSvg("#7C3AED", "#A78BFA", "#6D28D9"),
    "folder-data-open.svg": makeFolderOpenSvg("#5B21B6", "#A78BFA", "#4C1D95"),
    "folder-assets.svg": makeFolderSvg("#059669", "#34D399", "#059669"),
    "folder-assets-open.svg": makeFolderOpenSvg("#047857", "#34D399", "#065F46"),
    "folder-platform.svg": makeFolderSvg("#4F46E5", "#818CF8", "#4338CA"),
    "folder-platform-open.svg": makeFolderOpenSvg("#3730A3", "#818CF8", "#312E81"),
    "file.svg": makeFileBadgeSvg("#1E1E26", "#14141A", "#A1A1AA", "DOC"),
    "dart.svg": makeFileBadgeSvg("#0C2A3E", "#081C2B", "#38BDF8", "DART"),
    "ts.svg": makeFileBadgeSvg("#102644", "#0A192F", "#60A5FA", "TS"),
    "react.svg": makeFileBadgeSvg("#0B2938", "#071B26", "#22D3EE", "JSX"),
    "js.svg": makeFileBadgeSvg("#2E240B", "#1F1806", "#FBBF24", "JS"),
    "kotlin.svg": makeFileBadgeSvg("#28163E", "#190D29", "#C084FC", "KT"),
    "html.svg": makeFileBadgeSvg("#36180E", "#230F08", "#FB923C", "HTML"),
    "css.svg": makeFileBadgeSvg("#17203D", "#0E1428", "#818CF8", "CSS"),
    "json.svg": makeFileBadgeSvg("#262214", "#18150C", "#F59E0B", "{ }"),
    "yaml.svg": makeFileBadgeSvg("#2B1726", "#1C0E18", "#F472B6", "YML"),
    "md.svg": makeFileBadgeSvg("#1A242B", "#11181D", "#94A3B8", "MD"),
  };

  for (const [name, content] of Object.entries(svgs)) {
    fs.writeFileSync(path.join(iconsDir, name), content, "utf8");
  }

  const iconDefinitions = {};
  for (const name of Object.keys(svgs)) {
    const id = path.basename(name, ".svg");
    iconDefinitions[id] = { iconPath: `./icons/${name}` };
  }

  const themeJson = {
    iconDefinitions,
    file: "file",
    folder: "folder",
    folderExpanded: "folder-open",
    folderNames: {
      lib: "folder-src",
      src: "folder-src",
      app: "folder-src",
      screens: "folder-ui",
      components: "folder-ui",
      presentation: "folder-ui",
      views: "folder-ui",
      ui: "folder-ui",
      widgets: "folder-ui",
      data: "folder-data",
      repositories: "folder-data",
      providers: "folder-data",
      core: "folder-data",
      services: "folder-data",
      domains: "folder-data",
      models: "folder-data",
      assets: "folder-assets",
      images: "folder-assets",
      media: "folder-assets",
      fonts: "folder-assets",
      ios: "folder-platform",
      android: "folder-platform",
      macos: "folder-platform",
      windows: "folder-platform",
      web: "folder-platform",
    },
    folderNamesExpanded: {
      lib: "folder-src-open",
      src: "folder-src-open",
      app: "folder-src-open",
      screens: "folder-ui-open",
      components: "folder-ui-open",
      presentation: "folder-ui-open",
      views: "folder-ui-open",
      ui: "folder-ui-open",
      widgets: "folder-ui-open",
      data: "folder-data-open",
      repositories: "folder-data-open",
      providers: "folder-data-open",
      core: "folder-data-open",
      services: "folder-data-open",
      domains: "folder-data-open",
      models: "folder-data-open",
      assets: "folder-assets-open",
      images: "folder-assets-open",
      media: "folder-assets-open",
      fonts: "folder-assets-open",
      ios: "folder-platform-open",
      android: "folder-platform-open",
      macos: "folder-platform-open",
      windows: "folder-platform-open",
      web: "folder-platform-open",
    },
    fileExtensions: {
      dart: "dart",
      ts: "ts",
      tsx: "react",
      jsx: "react",
      js: "js",
      mjs: "js",
      cjs: "js",
      kt: "kotlin",
      kts: "kotlin",
      html: "html",
      htm: "html",
      css: "css",
      scss: "css",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      lock: "yaml",
      md: "md",
    },
  };

  fs.writeFileSync(path.join(extDir, "elmas-macos-icons.json"), JSON.stringify(themeJson, null, 2), "utf8");

  const pkgJson = {
    name: "elmas-macos-icons",
    displayName: "Elmas Studio — Icônes macOS Sequoia",
    version: "1.0.0",
    publisher: "elmascore",
    engines: { vscode: "^1.80.0" },
    contributes: {
      iconThemes: [
        {
          id: "elmas-macos-icons",
          label: "Elmas macOS Sequoia Icons",
          path: "./elmas-macos-icons.json",
        },
      ],
    },
  };

  fs.writeFileSync(path.join(extDir, "package.json"), JSON.stringify(pkgJson, null, 2), "utf8");

  // Also install as built-in extension in resources/app/extensions/elmas-macos-icons so VSCodium always loads it
  const builtinExtDir = path.join(desktopDir, "resources/app/extensions/elmas-macos-icons");
  fs.cpSync(extDir, builtinExtDir, { recursive: true, force: true });

  // Register in data/extensions/extensions.json if present
  const extManifestPath = path.join(desktopDir, "data/extensions/extensions.json");
  if (fs.existsSync(extManifestPath)) {
    try {
      const list = JSON.parse(fs.readFileSync(extManifestPath, "utf8"));
      const normalizedPath = "/" + extDir.replace(/\\/g, "/");
      const entry = {
        identifier: { id: "elmascore.elmas-macos-icons" },
        version: "1.0.0",
        location: { $mid: 1, path: normalizedPath, scheme: "file" },
        relativeLocation: "elmas-macos-icons",
      };
      const idx = list.findIndex((item) => item?.identifier?.id === "elmascore.elmas-macos-icons");
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      fs.writeFileSync(extManifestPath, JSON.stringify(list), "utf8");
    } catch {
      // Ignore manifest parse error
    }
  }
}

