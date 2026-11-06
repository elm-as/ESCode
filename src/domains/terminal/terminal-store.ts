import { create } from "zustand";

export interface LogLine {
  id: string;
  processId: string;
  stream: "stdout" | "stderr";
  line: string;
  timestamp: number;
}

interface TerminalState {
  logs: LogLine[];
  activeBottomTab: "problems" | "output" | "terminal";

  appendLog: (processId: string, stream: "stdout" | "stderr", line: string) => void;
  clearLogs: () => void;
  setActiveBottomTab: (tab: "problems" | "output" | "terminal") => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  logs: [],
  activeBottomTab: "output",

  appendLog: (processId, stream, line) => {
    const item: LogLine = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      processId,
      stream,
      line,
      timestamp: Date.now(),
    };
    set((state) => ({ logs: [...state.logs.slice(-500), item] }));
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  setActiveBottomTab: (tab) => {
    set({ activeBottomTab: tab });
  },
}));

