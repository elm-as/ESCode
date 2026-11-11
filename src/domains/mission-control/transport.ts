import { invoke } from "@tauri-apps/api/core";

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
    __ELMAS_VSCODE_API__?: VsCodeApi;
  }
}

interface PendingRpc {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

const pendingCalls = new Map<string, PendingRpc>();
let listenerInitialized = false;
let callCounter = 0;

function getVsCodeApi(): VsCodeApi | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (window.__ELMAS_VSCODE_API__) {
    return window.__ELMAS_VSCODE_API__;
  }
  if (typeof window.acquireVsCodeApi === "function") {
    window.__ELMAS_VSCODE_API__ = window.acquireVsCodeApi();
    return window.__ELMAS_VSCODE_API__;
  }
  return null;
}

function ensureWebviewListener(): void {
  if (listenerInitialized || typeof window === "undefined") {
    return;
  }
  listenerInitialized = true;
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || typeof msg.id !== "string") {
      return;
    }
    const pending = pendingCalls.get(msg.id);
    if (!pending) {
      return;
    }
    pendingCalls.delete(msg.id);
    if (msg.ok) {
      pending.resolve(msg.data);
    } else {
      pending.reject(new Error(msg.error?.message || "Erreur Mission Control"));
    }
  });
}

/**
 * Exécute une commande sur le cœur Rust `mission-control-core`, que l'interface tourne
 * dans l'application Tauri (`invoke("mc_dispatch")`) ou dans la Webview VSCodium (`elmas-mc serve`).
 */
export async function mcCall<T>(command: string, payload: unknown = null): Promise<T> {
  const vscode = getVsCodeApi();
  if (vscode) {
    ensureWebviewListener();
    const id = `mc_${++callCounter}_${Date.now()}`;
    return new Promise<T>((resolve, reject) => {
      pendingCalls.set(id, { resolve: resolve as (v: unknown) => void, reject });
      vscode.postMessage({ type: "mc.rpc", id, command, payload });
    });
  }
  return await invoke<T>("mc_dispatch", { command, payload });
}

/**
 * Déclenche une action hôte externe depuis le tableau de bord autonome
 * (lancer `Elmas Studio.exe` sur un projet, ouvrir un terminal externe, ou ouvrir une URL).
 */
export function triggerHostAction(action: string, payload: Record<string, unknown>): void {
  const vscode = getVsCodeApi();
  if (vscode) {
    vscode.postMessage({ type: "mc.host", action, payload });
    return;
  }
  invoke("mc_host_action", { action, payload }).catch((err) => {
    console.error("Failed to execute host action:", err);
  });
}

/**
 * Formate une taille en octets avec chiffres tabulaires lisibles (Mo / Go).
 */
export function formatByteSize(bytes: number): string {
  if (bytes <= 0) return "0 Mo";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${mb.toFixed(mb < 10 ? 1 : 0)} Mo`;
  }
  return `${(mb / 1024).toFixed(2)} Go`;
}

/**
 * Formate un timestamp Unix (secondes) en date relative compacte.
 */
export function formatRelativeTimestamp(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diffSec < 60) return "à l'instant";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

