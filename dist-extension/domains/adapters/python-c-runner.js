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
exports.resolvePythonExe = resolvePythonExe;
exports.resolveGccExe = resolveGccExe;
exports.discoverWorkspaceScripts = discoverWorkspaceScripts;
exports.spawnPygameStream = spawnPygameStream;
exports.spawnAnsiStream = spawnAnsiStream;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const PYTHON_CANDIDATES = [
    "C:\\Users\\elmas\\AppData\\Local\\Programs\\Python\\Python310\\python.exe",
    "C:\\Users\\elmas\\AppData\\Local\\Python\\pythoncore-3.12-64\\python.exe",
    "C:\\Users\\elmas\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe",
    "python",
];
const GCC_CANDIDATES = [
    "C:\\msys64\\ucrt64\\bin\\gcc.exe",
    "C:\\msys64\\mingw64\\bin\\gcc.exe",
    "gcc",
];
function resolvePythonExe() {
    for (const candidate of PYTHON_CANDIDATES) {
        if (candidate === "python" || fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return "python";
}
function resolveGccExe() {
    for (const candidate of GCC_CANDIDATES) {
        if (candidate === "gcc" || fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return "gcc";
}
function discoverWorkspaceScripts(workspacePath) {
    const results = [];
    if (!fs.existsSync(workspacePath)) {
        return results;
    }
    const inspectFile = (fullPath) => {
        const ext = path.extname(fullPath).toLowerCase();
        if (ext !== ".py" && ext !== ".c")
            return;
        const relPath = path.relative(workspacePath, fullPath).replace(/\\/g, "/");
        if (ext === ".c") {
            const siblingVoir = path.join(path.dirname(fullPath), "voir.py");
            if (fs.existsSync(siblingVoir)) {
                return;
            }
            results.push({ relPath, fullPath, kind: "c_ansi" });
            return;
        }
        try {
            const content = fs.readFileSync(fullPath, "utf-8");
            const isPygame = content.includes("import pygame") || content.includes("from pygame");
            results.push({
                relPath,
                fullPath,
                kind: isPygame ? "pygame" : "python_cli",
            });
        }
        catch {
            results.push({ relPath, fullPath, kind: "python_cli" });
        }
    };
    const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "__pycache__") {
            continue;
        }
        const full = path.join(workspacePath, entry.name);
        if (entry.isFile()) {
            inspectFile(full);
        }
        else if (entry.isDirectory()) {
            try {
                const subEntries = fs.readdirSync(full, { withFileTypes: true });
                for (const sub of subEntries) {
                    if (sub.isFile()) {
                        inspectFile(path.join(full, sub.name));
                    }
                }
            }
            catch {
                // Ignore unreadable subfolder
            }
        }
    }
    return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}
const PYGAME_BOOTSTRAP = `
import os, sys, io, time, threading
os.environ['SDL_VIDEODRIVER'] = 'dummy'
os.environ['SDL_AUDIODRIVER'] = 'dummy'
import pygame

script_path = sys.argv[1]
script_dir = os.path.dirname(os.path.abspath(script_path))
os.chdir(script_dir)
sys.path.insert(0, script_dir)
sys.argv = [script_path, '--plein']

_orig_flip = pygame.display.flip
_orig_update = pygame.display.update
_last_emit = 0.0
_out = sys.stdout.buffer

def _emit_surface():
    global _last_emit
    now = time.perf_counter()
    if now - _last_emit < 0.036:
        return
    _last_emit = now
    surf = pygame.display.get_surface()
    if surf is None:
        return
    try:
        buf = io.BytesIO()
        pygame.image.save(surf, buf, 'JPEG')
        data = buf.getvalue()
        header = b'ELMFRAME' + len(data).to_bytes(4, 'big')
        _out.write(header + data)
        _out.flush()
    except Exception:
        pass

def _hook_flip():
    _orig_flip()
    _emit_surface()

def _hook_update(*args, **kwargs):
    _orig_update(*args, **kwargs)
    _emit_surface()

pygame.display.flip = _hook_flip
pygame.display.update = _hook_update

def _stdin_reader():
    for line in sys.stdin:
        cmd = line.strip()
        if cmd == 'KEY:SPACE':
            pygame.event.post(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_SPACE, unicode=' '))
        elif cmd == 'KEY:p':
            pygame.event.post(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_p, unicode='p'))
        elif cmd == 'KEY:r':
            pygame.event.post(pygame.event.Event(pygame.KEYDOWN, key=pygame.K_r, unicode='r'))
        elif cmd.startswith('CLICK:'):
            parts = cmd.split(':')[1].split(',')
            if len(parts) == 2:
                try:
                    px, py = int(float(parts[0])), int(float(parts[1]))
                    pygame.event.post(pygame.event.Event(pygame.MOUSEBUTTONDOWN, pos=(px, py), button=1))
                    pygame.event.post(pygame.event.Event(pygame.MOUSEBUTTONUP, pos=(px, py), button=1))
                except Exception:
                    pass

threading.Thread(target=_stdin_reader, daemon=True).start()
with open(script_path, 'r', encoding='utf-8') as f:
    code = compile(f.read(), script_path, 'exec')
    exec(code, {'__name__': '__main__', '__file__': script_path})
`;
function spawnPygameStream(scriptFullPath, onFrame, onErrorText) {
    const scriptDir = path.dirname(scriptFullPath);
    const infiniC = path.join(scriptDir, "infini.c");
    const infiniExe = path.join(scriptDir, "infini.exe");
    if (fs.existsSync(infiniC) && !fs.existsSync(infiniExe)) {
        (0, child_process_1.spawnSync)(resolveGccExe(), [infiniC, "-o", infiniExe, "-O3", "-lm", "-fopenmp"], {
            cwd: scriptDir,
            windowsHide: true,
        });
    }
    const child = (0, child_process_1.spawn)(resolvePythonExe(), ["-u", "-c", PYGAME_BOOTSTRAP, scriptFullPath], {
        cwd: scriptDir,
        windowsHide: true,
    });
    let acc = Buffer.alloc(0);
    const marker = Buffer.from("ELMFRAME");
    child.stdout?.on("data", (chunk) => {
        acc = Buffer.concat([acc, chunk]);
        if (acc.length > 5 * 1024 * 1024) {
            acc = Buffer.alloc(0);
            return;
        }
        while (true) {
            const idx = acc.indexOf(marker);
            if (idx === -1 || acc.length < idx + 12) {
                break;
            }
            const frameLen = acc.readUInt32BE(idx + 8);
            if (acc.length < idx + 12 + frameLen) {
                break;
            }
            const jpeg = acc.subarray(idx + 12, idx + 12 + frameLen);
            onFrame(jpeg);
            acc = acc.subarray(idx + 12 + frameLen);
        }
    });
    child.stderr?.on("data", (chunk) => {
        const txt = chunk.toString("utf-8").trim();
        if (txt && !txt.includes("pygame community")) {
            onErrorText(txt);
        }
    });
    return child;
}
function spawnAnsiStream(entry, onAnsiHtml) {
    const scriptDir = path.dirname(entry.fullPath);
    let child;
    if (entry.kind === "c_ansi") {
        const outExe = path.join(scriptDir, `${path.basename(entry.fullPath, ".c")}_sim.exe`);
        const compile = (0, child_process_1.spawnSync)(resolveGccExe(), [entry.fullPath, "-o", outExe, "-O2", "-lm"], {
            cwd: scriptDir,
            windowsHide: true,
        });
        if (compile.status !== 0) {
            onAnsiHtml(`<span style="color:#f87171">Erreur GCC :\n${compile.stderr?.toString() || ""}</span>`);
            return null;
        }
        child = (0, child_process_1.spawn)(outExe, ["Elmas Studio", "42", "36"], { cwd: scriptDir, windowsHide: true });
    }
    else {
        child = (0, child_process_1.spawn)(resolvePythonExe(), ["-u", entry.fullPath], {
            cwd: scriptDir,
            windowsHide: true,
        });
    }
    let textBuf = "";
    child.stdout?.on("data", (chunk) => {
        const str = chunk.toString("utf-8");
        if (str.includes("\x1b[H")) {
            const parts = str.split("\x1b[H");
            textBuf = parts[parts.length - 1];
        }
        else {
            textBuf = (textBuf + str).slice(-6000);
        }
        onAnsiHtml(ansi256ToHtml(textBuf));
    });
    child.stderr?.on("data", (chunk) => {
        onAnsiHtml(`<span style="color:#fbbf24">${ansi256ToHtml(chunk.toString("utf-8"))}</span>`);
    });
    return child;
}
function ansi256ToHtml(raw) {
    const cleaned = raw
        .replace(/\x1b\[K/g, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    let openSpan = false;
    return (cleaned.replace(/\x1b\[([0-9;]+)m/g, (_m, codeStr) => {
        if (codeStr === "0") {
            if (!openSpan)
                return "";
            openSpan = false;
            return "</span>";
        }
        const m256 = codeStr.match(/38;5;(\d+)/);
        if (m256) {
            const color = xterm256ToHex(Number(m256[1]));
            const prefix = openSpan ? "</span>" : "";
            openSpan = true;
            return `${prefix}<span style="color:${color}">`;
        }
        return "";
    }) + (openSpan ? "</span>" : ""));
}
function xterm256ToHex(n) {
    if (n >= 16 && n <= 231) {
        const idx = n - 16;
        const r = Math.floor(idx / 36);
        const g = Math.floor((idx % 36) / 6);
        const b = idx % 6;
        const conv = (v) => (v === 0 ? 0 : 55 + v * 40);
        return `rgb(${conv(r)},${conv(g)},${conv(b)})`;
    }
    if (n >= 232 && n <= 255) {
        const gray = 8 + (n - 232) * 10;
        return `rgb(${gray},${gray},${gray})`;
    }
    return "#f4f4f5";
}
//# sourceMappingURL=python-c-runner.js.map