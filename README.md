# ELMAS STUDIO

> **Professional, Lightweight, Multi-Framework Desktop IDE with Real-Time Mobile Preview**
> *Built with Tauri 2, Rust, React 19, TypeScript, Vite, Tailwind CSS, Monaco Editor, and embedded SQLite.*

---

## 1. Overview & Vision

**Elmas Studio** is an engineering development environment dedicated to mobile user interface development with immediate visual feedback across four major frameworks:

1. **React Web** (Vite HMR fast preview)
2. **React Native** (Expo Web fast preview + Metro / Android ADB native)
3. **Flutter** (Flutter Web engine fast preview + Android ART native)
4. **Kotlin / Jetpack Compose** (Compose Desktop fast preview + Android Gradle native)

### Core Innovation: Fast Preview vs. Native Preview
- **FAST PREVIEW**: Zero emulator overhead. Runs lightweight framework web/desktop targets on dynamic ephemeral ports with sub-second HMR. No full Android phone emulator required for UI design and component layout.
- **NATIVE PREVIEW**: Connects real Android SDK tooling, ADB, and Android ART runtimes for native C++ bindings, system permissions, and device APIs.
- **Zero Simulation Confusion**: The IDE explicitly communicates when a feature is simulated versus natively executed. Simulated results are never disguised as native results.

---

## 2. Architecture & Domain Organization

The codebase follows the strict domain-driven architecture chartered in `ELMAS.md`:

```
Scar/
├── src-tauri/                       # Rust Backend (Process, DB, Toolchain)
│   ├── src/
│   │   ├── database/               # Embedded SQLite with migrations & profile seeders
│   │   ├── filesystem/             # Bounded recursive directory reader & safe CRUD
│   │   ├── process_manager/        # Port allocator, process lifecycle & tree cleanup
│   │   ├── sdk_detector/           # Toolchain scanner (Flutter, Dart, Java, Gradle, ADB)
│   │   ├── commands/               # Tauri IPC command dispatchers & project detection
│   │   └── lib.rs                  # Application builder & clean exit orchestrator
│   └── Cargo.toml
├── src/                             # Frontend Desktop Shell (React 19 + TypeScript)
│   ├── domains/
│   │   ├── editor/                 # Monaco Editor integration, tabs, breadcrumbs, settings
│   │   ├── preview/                # Virtual device frame, bezel, status bar, touch reticle
│   │   ├── projects/               # File explorer, project detection & workspace state
│   │   ├── adapters/               # Common framework adapters (React Web, RN, Flutter, Kotlin)
│   │   ├── sdk/                    # SDK Manager modal & toolchain status display
│   │   ├── diagnostics/            # Unified error model with click-to-line code navigation
│   │   └── terminal/               # Real-time process stdout/stderr stream viewer
│   ├── App.tsx                     # Unified 3-pane IDE layout & header
│   └── index.css                   # High-density engineering design system
└── test-projects/                   # Standalone sample projects for automated validation
    └── react-web-mobile/           # Working mobile React demo project
```

---

## 3. Key Capabilities

- **Virtual Mobile Device Surface**:
  - Profiles: Compact (360×800), iPhone SE (375×812), Flagship (390×844), Pixel 8 (412×915), Pro Max (432×960).
  - Dynamic aspect ratio swapping for Portrait / Landscape.
  - Realistic bezel, front camera pill, simulated status bar with real-time tabular clock, and navigation bar.
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

## 4. Development & Verification

### Prerequisites
- **Rust**: 1.80+ (MSVC toolchain on Windows)
- **Node.js**: v20+ with `pnpm`
- *(Optional)* Flutter SDK, Android SDK & ADB for native preview execution.

### Running Automated Tests
```powershell
# Run Rust backend unit and integration tests (DB, Port Allocator, Project Detection)
cargo test --manifest-path src-tauri/Cargo.toml

# Run TypeScript typecheck and Vite frontend build
pnpm build
```

### Launching the Desktop Application in Development Mode
```powershell
pnpm tauri dev
```

### Building Release Package
```powershell
pnpm tauri build
```
