import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { DeviceOrientation, DeviceProfile, PreviewMode } from "./types";

interface DeviceState {
  profiles: DeviceProfile[];
  activeProfileId: string;
  orientation: DeviceOrientation;
  previewMode: PreviewMode;
  zoom: number;
  previewUrl: string | null;
  runtimeStatus: "idle" | "starting" | "running" | "error";
  runtimeError: string | null;
  reloadKey: number;

  loadProfiles: () => Promise<void>;
  selectProfile: (id: string) => void;
  toggleOrientation: () => void;
  setOrientation: (orientation: DeviceOrientation) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setZoom: (zoom: number) => void;
  setPreviewUrl: (url: string | null) => void;
  setRuntimeStatus: (status: "idle" | "starting" | "running" | "error", error?: string | null) => void;
  reloadPreview: () => void;
}

const DEFAULT_PROFILES: DeviceProfile[] = [
  { id: "compact-360", name: "Compact Phone (360×800)", width: 360, height: 800, dpi: 2.0, is_default: false },
  { id: "standard-375", name: "iPhone SE / Standard (375×812)", width: 375, height: 812, dpi: 3.0, is_default: false },
  { id: "flagship-390", name: "Flagship Modern (390×844)", width: 390, height: 844, dpi: 3.0, is_default: true },
  { id: "pixel-412", name: "Pixel 8 / Large (412×915)", width: 412, height: 915, dpi: 2.625, is_default: false },
  { id: "pro-max-432", name: "Pro Max / Ultra (432×960)", width: 432, height: 960, dpi: 3.0, is_default: false },
];

export const useDeviceStore = create<DeviceState>((set) => ({
  profiles: DEFAULT_PROFILES,
  activeProfileId: "flagship-390",
  orientation: "portrait",
  previewMode: "fast",
  zoom: 0.85,
  previewUrl: null,
  runtimeStatus: "idle",
  runtimeError: null,
  reloadKey: 0,

  loadProfiles: async () => {
    try {
      const dbProfiles = await invoke<DeviceProfile[]>("db_get_device_profiles");
      if (dbProfiles && dbProfiles.length > 0) {
        set({ profiles: dbProfiles });
      }
    } catch (err) {
      console.warn("Could not load profiles from SQLite, using defaults:", err);
    }
  },

  selectProfile: (id: string) => {
    set({ activeProfileId: id });
  },

  toggleOrientation: () => {
    set((state) => ({
      orientation: state.orientation === "portrait" ? "landscape" : "portrait",
    }));
  },

  setOrientation: (orientation: DeviceOrientation) => {
    set({ orientation });
  },

  setPreviewMode: (mode: PreviewMode) => {
    set({ previewMode: mode });
  },

  setZoom: (zoom: number) => {
    set({ zoom });
  },

  setPreviewUrl: (url: string | null) => {
    set({ previewUrl: url });
  },

  setRuntimeStatus: (status, error = null) => {
    set({ runtimeStatus: status, runtimeError: error });
  },

  reloadPreview: () => {
    set((state) => ({ reloadKey: state.reloadKey + 1 }));
  },
}));
