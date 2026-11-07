"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDartColor = resolveDartColor;
exports.scanFlutterWorkspace = scanFlutterWorkspace;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Converts a Dart Color(0xAARRGGBB), AppTheme.*, or Colors.* token into a CSS color.
 */
function resolveDartColor(raw, theme, fallback = "") {
    if (!raw)
        return fallback;
    if (theme) {
        if (raw.includes("AppTheme.primaryColor") && theme.primaryColor)
            return theme.primaryColor;
        if (raw.includes("AppTheme.primaryLight") && theme.primaryLight)
            return theme.primaryLight;
        if (raw.includes("AppTheme.accentColor") && theme.accentColor)
            return theme.accentColor;
        if (raw.includes("AppTheme.backgroundColor") && theme.scaffoldBg)
            return theme.scaffoldBg;
    }
    const hexMatch = raw.match(/Color\(\s*0x([0-9a-fA-F]{8})\s*\)/);
    if (hexMatch) {
        const hex = hexMatch[1];
        const alpha = parseInt(hex.slice(0, 2), 16) / 255;
        const r = parseInt(hex.slice(2, 4), 16);
        const g = parseInt(hex.slice(4, 6), 16);
        const b = parseInt(hex.slice(6, 8), 16);
        if (alpha >= 0.99)
            return `#${hex.slice(2, 8)}`;
        return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
    }
    const named = {
        "Colors.white70": "rgba(255,255,255,0.7)",
        "Colors.white60": "rgba(255,255,255,0.6)",
        "Colors.white54": "rgba(255,255,255,0.54)",
        "Colors.white": "#ffffff",
        "Colors.black87": "#1f2937",
        "Colors.black54": "#6b7280",
        "Colors.black38": "#9ca3af",
        "Colors.black": "#000000",
        "Colors.redAccent": "#ff5252",
        "Colors.red": "#ef4444",
        "Colors.greenAccent": "#69f0ae",
        "Colors.green": "#22c55e",
        "Colors.orangeAccent": "#ffab40",
        "Colors.orange": "#f97316",
        "Colors.amber": "#f59e0b",
        "Colors.blue": "#3b82f6",
        "Colors.grey": "#9ca3af",
    };
    for (const [k, v] of Object.entries(named)) {
        if (raw.includes(k))
            return v;
    }
    return fallback;
}
function collectDartFiles(dir, out = []) {
    if (!fs.existsSync(dir))
        return out;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectDartFiles(full, out);
        }
        else if (entry.isFile() && entry.name.endsWith(".dart") && !entry.name.endsWith(".g.dart")) {
            out.push(full);
        }
    }
    return out;
}
function readSourceWithMemory(filePath, memoryBuffers) {
    const key = path.resolve(filePath).toLowerCase();
    if (memoryBuffers.has(key)) {
        return memoryBuffers.get(key);
    }
    try {
        return fs.readFileSync(filePath, "utf-8");
    }
    catch {
        return "";
    }
}
function extractConstColor(source, fieldName, fallback) {
    const regex = new RegExp(`${fieldName}\\s*=\\s*([^;\\n]+)`, "i");
    const match = source.match(regex);
    if (!match)
        return fallback;
    return resolveDartColor(match[1], undefined, fallback);
}
function formatScreenShortLabel(className) {
    const cleaned = className
        .replace(/Screen$/, "")
        .replace(/Page$/, "")
        .replace(/Dashboard$/, "")
        .replace(/^Mobile/, "");
    const map = {
        Lock: "Verrouillage",
        PlantationSelection: "Plantations",
        Home: "Accueil",
        AddHarvest: "Pesée",
        Saigneur: "Saigneurs",
        SaigneurDetail: "Détail Saigneur",
        AddExpense: "Dépenses",
        ExpenseHistory: "Hist. Dépenses",
        Accounting: "Bilan",
        MonthlyReport: "Rapport",
        SalesHistory: "Ventes",
        Settings: "Paramètres",
    };
    return map[cleaned] || cleaned || className;
}
/**
 * Scans the entire Flutter project's lib/ folder (merging unsaved in-memory editor buffers)
 * to discover theme tokens and all previewable Screen widgets.
 */
