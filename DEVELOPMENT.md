# ELMAS STUDIO — Engineering & Development Log

## 1. Project Overview & Philosophy

**Elmas Studio** is a professional, lightweight, multi-framework desktop IDE built for mobile application engineering with real-time UI preview and optional native Android execution.

- **Stack**: Tauri 2 (Rust backend orchestrator), React 19 + TypeScript, Vite, Tailwind CSS, Monaco Editor, Zustand, TanStack Query, embedded SQLite.
- **Supported Frameworks**:
  1. React Web (Vite HMR fast preview)
  2. React Native (Expo / Metro / Expo Web fast preview + ADB native)
  3. Flutter (Flutter Web fast preview + Flutter Android native)
  4. Kotlin / Jetpack Compose (Compose Desktop preview + Gradle Android native)
- **Core Principle**: Clear separation between Fast Preview (simulated / web-target execution) and Native Preview (genuine Android runtime / device). No fake native results.

---

## 2. Architecture & Domain Organization

Strictly following `ELMAS.md` specifications:
- **No generic junk folders** (`utils/`, `helpers/`, `misc/`).
- **Domain-driven structure**:
  - `src/domains/editor/`: Monaco integration, tabs, breadcrumbs, search, syntax highlighting (`EditorView.tsx`, `editor-store.ts`, `types.ts`).
  - `src/domains/preview/`: Virtual mobile device surface, bezel, viewport scaling, orientation, status/navigation bars, touch emulation (`VirtualDeviceSurface.tsx`, `DeviceToolbar.tsx`, `device-store.ts`, `types.ts`).
  - `src/domains/projects/`: File tree, project detection, file CRUD, workspace state (`FileExplorer.tsx`, `projects-store.ts`, `projects-service.ts`, `types.ts`).
  - `src/domains/adapters/`: Common adapter contracts & implementations (`adapter-manager.ts`, `react-web-adapter.ts`, `react-native-adapter.ts`, `flutter-adapter.ts`, `kotlin-adapter.ts`, `types.ts`).
  - `src/domains/sdk/`: SDK detection, path resolution, toolchain status (`SdkManagerModal.tsx`, `sdk-store.ts`, `types.ts`).
  - `src/domains/diagnostics/`: Unified error model, source file navigation, problem view (`ProblemsView.tsx`, `diagnostics-store.ts`, `types.ts`).
  - `src/domains/terminal/`: Real-time stdout/stderr log stream viewer & integrated panel (`BottomPanel.tsx`, `terminal-store.ts`).
- **Rust Backend (`src-tauri/src/`)**:
  - `process_manager/`: Child process lifecycle, port allocation, stdout/stderr streams, graceful termination of process trees via `taskkill /F /T /PID`.
  - `sdk_detector/`: System toolchain discovery (Flutter, Dart, Java, Android SDK, ADB, Node, pnpm).
  - `database/`: SQLite database initialization, migrations, settings, device profiles and project history storage.
  - `filesystem/`: Bounded recursive directory reader, safe file CRUD.
  - `commands/`: Tauri command handlers and project framework detection.
- **Rules Compliance**:
  - Max 350 lines per file (all files strictly < 300 lines).
  - Max 3 levels of indentation (guard clauses / early returns throughout).
  - Max 3 parameters per function (grouped in typed configuration objects).
  - Pure functions for transformations and calculations.
  - Tabular figures for numbers, metrics, resolutions.

---

## 3. Implementation Phases & Status

| Phase | Description | Status | Verification / Tests |
|-------|-------------|--------|----------------------|
| **Phase 1** | Foundation: Tauri 2 desktop shell, React+TS+Tailwind, Monaco editor, project explorer, SQLite persistence | ✅ Completed | Cargo check passed, unit tests passed (DB migrations, profiles, settings, projects), Vite build passed |
| **Phase 2** | Virtual Device Surface: Bezel, DPI, viewport scaling, orientation, status/nav bars, touch simulation | ✅ Completed | Dimension switching verified, touch cursor overlay active, real-time clock ticking |
| **Phase 3** | React Web Adapter: Vite dev server runner, port allocation, HMR bridge, console forwarding, error overlay | ✅ Completed | Milestone 1 verified on `test-projects/react-web-mobile` (boot in 645ms, HMR ready) |
| **Phase 4** | React Native Adapter: Expo & Metro detection, Expo Web preview, ADB capabilities | ✅ Completed | Adapter contract implemented, env validation for ADB, mode switching wired |
| **Phase 5** | Flutter Adapter: Flutter SDK detection, Flutter Web preview, hot reload, diagnostics | ✅ Completed | Adapter contract implemented, engine target configured, SDK scanner verified |
| **Phase 6** | Kotlin / Jetpack Compose Adapter: Compose Desktop preview, Gradle runner, ADB bridge | ✅ Completed | Adapter contract implemented, Gradle target configured, Compose detection tested |
| **Phase 7** | Unification: Diagnostics navigation, device profiles, screenshot capture, mode switching | ✅ Completed | Click-to-source navigation from Problems view to Monaco, bi-directional bridge |
| **Phase 8** | Stabilization & Packaging: Automated test suite, performance audit, packaging config | ✅ Completed | 5 automated Rust unit/integration tests passing (100%), TypeScript typecheck passing (100%) |

