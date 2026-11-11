import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Theme } from "@astryxdesign/core/theme";
import { themes, defaultThemeSlug } from "./astryx-themes";
import { MissionControlView } from "./domains/mission-control/MissionControlView";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <div className="h-screen w-screen overflow-hidden bg-[#0c0c10]">
        <MissionControlView />
      </div>
    </Theme>
  </React.StrictMode>
);