function scanFlutterWorkspace(projectPath, memoryBuffers, preferredScreenIdOrPath) {
    const libDir = path.join(projectPath, "lib");
    const dartFiles = collectDartFiles(libDir);
    let allSourcesJoined = "";
    const fileMap = new Map();
    for (const file of dartFiles) {
        const content = readSourceWithMemory(file, memoryBuffers);
        fileMap.set(file, content);
        allSourcesJoined += "\n" + content;
    }
    const mainPath = path.join(libDir, "main.dart");
    const mainSource = fileMap.get(mainPath) || "";
    const isDark = mainSource.includes("ThemeData.dark") ||
        (!allSourcesJoined.includes("lightTheme") && mainSource.includes("0xFF09090B"));
    const primaryColor = extractConstColor(allSourcesJoined, "primaryColor", "#0284c7");
    const primaryLight = extractConstColor(allSourcesJoined, "primaryLight", "#38bdf8");
    const accentColor = extractConstColor(allSourcesJoined, "accentColor", "#c6ff00");
    const defaultBg = isDark ? "#09090b" : "#f0f4f4";
    let scaffoldBg = extractConstColor(allSourcesJoined, "backgroundColor", defaultBg);
    const inlineScaffoldBg = mainSource.match(/scaffoldBackgroundColor\s*:\s*(?:const\s+)?(Color\([^)]+\)|Colors\.[a-zA-Z]+)/);
    if (inlineScaffoldBg) {
        scaffoldBg = resolveDartColor(inlineScaffoldBg[1], undefined, scaffoldBg);
    }
    const showDebugBanner = !mainSource.includes("debugShowCheckedModeBanner: false");
    const titleMatch = mainSource.match(/title\s*:\s*(['"])([^'"]+)\1/);
    const appTitle = titleMatch ? titleMatch[2] : "Flutter App";
    const theme = {
        primaryColor,
        primaryLight,
        accentColor,
        scaffoldBg,
        cardColor: isDark ? "#18181b" : "#ffffff",
        isDark,
        showDebugBanner,
        appTitle,
    };
    const screens = [];
    for (const [filePath, source] of fileMap.entries()) {
        const hasScaffold = source.includes("Scaffold(") || source.includes("SliverAppBar(");
        if (!hasScaffold)
            continue;
        const classMatch = source.match(/class\s+([A-Za-z0-9_]+)\s+extends\s+(?:StatelessWidget|StatefulWidget|ConsumerWidget|ConsumerStatefulWidget)/);
        if (!classMatch)
            continue;
        const className = classMatch[1];
        screens.push({
            id: className,
            className,
            shortLabel: formatScreenShortLabel(className),
            filePath,
            source,
        });
    }
    const homeMatch = mainSource.match(/home\s*:\s*(?:const\s+)?([A-Za-z0-9_]+)\s*\(/);
    const homeClassName = homeMatch ? homeMatch[1] : null;
    screens.sort((a, b) => {
        if (a.className === homeClassName)
            return -1;
        if (b.className === homeClassName)
            return 1;
        if (a.className.includes("Home"))
            return -1;
        if (b.className.includes("Home"))
            return 1;
        return a.shortLabel.localeCompare(b.shortLabel);
    });
    let activeScreen = screens[0] || null;
    if (preferredScreenIdOrPath) {
        const normPref = preferredScreenIdOrPath.toLowerCase();
        const byId = screens.find((s) => s.id.toLowerCase() === normPref);
        const byPath = screens.find((s) => path.resolve(s.filePath).toLowerCase() === normPref);
        if (byId)
            activeScreen = byId;
        else if (byPath)
            activeScreen = byPath;
    }
    return { theme, screens, activeScreen };
}
//# sourceMappingURL=flutter-project-scanner.js.map