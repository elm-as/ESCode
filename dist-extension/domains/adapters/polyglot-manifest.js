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
exports.detectPolyglotTarget = detectPolyglotTarget;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function detectPolyglotTarget(projectPath) {
    const fromManifest = loadManifestConfig(projectPath);
    if (fromManifest) {
        return fromManifest;
    }
    return detectLanguageFallback(projectPath);
}
function loadManifestConfig(projectPath) {
    const candidateFiles = ["elmas.json", ".elmasrc.json", "elmas.config.json"];
    for (const name of candidateFiles) {
        const full = path.join(projectPath, name);
        if (!fs.existsSync(full))
            continue;
        try {
            const raw = JSON.parse(fs.readFileSync(full, "utf-8"));
            const cfg = raw.preview;
            if (!cfg || !cfg.command)
                continue;
            return {
                name: cfg.name || path.basename(projectPath),
                command: cfg.command,
                mode: cfg.type === "web" ? "web" : "ansi",
                port: cfg.port,
                watchPatterns: cfg.watch || ["**/*"],
                interactiveKeys: cfg.keys || ["SPACE", "r", "q"],
            };
        }
        catch {
            // Ignore invalid JSON
        }
    }
    return null;
}
function detectLanguageFallback(projectPath) {
    if (fs.existsSync(path.join(projectPath, "Cargo.toml"))) {
        return resolveRustTarget(projectPath);
    }
    if (fs.existsSync(path.join(projectPath, "go.mod"))) {
        return resolveGoTarget(projectPath);
    }
    if (fs.existsSync(path.join(projectPath, "build.zig"))) {
        return {
            name: `Zig (${path.basename(projectPath)})`,
            command: "zig build run",
            mode: "ansi",
            watchPatterns: [".zig"],
            interactiveKeys: ["SPACE", "r", "q"],
        };
    }
    if (fs.existsSync(path.join(projectPath, "CMakeLists.txt"))) {
        return {
            name: `C++ CMake (${path.basename(projectPath)})`,
            command: "cmake --build build && ./build/app",
            mode: "ansi",
            watchPatterns: [".cpp", ".hpp", ".c", ".h"],
            interactiveKeys: ["SPACE", "r", "q"],
        };
    }
    return null;
}
function resolveRustTarget(projectPath) {
    let isWeb = false;
    try {
        const toml = fs.readFileSync(path.join(projectPath, "Cargo.toml"), "utf-8").toLowerCase();
        isWeb = toml.includes("actix") || toml.includes("axum") || toml.includes("rocket") || toml.includes("trunk");
    }
    catch { }
    return {
        name: `Rust (${path.basename(projectPath)})`,
        command: isWeb ? "cargo run" : "cargo run --quiet",
        mode: isWeb ? "web" : "ansi",
        port: isWeb ? 8080 : undefined,
        watchPatterns: [".rs"],
        interactiveKeys: ["SPACE", "r", "p", "q"],
    };
}
function resolveGoTarget(projectPath) {
    return {
        name: `Go (${path.basename(projectPath)})`,
        command: "go run .",
        mode: "ansi",
        watchPatterns: [".go"],
        interactiveKeys: ["SPACE", "r", "q"],
    };
}
//# sourceMappingURL=polyglot-manifest.js.map