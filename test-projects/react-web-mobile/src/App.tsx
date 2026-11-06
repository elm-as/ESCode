import React, { useState } from "react";

export function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
          Mobile Fast Preview
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginTop: "8px", marginBottom: "8px" }}>
          React Mobile App
        </h1>
        <p style={{ fontSize: "13px", color: "#a1a1aa", lineHeight: "1.5" }}>
          Live code modification in Monaco reflects immediately in this simulated mobile viewport via Vite HMR.
        </p>

        <div style={{ marginTop: "24px", background: "#18181b", padding: "16px", borderRadius: "12px", border: "1px solid #27272a" }}>
          <div style={{ fontSize: "12px", color: "#71717a" }}>Counter State</div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#f4f4f5", fontFamily: "monospace" }}>
            {count}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button
              onClick={() => setCount(count + 1)}
              style={{
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Increment
            </button>
            <button
              onClick={() => setCount(0)}
              style={{
                background: "#27272a",
                color: "#e4e4e7",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #27272a", paddingTop: "12px", fontSize: "11px", color: "#52525b" }}>
        Target: Mobile Web Viewport • Mode: FAST
      </div>
    </div>
  );
}

export default App;
