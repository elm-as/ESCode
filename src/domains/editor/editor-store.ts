import { create } from "zustand";
import { CursorPosition, EditorSettings, EditorTab } from "./types";
import { readFileContent, writeFileContent } from "../projects/projects-service";

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  settings: EditorSettings;
  cursor: CursorPosition;

  openFile: (filePath: string, fileName: string) => Promise<void>;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateContent: (tabId: string, newContent: string) => void;
  saveActiveFile: () => Promise<void>;
  saveTab: (tabId: string) => Promise<void>;
  updateSettings: (settings: Partial<EditorSettings>) => void;
  setCursorPosition: (pos: CursorPosition) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  settings: {
    fontSize: 13,
    tabSize: 2,
    wordWrap: "on",
    minimap: false,
  },
  cursor: { lineNumber: 1, column: 1 },

  openFile: async (filePath: string, fileName: string) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    try {
      const content = await readFileContent(filePath);
      const language = detectLanguageFromFileName(fileName);
      const newTab: EditorTab = {
        id: filePath,
        filePath,
        fileName,
        content,
        initialContent: content,
        isDirty: false,
        language,
      };

      set({
        tabs: [...tabs, newTab],
        activeTabId: newTab.id,
      });
    } catch (err) {
      console.error(`Failed to read file for editor: ${filePath}`, err);
    }
  },

  closeTab: (tabId: string) => {
    set((state) => {
      const nextTabs = state.tabs.filter((t) => t.id !== tabId);
      let nextActiveId = state.activeTabId;

      if (state.activeTabId === tabId) {
        if (nextTabs.length > 0) {
          nextActiveId = nextTabs[nextTabs.length - 1].id;
        } else {
          nextActiveId = null;
        }
      }

      return { tabs: nextTabs, activeTabId: nextActiveId };
    });
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId });
  },

  updateContent: (tabId: string, newContent: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        return {
          ...tab,
          content: newContent,
          isDirty: newContent !== tab.initialContent,
        };
      }),
    }));
  },

  saveActiveFile: async () => {
    const { activeTabId, tabs } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.isDirty) return;
    await get().saveTab(tab.id);
  },

  saveTab: async (tabId: string) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    try {
      await writeFileContent(tab.filePath, tab.content);
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...t, initialContent: t.content, isDirty: false }
            : t
        ),
      }));
    } catch (err) {
      console.error(`Failed to save file: ${tab.filePath}`, err);
    }
  },

  updateSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
  },

  setCursorPosition: (pos) => {
    set({ cursor: pos });
  },
}));

function detectLanguageFromFileName(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  switch (ext) {
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "javascript";
    case "dart":
      return "dart";
    case "kt":
    case "kts":
      return "kotlin";
    case "json":
      return "json";
    case "html":
      return "html";
    case "css":
      return "css";
    case "xml":
      return "xml";
    case "yaml":
    case "yml":
      return "yaml";
    case "md":
      return "markdown";
    case "rs":
      return "rust";
    default:
      return "plaintext";
  }
}
