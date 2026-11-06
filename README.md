# ELMAS STUDIO

> **Professional, Lightweight, Multi-Framework Desktop IDE with Real-Time Mobile Preview**
> *Dual Distribution: Standalone VSCodium-based Core IDE & Tauri 2 Rust Shell.*

---

## 1. Overview & Vision

**Elmas Studio** is an engineering development environment dedicated to mobile user interface development with immediate visual feedback across five execution targets:

1. **Vanilla Web** (Raw HTML5, CSS3, JavaScript ES6+, WebAssembly — zero config, instant live reload)
2. **React Web** (Vite HMR fast preview)
3. **React Native** (Expo Web fast preview + Metro / Android ADB native)
4. **Flutter** (Flutter Web engine fast preview + Android ART native)
5. **Kotlin / Jetpack Compose** (Compose Desktop fast preview + Android Gradle native)

### Core Innovation: Fast Preview vs. Native Preview
- **FAST PREVIEW**: Zero emulator overhead. Runs lightweight framework web/desktop targets on dynamic ephemeral ports with sub-second HMR. No full Android phone emulator required for UI design and component layout.
- **NATIVE PREVIEW**: Connects real Android SDK tooling, ADB, and Android ART runtimes for native C++ bindings, system permissions, and device APIs.
- **Zero Simulation Confusion**: The IDE explicitly communicates when a feature is simulated versus natively executed. Simulated results are never disguised as native results.

---

## 2. Launching Elmas Studio

You have two powerful execution models:

### Option A: Standalone Elmas Studio IDE (Recommended)
Self-contained, portable desktop IDE with full Monaco editor, terminal, Git, and the **Elmas Studio Mobile Core** extension pre-bundled:

```powershell
# Launch Elmas Studio opening current workspace
pnpm run start:studio

# Or double-click the portable executable:
.\Elmas-Studio-Desktop\Elmas Studio.exe
```

*Note: If setting up on a fresh machine without pre-downloaded binaries, run:*
```powershell
pnpm run setup:standalone
```

### Option B: Tauri 2 + Rust Desktop Shell
Lightweight native Tauri 2 desktop shell with embedded SQLite persistence and docking layout:

```powershell
# Launch Tauri dev server
pnpm tauri dev

# Run Rust backend test suite (8 tests)
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 3. Architecture & Domain Organization

The codebase follows the strict domain-driven architecture chartered in `ELMAS.md`:

```
Scar/
├── Elmas-Studio-Desktop/            # Standalone portable distribution (VSCodium core + Elmas extension)
│   ├── Elmas Studio.exe            # Branded portable desktop executable
│   └── data/extensions/elmas-studio-core/ # Pre-bundled mobile core extension
├── src-extension/                   # Mobile Preview Extension source code (TypeScript)
│   ├── domains/
│   │   ├── adapters/               # Common framework adapters (React Web, RN, Flutter, Kotlin)
│   │   ├── preview/                # Mobile Virtual Device webview & device frames
│   │   ├── process/                # Port allocator & process tree killer
│   │   └── sdk/                    # System SDK & Android SDK detector
│   └── extension.ts                # Activation, status bar items & commands
├── src-tauri/                       # Rust Backend (Process, DB, Toolchain)
│   ├── src/
│   │   ├── database/               # Embedded SQLite with migrations & profile seeders
│   │   ├── filesystem/             # Bounded recursive directory reader & safe CRUD
│   │   ├── process_manager/        # Port allocator, process lifecycle & tree cleanup
│   │   ├── sdk_detector/           # Toolchain scanner (Flutter, Dart, Java, Gradle, ADB)
│   │   ├── commands/               # Tauri IPC command dispatchers & project detection
│   │   └── lib.rs                  # Application builder & clean exit orchestrator
│   └── Cargo.toml
├── src/                             # Tauri Web Client (React 19, TypeScript, Dockview)
│   ├── domains/                    # Editor, Preview, Projects, SDK, Diagnostics, Terminal
│   ├── App.tsx                     # Unified 3-pane IDE layout & header
│   └── index.css                   # High-density engineering design system
└── test-projects/                   # Standalone sample projects for all frameworks
    ├── vanilla-html-mobile/        # Zero-dep HTML5 / CSS3 / ES6 / Wasm with SSE live reload
    ├── react-web-mobile/           # React 19 + Vite mobile demo (boots in ~600ms)
    ├── react-native-mobile/        # Expo / React Native project structure
    ├── flutter-mobile/             # Flutter project structure (pubspec.yaml & lib/main.dart)
    └── kotlin-compose-mobile/      # Compose Desktop structure (build.gradle.kts & Main.kt)
```

---

## 4. Key Capabilities

- **Virtual Mobile Device Surface**:
  - Profiles: Compact (360×800), iPhone SE (375×812), Flagship (390×844), Pixel 8 (412×915), Pro Max (432×960), and custom dimensions.
  - Dynamic aspect ratio swapping for Portrait / Landscape.
  - Realistic bezel, front camera pill, simulated status bar with real-time tabular clock, and gesture bar.
  - Touch interaction overlay with visual touch reticle.
  - Zoom controls (75%, 85%, 100%) and instant screenshot trigger.
- **Monaco Code Editor**:
  - Full syntax highlighting for TypeScript, JavaScript, JSX, TSX, Dart, Kotlin, XML, JSON, CSS, Markdown.
  - Multi-tab management, dirty state indicators (`•`), `Ctrl+S` save handling.
  - Direct jump to source file and line from Diagnostics/Problems view.
- **Safe Process & Port Orchestration**:
  - Automatically queries the OS for free ephemeral ports (`127.0.0.1:0`) to eliminate port collisions.
  - Terminates full process trees on Windows (`taskkill /F /T /PID`) preventing orphaned background processes.
- **Embedded Persistence**:
  - SQLite database embedded with zero external DLL requirements (`rusqlite` bundled).
  - Persists device profiles, user settings, and recent workspaces.

---

## 5. Development & Verification

### Prerequisites
- **Node.js**: v20+ with `pnpm`
- **Rust**: 1.80+ (MSVC toolchain on Windows)
- *(Optional)* Flutter SDK, Android SDK & ADB for native preview execution.

### Automated Test Suite
```powershell
# Run Rust backend unit and integration tests (8 tests passing)
cargo test --manifest-path src-tauri/Cargo.toml

# Compile Elmas Studio Core Extension
pnpm run build:extension

# Build Tauri Web Frontend
pnpm run build
```

```