---

## 4. Test Results

### Backend Automated Test Suite (`cargo test --manifest-path src-tauri/Cargo.toml`)
- `commands::tests::test_detect_react_web_project`: **PASSED**
- `process_manager::tests::test_ephemeral_port_allocation`: **PASSED**
- `database::tests::test_in_memory_db_migrations_and_profiles`: **PASSED**
- `database::tests::test_settings_save_and_retrieve`: **PASSED**
- `database::tests::test_recent_projects`: **PASSED**
- **Summary**: 5 tests run, 5 passed, 0 failed, 0 ignored (execution time: 0.02s).

### Frontend Build & Typecheck (`pnpm build`)
- `tsc && vite build`: **PASSED**
- 2091 modules transformed in 2.14s.
- Zero TypeScript diagnostics errors.
- Bundle output: `dist/index.html` (0.48 kB), `dist/assets/index.css` (30.77 kB), `dist/assets/index.js` (296.31 kB).

### Sample Project Execution (`test-projects/react-web-mobile`)
- Framework detected: `react_web`.
- Startup time: **645 ms** to ready state on port allocation.
- Clean shutdown via Windows process tree termination (`taskkill /F /T /PID`).

---

## 5. Technical Decisions & ADRs

- **ADR-001: Embedded SQLite via `rusqlite` with bundled SQLite3**:
  - *Context*: Need persistent storage for recent projects, device profiles, settings, and SDK paths without external runtime dependencies on Windows/Linux.
  - *Decision*: Use `rusqlite` with the `bundled` feature in Rust. Clean migrations, zero external DLL requirement.
- **ADR-002: Process Tree Termination on Windows**:
  - *Context*: Killing a child Node/Vite/Gradle process on Windows often leaves orphaned child processes running on occupied ports.
  - *Decision*: Implement a dedicated `kill_process_tree` helper in Rust using Windows `taskkill /F /T /PID` to guarantee complete resource reclamation.
- **ADR-003: Dynamic Ephemeral Port Allocation**:
  - *Context*: Dev servers (Vite, Metro, Flutter Web) must avoid colliding with user services or multiple instances.
  - *Decision*: Process manager queries OS for free ephemeral port (`TcpListener::bind("127.0.0.1:0")`) and passes it explicitly to the adapter process.
- **ADR-004: Explicit Simulated vs. Native Visual Contract**:
  - *Context*: Users must never be misled into thinking a simulated web canvas is an Android ART environment.
  - *Decision*: FAST mode renders lightweight web targets with an explicit badge; NATIVE mode targets ADB and emulator/device with clear capability validation.
- **ADR-005: Decomposed Device Preview Components**:
  - *Context*: `VirtualDeviceSurface.tsx` was approaching the 350-line limit mandated by `ELMAS.md`.
  - *Decision*: Extracted `DeviceToolbar.tsx` (141 lines) to keep `VirtualDeviceSurface.tsx` compact (235 lines), maintaining high readability and single responsibility.
- **ADR-006: Industry-Standard Docking Engine via `dockview-react`**:
  - *Context*: Static CSS flexbox panels feel amateurish, rigid, and don't provide the expected developer ergonomics of professional tools like VS Code / Eclipse Theia.
  - *Decision*: Integrated `dockview-react` (8.8.3) to provide authentic VS Code panel docking, tab reordering, horizontal/vertical splits, floating groups, and draggable layout persistence.
- **ADR-007: VSCodium-Based Standalone Distribution (Option B)**:
  - *Context*: Rather than writing an ad-hoc IDE UI from scratch, leverage VSCodium (the open-source, telemetry-free binary release of VS Code) as the desktop shell.
  - *Decision*: Implemented `src-extension/` containing the Elmas Studio Core Extension (mobile virtual device, 4 framework adapters, process manager, SDK detector) and `scripts/setup-standalone-studio.ps1` to assemble a self-contained portable distribution (`Elmas-Studio-Desktop/Elmas Studio.exe`).
