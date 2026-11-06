import { create } from "zustand";
import { DiagnosticItem } from "./types";

interface DiagnosticsState {
  items: DiagnosticItem[];
  filterSeverity: "all" | "error" | "warning";

  addDiagnostic: (item: Omit<DiagnosticItem, "id" | "timestamp">) => void;
  clearDiagnostics: () => void;
  setFilterSeverity: (severity: "all" | "error" | "warning") => void;
}

export const useDiagnosticsStore = create<DiagnosticsState>((set) => ({
  items: [],
  filterSeverity: "all",

  addDiagnostic: (item) => {
    const newItem: DiagnosticItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    set((state) => ({ items: [newItem, ...state.items].slice(0, 200) }));
  },

  clearDiagnostics: () => {
    set({ items: [] });
  },

  setFilterSeverity: (severity) => {
    set({ filterSeverity: severity });
  },
}));

