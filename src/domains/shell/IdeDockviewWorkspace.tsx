import React, { useRef, useEffect } from "react";
import {
  DockviewReact,
  DockviewReadyEvent,
  IDockviewPanelProps,
  DockviewApi,
} from "dockview-react";
import { EditorView } from "../editor/EditorView";
import { VirtualDeviceSurface } from "../preview/VirtualDeviceSurface";
import { ProblemsView } from "../diagnostics/ProblemsView";
import { useTerminalStore } from "../terminal/terminal-store";
import { useEditorStore } from "../editor/editor-store";

interface IdeDockviewWorkspaceProps {
  onStartProject: () => void;
  onStopProject: () => void;
}

const EditorPanel: React.FC<IDockviewPanelProps> = () => {
  return <EditorView />;
};

const PreviewPanel: React.FC<IDockviewPanelProps<{
  onStartProject: () => void;
  onStopProject: () => void;
}>> = (props) => {
  return (
    <VirtualDeviceSurface
      onStartProject={props.params.onStartProject}
      onStopProject={props.params.onStopProject}
    />
  );
};

const OutputPanel: React.FC<IDockviewPanelProps> = () => {
  const { logs } = useTerminalStore();
  return (
    <div className="h-full overflow-y-auto p-3 font-mono text-[11px] bg-zinc-950 text-zinc-300 space-y-0.5 select-text">
      {logs.length === 0 ? (
        <div className="text-zinc-600">
          No output logs yet. Start a framework preview to stream live process output.
        </div>
      ) : (
        logs.map((log) => (
          <div
            key={log.id}
            className={`leading-relaxed whitespace-pre-wrap break-all ${
              log.stream === "stderr" ? "text-amber-400" : "text-zinc-300"
            }`}
          >
            <span className="text-zinc-600 mr-2 select-none">
              [{new Date(log.timestamp).toLocaleTimeString()}]
            </span>
            {log.line}
          </div>
        ))
      )}
    </div>
  );
};

const ProblemsPanel: React.FC<IDockviewPanelProps> = () => {
  return <ProblemsView />;
};

export const IdeDockviewWorkspace: React.FC<IdeDockviewWorkspaceProps> = ({
  onStartProject,
  onStopProject,
}) => {
  const apiRef = useRef<DockviewApi | null>(null);
  const { tabs, activeTabId } = useEditorStore();

  const components = {
    editor: EditorPanel,
    preview: PreviewPanel,
    output: OutputPanel,
    problems: ProblemsPanel,
  };

  const onReady = (event: DockviewReadyEvent) => {
    apiRef.current = event.api;

    // 1. Center Editor panel
    const editorPanel = event.api.addPanel({
      id: "editor_main",
      component: "editor",
      title: "Code Editor",
    });

    // 2. Right Live Mobile Preview panel (split to the right of editor)
    event.api.addPanel({
      id: "preview_main",
      component: "preview",
      title: "Mobile Live Preview",
      position: { referencePanel: editorPanel, direction: "right" },
      params: { onStartProject, onStopProject },
      initialWidth: 440,
    });

    // 3. Bottom Output Logs panel (split to the bottom of editor)
    const outputPanel = event.api.addPanel({
      id: "output_main",
      component: "output",
      title: "Process Output",
      position: { referencePanel: editorPanel, direction: "below" },
      initialHeight: 180,
    });

    // 4. Group Problems tab together with Output
    event.api.addPanel({
      id: "problems_main",
      component: "problems",
      title: "Diagnostics & Problems",
      position: { referencePanel: outputPanel, direction: "within" },
    });
  };

  // Sync title with active file
  useEffect(() => {
    if (!apiRef.current) return;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const panel = apiRef.current.getPanel("editor_main");
    if (panel) {
      panel.setTitle(activeTab ? `${activeTab.fileName}${activeTab.isDirty ? " •" : ""}` : "Code Editor");
    }
  }, [tabs, activeTabId]);

  return (
    <div className="flex-1 w-full h-full overflow-hidden bg-zinc-950">
      <DockviewReact
        components={components}
        onReady={onReady}
        className="dockview-theme-dark w-full h-full"
      />
    </div>
  );
};
