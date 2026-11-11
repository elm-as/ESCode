import * as fs from "fs";
import * as path from "path";
import { PolyglotConfig } from "./types";

export interface ResolvedPolyglotTarget {
  name: string;
  command: string;
  mode: "web" | "ansi";
  port?: number;
  watchPatterns: string[];
  interactiveKeys: string[];
}

export function detectPolyglotTarget(projectPath: string): ResolvedPolyglotTarget | null {
  const fromManifest = loadManifestConfig(projectPath);
  if (fromManifest) {
    return fromManifest;
  }
  return detectLanguageFallback(projectPath);
}

function loadManifestConfig(projectPath: string): ResolvedPolyglotTarget | null {
  const candidateFiles = ["elmas.json", ".elmasrc.json", "elmas.config.json"];
  for (const name of candidateFiles) {
    const full = path.join(projectPath, name);
    if (!fs.existsSync(full)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(full, "utf-8")) as {
        preview?: PolyglotConfig;
      };
      const cfg = raw.preview;
      if (!cfg || !cfg.command) continue;
      return {
        name: cfg.name || path.basename(projectPath),
        command: cfg.command,
        mode: cfg.type === "web" ? "web" : "ansi",
        port: cfg.port,
        watchPatterns: cfg.watch || ["**/*"],
        interactiveKeys: cfg.keys || ["SPACE", "r", "q"],
      };
    } catch {
      // Ignore invalid JSON
    }
  }
  return null;
}

function detectLanguageFallback(projectPath: string): ResolvedPolyglotTarget | null {
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

function resolveRustTarget(projectPath: string): ResolvedPolyglotTarget {
  let isWeb = false;
  try {
    const toml = fs.readFileSync(path.join(projectPath, "Cargo.toml"), "utf-8").toLowerCase();
    isWeb = toml.includes("actix") || toml.includes("axum") || toml.includes("rocket") || toml.includes("trunk");
  } catch {}

  return {
    name: `Rust (${path.basename(projectPath)})`,
    command: isWeb ? "cargo run" : "cargo run --quiet",
    mode: isWeb ? "web" : "ansi",
    port: isWeb ? 8080 : undefined,
    watchPatterns: [".rs"],
    interactiveKeys: ["SPACE", "r", "p", "q"],
  };
}

function resolveGoTarget(projectPath: string): ResolvedPolyglotTarget {
  return {
    name: `Go (${path.basename(projectPath)})`,
    command: "go run .",
    mode: "ansi",
    watchPatterns: [".go"],
    interactiveKeys: ["SPACE", "r", "q"],
  };
}

