import fs from "fs";
import path from "path";

/**
 * Generates the 'elmas-macos-icons' extension inside Elmas-Studio-Desktop/data/extensions.
 * Uses full-bleed, pixel-aligned 24x24 vector icons for maximum legibility at 16x16px
 * in the Explorer tree and Editor tabs, paired with macOS Sequoia folders.
 */
export function generateMacosIconTheme(desktopDir) {
  const extDir = path.join(desktopDir, "data/extensions/elmas-macos-icons");
  const iconsDir = path.join(extDir, "icons");
  const iconsV2Dir = path.join(extDir, "icons-v2");
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(iconsV2Dir, { recursive: true });

  const makeFolderSvg = (topColor, bodyStart, bodyEnd) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${bodyStart}"/>
      <stop offset="100%" stop-color="${bodyEnd}"/>
    </linearGradient>
  </defs>
  <path d="M2.5 6.5C2.5 5.12 3.62 4 5 4h4.3c.65 0 1.26.32 1.63.85l.82 1.15H19c1.38 0 2.5 1.12 2.5 2.5v9c0 1.38-1.12 2.5-2.5 2.5H5c-1.38 0-2.5-1.12-2.5-2.5v-11z" fill="${topColor}"/>
  <rect x="2.5" y="7.5" width="19" height="12.5" rx="2.6" fill="url(#g)"/>
  <rect x="2.5" y="7.5" width="19" height="1.1" rx="0.5" fill="#ffffff" fill-opacity="0.28"/>
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

  const svgs = {
    // ── macOS Sequoia Folders ──────────────────────────────────────────────
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

    // ── Default Document ───────────────────────────────────────────────────
    "file.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M6 2.5h8l5 5V20a1.8 1.8 0 0 1-1.8 1.8H6A1.8 1.8 0 0 1 4.2 20V4.3A1.8 1.8 0 0 1 6 2.5z" fill="#27272A" stroke="#A1A1AA" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M14 2.5v5h5" fill="none" stroke="#A1A1AA" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,

    // ── TypeScript (Official Blue Badge + Crisp White TS) ──────────────────
    "ts.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#3178C6"/>
      <path d="M6.5 10.8h6.4v1.8h-2.2v6.9H8.7v-6.9H6.5v-1.8zm12.3 2c-.6-.4-1.4-.6-2.2-.6-.9 0-1.5.3-1.5.9 0 .5.5.8 1.6 1.2 1.7.6 2.5 1.3 2.5 2.7 0 1.7-1.3 2.7-3.4 2.7-1.1 0-2.1-.3-2.9-.8l.6-1.6c.6.4 1.4.7 2.2.7 1 0 1.5-.4 1.5-1 0-.5-.4-.8-1.6-1.2-1.6-.6-2.4-1.3-2.4-2.7 0-1.5 1.2-2.6 3.2-2.6 1 0 1.9.2 2.5.6l-.1 1.7z" fill="#FFFFFF"/>
    </svg>`,

    // ── TypeScript Config (tsconfig*.json) ─────────────────────────────────
    "tsconfig.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#1E3A8A" stroke="#60A5FA" stroke-width="1.4"/>
      <path d="M5.8 8.5h5.6v1.6H9.6v5.9H7.7v-5.9H5.8V8.5z" fill="#93C5FD"/>
      <circle cx="16.2" cy="14.5" r="2.3" fill="none" stroke="#60A5FA" stroke-width="1.8"/>
      <path d="M16.2 10.6v1.2M16.2 17.2v1.2M12.3 14.5h1.2M18.9 14.5h1.2" stroke="#60A5FA" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`,

    // ── JavaScript (Official Yellow Badge + Crisp Dark JS) ─────────────────
    "js.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#F7DF1E"/>
      <path d="M11.6 16.9c0 1.8-1 2.8-2.6 2.8-.9 0-1.6-.3-2.1-.7l.7-1.5c.3.3.7.5 1.2.5.6 0 1-.4 1-1.2v-5.8h1.8v5.9zm7.6-3.9c-.6-.4-1.3-.6-2.1-.6-.8 0-1.4.3-1.4.9 0 .5.5.8 1.5 1.2 1.6.6 2.4 1.3 2.4 2.7 0 1.6-1.3 2.7-3.2 2.7-1.1 0-2-.3-2.7-.8l.6-1.6c.6.4 1.3.7 2.1.7.9 0 1.4-.4 1.4-1 0-.5-.4-.8-1.5-1.2-1.5-.6-2.3-1.3-2.3-2.7 0-1.5 1.2-2.6 3-2.6 1 0 1.8.2 2.4.6l-.2 1.7z" fill="#111827"/>
    </svg>`,

    // ── React JSX / TSX (Full-bleed Crisp Atomic Orbits) ───────────────────
    "react.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2.2" fill="#00D8FF"/>
      <g fill="none" stroke="#00D8FF" stroke-width="1.55">
        <ellipse cx="12" cy="12" rx="9.8" ry="3.8"/>
        <ellipse cx="12" cy="12" rx="9.8" ry="3.8" transform="rotate(60 12 12)"/>
        <ellipse cx="12" cy="12" rx="9.8" ry="3.8" transform="rotate(120 12 12)"/>
      </g>
    </svg>`,

    "react-ts.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2.2" fill="#38BDF8"/>
      <g fill="none" stroke="#38BDF8" stroke-width="1.55">
        <ellipse cx="12" cy="12" rx="9.8" ry="3.8"/>
        <ellipse cx="12" cy="12" rx="9.8" ry="3.8" transform="rotate(60 12 12)"/>
        <ellipse cx="12" cy="12" rx="9.8" ry="3.8" transform="rotate(120 12 12)"/>
      </g>
    </svg>`,

    // ── Dart (Authentic Multi-Faceted Origami Shield) ──────────────────────
    "dart.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M5 5L12 1.8l8.8 8.8v8.4a2 2 0 0 1-2 2h-8.4L1.8 12 5 5z" fill="#01579B"/>
      <path d="M5 5L12 1.8l8.8 8.8H12L5 5z" fill="#40C4FF"/>
      <path d="M12 10.6h8.8v8.4a2 2 0 0 1-2 2H12V10.6z" fill="#00B4AB"/>
      <path d="M5 5l7 5.6v10.4h-1.6L1.8 12 5 5z" fill="#29B6F6"/>
    </svg>`,

    // ── Generated Dart (*.g.dart / *.freezed.dart) ─────────────────────────
    "dart-gen.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M5 5L12 1.8l8.8 8.8v8.4a2 2 0 0 1-2 2h-8.4L1.8 12 5 5z" fill="#0F766E"/>
      <path d="M5 5L12 1.8l8.8 8.8H12L5 5z" fill="#5EEAD4"/>
      <path d="M12 10.6h8.8v8.4a2 2 0 0 1-2 2H12V10.6z" fill="#14B8A6"/>
      <circle cx="18" cy="18" r="4" fill="#F59E0B"/>
    </svg>`,

    // ── Flutter (pubspec.yaml / Flutter Wing) ──────────────────────────────
    "flutter.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <polygon points="14.4,2 4.5,11.9 7.6,15 20.6,2" fill="#47C5FB"/>
      <polygon points="14.3,11.2 9,16.5 14.4,22 20.6,22 15.2,16.5 20.6,11.2" fill="#47C5FB"/>
      <polygon points="12.1,18.7 14.4,21 20.6,21 15.2,15.6" fill="#00569E"/>
      <polygon points="9,16.5 12.1,13.4 15.2,16.5 12.1,19.6" fill="#00B5F8"/>
    </svg>`,

    // ── Kotlin (Official Gradient Ribbon) ──────────────────────────────────
    "kotlin.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <defs>
        <linearGradient id="ktGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#E44857"/>
          <stop offset="50%" stop-color="#C711E1"/>
          <stop offset="100%" stop-color="#7F52FF"/>
        </linearGradient>
      </defs>
      <polygon points="3,3 21,3 12,12 21,21 3,21" fill="url(#ktGrad)"/>
    </svg>`,

    // ── Swift (.swift) ─────────────────────────────────────────────────────
    "swift.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="4.5" fill="#F05138"/>
      <path d="M17.2 14.8c.4-1.8-.1-4.2-2.2-6.2 1 1.6 1.2 3.3.7 4.4-1.6-1.2-3.8-2.9-5.8-4.7.8 1.4 2 2.9 3.2 4-1.5-.8-3.6-2.1-5.1-3.5.7 1.6 2.1 3.4 3.9 4.5-1.6.4-3.5.1-5-.9 1.6 2.1 4.2 3.3 6.8 3.1 1.6-.1 2.9-.8 3.5-1.7.8.4 1.6.4 2.1.1-.4-.4-.8-.7-1.1-1.1z" fill="#FFFFFF"/>
    </svg>`,

    // ── Gradle (build.gradle / settings.gradle) ────────────────────────────
    "gradle.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 2.5L20.5 7v10L12 21.5 3.5 17V7L12 2.5z" fill="#02303A" stroke="#2DD4BF" stroke-width="1.6"/>
      <path d="M8.5 13c0-2.2 1.6-3.8 3.8-3.8 1.5 0 2.8.8 3.3 2h-2.2c-.3-.4-.7-.6-1.2-.6-1.1 0-1.9.9-1.9 2.2s.8 2.2 1.9 2.2c.8 0 1.4-.5 1.6-1.2H12v-1.4h3.9v3.8h-1.5l-.2-.9c-.6.7-1.5 1.1-2.5 1.1-2 0-3.2-1.5-3.2-3.4z" fill="#2DD4BF"/>
    </svg>`,

    // ── HTML5 Shield ───────────────────────────────────────────────────────
    "html.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M3.8 2.2h16.4l-1.5 16.5L12 21.8l-6.7-3.1L3.8 2.2z" fill="#E34F26"/>
      <path d="M12 3.8v16.2l5.4-2.4 1.2-13.8H12z" fill="#EF652A"/>
      <path d="M7 6.8h10l-.2 2.2H9.4l.2 2.3h6.8l-.6 6.4L12 19.2l-3.8-1.5-.3-3.1h2.2l.1 1.5 1.8.6 1.8-.6.2-2.5H7.4L7 6.8z" fill="#FFFFFF"/>
    </svg>`,

    // ── CSS3 Shield ────────────────────────────────────────────────────────
    "css.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M3.8 2.2h16.4l-1.5 16.5L12 21.8l-6.7-3.1L3.8 2.2z" fill="#1572B6"/>
      <path d="M12 3.8v16.2l5.4-2.4 1.2-13.8H12z" fill="#33A9DC"/>
      <path d="M7 6.8h10l-.2 2.2H9.6l.2 2.3h6.6l-.6 6.4L12 19.2l-3.8-1.5-.3-3.1h2.2l.1 1.5 1.8.6 1.8-.6.2-2.5H7.6l-.2-2.2h6.8l.2-2.3H7V6.8z" fill="#FFFFFF"/>
    </svg>`,

    // ── XML / Plist / AndroidManifest ──────────────────────────────────────
    "xml.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 5.5l-3 13" fill="none" stroke="#FB923C" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    // ── JSON (Crisp Amber Braces) ──────────────────────────────────────────
    "json.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M8.5 3.8C6.3 3.8 5.5 5 5.5 6.8v2.6c0 1.4-.8 2.3-2.3 2.3 1.5 0 2.3.9 2.3 2.3v2.6c0 1.8.8 3 3 3" fill="none" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15.5 3.8c2.2 0 3 1.2 3 3v2.6c0 1.4.8 2.3 2.3 2.3-1.5 0-2.3.9-2.3 2.3v2.6c0 1.8-.8 3-3 3" fill="none" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="9.5" r="1.4" fill="#FBBF24"/>
      <circle cx="12" cy="14.5" r="1.4" fill="#FBBF24"/>
    </svg>`,

    // ── Linter / Tool Config (.oxlintrc.json, .eslintrc*, .prettierrc*) ────
    "linter.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <polygon points="12,2 21,7.2 21,16.8 12,22 3,16.8 3,7.2" fill="#4C1D95" stroke="#A78BFA" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="3.5" fill="#C4B5FD"/>
    </svg>`,

    // ── Node.js / package.json ─────────────────────────────────────────────
    "nodejs.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 2L20.8 7v10L12 22 3.2 17V7L12 2z" fill="#539E43"/>
      <path d="M12 2L20.8 7v10L12 22V2z" fill="#68B554"/>
      <path d="M9.3 8.8v6.4l2.7 1.5 2.7-1.5V8.8L12 7.3 9.3 8.8z" fill="#FFFFFF"/>
    </svg>`,

    // ── Vite (vite.config.ts) ──────────────────────────────────────────────
    "vite.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M21.2 4.2L12.4 21.6a.5.5 0 0 1-.9 0L2.8 4.2a.5.5 0 0 1 .6-.7L12 5.4l8.6-1.9a.5.5 0 0 1 .6.7z" fill="#646CFF"/>
      <path d="M15.6 2.2L9 13h3.7l-.8 6.8L18.8 9H15l.6-6.8z" fill="#FFEA83" stroke="#FFA800" stroke-width="0.6" stroke-linejoin="round"/>
    </svg>`,

    // ── Git (.gitignore / .gitattributes) ──────────────────────────────────
    "git.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <rect x="4.5" y="4.5" width="15" height="15" rx="2.6" transform="rotate(45 12 12)" fill="#F05032"/>
      <path d="M9.5 6.8l5.2 5.2M12 9.3v6.2" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="12" cy="9.3" r="1.7" fill="#FFFFFF"/>
      <circle cx="14.7" cy="12" r="1.7" fill="#FFFFFF"/>
      <circle cx="12" cy="15.5" r="1.7" fill="#FFFFFF"/>
    </svg>`,

    // ── Python (.py) ───────────────────────────────────────────────────────
    "python.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M11.9 2.5c-4.2 0-4 1.8-4 1.8v2.2h4.1v.7H6.2S2.5 6.8 2.5 11.8s3.2 4.8 3.2 4.8h1.9v-2.4s-.1-2.8 2.8-2.8h4.7s2.6 0 2.6-2.5V4.8s.4-2.3-5.8-2.3z" fill="#3776AB"/>
      <path d="M12.1 21.5c4.2 0 4-1.8 4-1.8v-2.2H12v-.7h5.8s3.7.4 3.7-4.6-3.2-4.8-3.2-4.8h-1.9v2.4s.1 2.8-2.8 2.8H8.9s-2.6 0-2.6 2.5v4.1s-.4 2.3 5.8 2.3z" fill="#FFD43B"/>
      <circle cx="9.7" cy="5" r="0.9" fill="#FFFFFF"/>
      <circle cx="14.3" cy="19" r="0.9" fill="#1E293B"/>
    </svg>`,

    // ── Rust (.rs / Cargo.toml) ────────────────────────────────────────────
    "rust.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="#F74C00" stroke-width="2.4" stroke-dasharray="2.6 1.5"/>
      <path d="M9 8.5h4.2c1.4 0 2.3.8 2.3 2 0 .9-.6 1.6-1.5 1.8l2 3.2h-2.1l-1.7-3H11v3H9v-7zm2 1.6v1.6h1.8c.5 0 .8-.3.8-.8s-.3-.8-.8-.8H11z" fill="#F74C00"/>
    </svg>`,

    // ── C / C++ (.c, .h, .cpp) ─────────────────────────────────────────────
    "c.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 2.2L20.5 7v10L12 21.8 3.5 17V7L12 2.2z" fill="#3949AB"/>
      <path d="M15.2 14.4a4.2 4.2 0 1 1 0-4.8" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>
    </svg>`,

    // ── Markdown (README.md / .md) ─────────────────────────────────────────
    "md.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2.5" fill="#1E293B" stroke="#38BDF8" stroke-width="1.6"/>
      <path d="M5.5 15.5v-7l2.8 3.5 2.8-3.5v7M16.5 8.5v7m-2.3-2.5l2.3 2.5 2.3-2.5" fill="none" stroke="#38BDF8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    // ── YAML / Config (.yaml, .yml, .toml) ─────────────────────────────────
    "yaml.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <line x1="4" y1="7" x2="20" y2="7" stroke="#F472B6" stroke-width="2" stroke-linecap="round"/>
      <line x1="4" y1="12" x2="20" y2="12" stroke="#F472B6" stroke-width="2" stroke-linecap="round"/>
      <line x1="4" y1="17" x2="20" y2="17" stroke="#F472B6" stroke-width="2" stroke-linecap="round"/>
      <circle cx="9" cy="7" r="2.3" fill="#18181B" stroke="#F472B6" stroke-width="2"/>
      <circle cx="15" cy="12" r="2.3" fill="#18181B" stroke="#F472B6" stroke-width="2"/>
      <circle cx="10" cy="17" r="2.3" fill="#18181B" stroke="#F472B6" stroke-width="2"/>
    </svg>`,

    // ── Lockfile (.lock, package-lock.json, pnpm-lock.yaml) ────────────────
    "lock.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="#D97706"/>
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="15.5" r="1.5" fill="#18181B"/>
    </svg>`,

    // ── Image / SVG (.svg, .png, .jpg, .webp, .ico) ────────────────────────
    "image.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="3" fill="#064E3B" stroke="#34D399" stroke-width="1.6"/>
      <circle cx="8.5" cy="9" r="1.8" fill="#FBBF24"/>
      <path d="M4 17.5l4.8-4.8 3.2 3.2 4.2-4.5 3.8 6.1H4z" fill="#34D399"/>
    </svg>`,

    // ── Shell / Scripts (.sh, .ps1, .bat, .cmd) ────────────────────────────
    "shell.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <rect x="2.5" y="4" width="19" height="16" rx="3" fill="#14261C" stroke="#4ADE80" stroke-width="1.6"/>
      <path d="M7 9l3.5 3L7 15M12.5 15h4.5" fill="none" stroke="#4ADE80" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    // ── SQL / Database (.sql, .sqlite, .db) ────────────────────────────────
    "sql.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <ellipse cx="12" cy="6" rx="7.5" ry="3" fill="#0284C7" stroke="#38BDF8" stroke-width="1.5"/>
      <path d="M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" fill="none" stroke="#38BDF8" stroke-width="1.5"/>
      <path d="M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" fill="none" stroke="#38BDF8" stroke-width="1.5"/>
    </svg>`,
  };

  for (const [name, content] of Object.entries(svgs)) {
    fs.writeFileSync(path.join(iconsDir, name), content, "utf8");
    fs.writeFileSync(path.join(iconsV2Dir, name), content, "utf8");
  }

  const iconDefinitions = {};
  for (const name of Object.keys(svgs)) {
    const id = path.basename(name, ".svg");
    iconDefinitions[id] = { iconPath: `./icons-v2/${name}` };
  }

  const themeJson = {
    iconDefinitions,
    file: "file",
    folder: "folder",
    folderExpanded: "folder-open",
    folderNames: {
      lib: "folder-src",
      src: "folder-src",
      "src-extension": "folder-src",
      "src-tauri": "folder-src",
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
      types: "folder-data",
      assets: "folder-assets",
      public: "folder-assets",
      images: "folder-assets",
      media: "folder-assets",
      fonts: "folder-assets",
      ios: "folder-platform",
      android: "folder-platform",
      macos: "folder-platform",
      windows: "folder-platform",
      linux: "folder-platform",
      web: "folder-platform",
      dist: "folder-platform",
      "dist-extension": "folder-platform",
    },
    folderNamesExpanded: {
      lib: "folder-src-open",
      src: "folder-src-open",
      "src-extension": "folder-src-open",
      "src-tauri": "folder-src-open",
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
      types: "folder-data-open",
      assets: "folder-assets-open",
      public: "folder-assets-open",
      images: "folder-assets-open",
      media: "folder-assets-open",
      fonts: "folder-assets-open",
      ios: "folder-platform-open",
      android: "folder-platform-open",
      macos: "folder-platform-open",
      windows: "folder-platform-open",
      linux: "folder-platform-open",
      web: "folder-platform-open",
      dist: "folder-platform-open",
      "dist-extension": "folder-platform-open",
    },
    fileNames: {
      "package.json": "nodejs",
      "package-lock.json": "lock",
      "pnpm-lock.yaml": "lock",
      "yarn.lock": "lock",
      "pubspec.yaml": "flutter",
      "pubspec.lock": "lock",
      "Cargo.toml": "rust",
      "Cargo.lock": "lock",
      "build.gradle": "gradle",
      "build.gradle.kts": "gradle",
      "settings.gradle": "gradle",
      "settings.gradle.kts": "gradle",
      "gradle.properties": "gradle",
      "AndroidManifest.xml": "xml",
      "Info.plist": "xml",
      "vite.config.ts": "vite",
      "vite.config.js": "vite",
      "vite.config.mjs": "vite",
      "tsconfig.json": "tsconfig",
      "tsconfig.app.json": "tsconfig",
      "tsconfig.node.json": "tsconfig",
      "tsconfig.extension.json": "tsconfig",
      ".oxlintrc.json": "linter",
      ".eslintrc.json": "linter",
      ".eslintrc.js": "linter",
      ".prettierrc": "linter",
      ".prettierrc.json": "linter",
      "analysis_options.yaml": "linter",
      ".gitignore": "git",
      ".gitattributes": "git",
      ".flutter-plugins": "flutter",
      ".flutter-plugins-dependencies": "flutter",
      ".metadata": "flutter",
      "README.md": "md",
      "DEVELOPMENT.md": "md",
      "ELMAS.md": "md",
    },
    fileExtensions: {
      dart: "dart",
      "g.dart": "dart-gen",
      "freezed.dart": "dart-gen",
      ts: "ts",
      "d.ts": "ts",
      tsx: "react-ts",
      jsx: "react",
      js: "js",
      mjs: "js",
      cjs: "js",
      kt: "kotlin",
      kts: "kotlin",
      swift: "swift",
      gradle: "gradle",
      py: "python",
      pyi: "python",
      rs: "rust",
      c: "c",
      h: "c",
      cpp: "c",
      hpp: "c",
      html: "html",
      htm: "html",
      css: "css",
      scss: "css",
      less: "css",
      xml: "xml",
      plist: "xml",
      arb: "json",
      json: "json",
      jsonc: "json",
      yaml: "yaml",
      yml: "yaml",
      toml: "yaml",
      lock: "lock",
      md: "md",
      mdx: "md",
      svg: "image",
      png: "image",
      jpg: "image",
      jpeg: "image",
      webp: "image",
      ico: "image",
      sh: "shell",
      bash: "shell",
      zsh: "shell",
      ps1: "shell",
      bat: "shell",
      cmd: "shell",
      sql: "sql",
      sqlite: "sql",
      db: "sql",
    },
    languageIds: {
      typescript: "ts",
      typescriptreact: "react-ts",
      javascript: "js",
      javascriptreact: "react",
      dart: "dart",
      kotlin: "kotlin",
      swift: "swift",
      python: "python",
      rust: "rust",
      c: "c",
      cpp: "c",
      html: "html",
      css: "css",
      scss: "css",
      xml: "xml",
      json: "json",
      jsonc: "json",
      yaml: "yaml",
      toml: "yaml",
      markdown: "md",
      shellscript: "shell",
      powershell: "shell",
      sql: "sql",
    },
  };

  fs.writeFileSync(path.join(extDir, "elmas-macos-icons.json"), JSON.stringify(themeJson, null, 2), "utf8");

  const pkgJson = {
    name: "elmas-macos-icons",
    displayName: "Elmas Studio — Icônes macOS Sequoia",
    version: "2.0.0",
    publisher: "elmascore",
    engines: { vscode: "^1.80.0" },
    contributes: {
      iconThemes: [
        {
          id: "elmas-macos-sequoia-icons",
          label: "Elmas macOS Sequoia Icons",
          path: "./elmas-macos-icons.json",
        },
        {
          id: "elmas-macos-icons",
          label: "Elmas macOS Sequoia Icons (Legacy)",
          path: "./elmas-macos-icons.json",
        },
      ],
    },
  };

  fs.writeFileSync(path.join(extDir, "package.json"), JSON.stringify(pkgJson, null, 2), "utf8");

  const builtinExtDir = path.join(desktopDir, "resources/app/extensions/elmas-macos-icons");
  fs.cpSync(extDir, builtinExtDir, { recursive: true, force: true });

  const setiIconsDir = path.join(desktopDir, "resources/app/extensions/theme-seti/icons");
  if (fs.existsSync(setiIconsDir)) {
    fs.cpSync(iconsDir, path.join(setiIconsDir, "icons"), { recursive: true, force: true });
    fs.cpSync(iconsV2Dir, path.join(setiIconsDir, "icons-v2"), { recursive: true, force: true });
    fs.writeFileSync(path.join(setiIconsDir, "vs-seti-icon-theme.json"), JSON.stringify(themeJson, null, 2), "utf8");
  }

  const extManifestPath = path.join(desktopDir, "data/extensions/extensions.json");
  if (fs.existsSync(extManifestPath)) {
    try {
      const list = JSON.parse(fs.readFileSync(extManifestPath, "utf8"));
      const normalizedPath = "/" + extDir.replace(/\\/g, "/");
      const entry = {
        identifier: { id: "elmascore.elmas-macos-icons" },
        version: "2.0.0",
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
