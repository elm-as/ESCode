import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { ToolchainStatus } from "./types";

interface SdkState {
  status: ToolchainStatus | null;
  isScanning: boolean;
  isOpenModal: boolean;

  scanSdk: () => Promise<void>;
  setOpenModal: (open: boolean) => void;
}

export const useSdkStore = create<SdkState>((set) => ({
  status: null,
  isScanning: false,
  isOpenModal: false,

  scanSdk: async () => {
    set({ isScanning: true });
    try {
      const res = await invoke<ToolchainStatus>("sdk_scan");
      set({ status: res, isScanning: false });
    } catch (err) {
      console.error("SDK toolchain scan failed:", err);
      set({ isScanning: false });
    }
  },

  setOpenModal: (open: boolean) => {
    set({ isOpenModal: open });
  },
}));

