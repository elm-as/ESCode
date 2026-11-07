"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTerminalChatHtml = renderTerminalChatHtml;
/**
 * Generates the macOS Messages / Warp-inspired Conversational Terminal HTML.
 */
function renderTerminalChatHtml(projectName, initialMessages) {
    const initialJson = JSON.stringify(initialMessages);
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    html, body {
      width: 100%; height: 100vh; overflow: hidden;
      background: #0c0c10; color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI Variable Text", sans-serif;
      display: flex; flex-direction: column;
    }

    /* Top Conversational Header & Quick Chips */
    .chat-header {
      height: 36px; padding: 0 12px;
      background: rgba(255, 255, 255, 0.025);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px; flex-shrink: 0;
    }
    .agent-badge {
      display: flex; align-items: center; gap: 7px;
      font-size: 11.5px; font-weight: 600; color: #f4f4f6;
      white-space: nowrap;
    }
    .status-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #27C93F; box-shadow: 0 0 6px rgba(39, 201, 63, 0.7);
    }
    .cwd-pill {
      font-size: 10.5px; font-weight: 500; color: #a1a1aa;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 2px 8px; border-radius: 999px;
      font-family: "JetBrains Mono", "SF Mono", Consolas, monospace;
    }
    .quick-chips {
      display: flex; align-items: center; gap: 5px; overflow-x: auto;
    }
    .quick-chips::-webkit-scrollbar { height: 0; }
    .chip-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.09);
      color: #d4d4d8; font-size: 11px; font-weight: 500;
      padding: 3px 9px; border-radius: 999px; cursor: pointer;
      white-space: nowrap; transition: all 0.14s ease;
    }
    .chip-btn:hover {
      background: rgba(245, 158, 11, 0.16);
      border-color: rgba(245, 158, 11, 0.4);
      color: #fbbf24;
    }

    /* Message Stream */
    .chat-stream {
      flex: 1; overflow-y: auto; padding: 14px 16px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .chat-stream::-webkit-scrollbar { width: 5px; }
    .chat-stream::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.14); border-radius: 999px;
    }

    .msg-row {
      display: flex; gap: 9px; max-width: 88%;
      animation: fadeIn 0.14s cubic-bezier(0.22, 1, 0.36, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .msg-row.user {
      align-self: flex-end; flex-direction: row-reverse;
    }
    .msg-row.assistant {
      align-self: flex-start;
    }

    .avatar {
      width: 26px; height: 26px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; flex-shrink: 0; margin-top: 2px;
    }
    .msg-row.assistant .avatar {
      background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%);
      color: #09090b; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
    }
    .msg-row.user .avatar {
      background: rgba(255, 255, 255, 0.1);
      color: #fafafa; border: 1px solid rgba(255, 255, 255, 0.14);
    }

    .bubble {
      padding: 9px 13px; border-radius: 15px;
      font-size: 12.5px; line-height: 1.45;
      display: flex; flex-direction: column; gap: 6px;
      min-width: 120px;
    }
    .msg-row.user .bubble {
      background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
      color: #ffffff;
      border-bottom-right-radius: 4px;
      box-shadow: 0 3px 10px rgba(217, 119, 6, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.22);
    }
    .msg-row.assistant .bubble {
      background: #15151c;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e4e4e7;
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .code-block {
      background: #09090c;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 9px; padding: 8px 10px;
      font-family: "JetBrains Mono", "Cascadia Code", "SF Mono", Consolas, monospace;
      font-size: 11.5px; line-height: 1.45; color: #d4d4d8;
      white-space: pre-wrap; word-break: break-word;
      max-height: 180px; overflow-y: auto; user-select: text;
    }

    .meta-footer {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; font-size: 10px; color: rgba(255, 255, 255, 0.5);
    }
    .badge-ok { color: #34d399; font-weight: 600; }
    .badge-err { color: #f87171; font-weight: 600; }
    .badge-run { color: #fbbf24; font-weight: 600; }

    /* Bottom iMessage Composer Bar */
    .composer-bar {
      padding: 8px 12px 10px 12px;
      background: #0c0c10;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }
    .input-capsule {
      flex: 1; height: 34px;
      background: #16161e;
      border: 1px solid rgba(255, 255, 255, 0.11);
      border-radius: 999px;
      padding: 0 6px 0 14px;
      display: flex; align-items: center; gap: 8px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .input-capsule:focus-within {
      border-color: rgba(245, 158, 11, 0.55);
      box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
    }
    .chat-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #fafafa; font-size: 12.5px;
      font-family: inherit;
    }
    .chat-input::placeholder { color: #71717a; }
    .send-btn {
      width: 24px; height: 24px; border-radius: 50%; border: none;
      background: linear-gradient(180deg, #fbbf24 0%, #d97706 100%);
      color: #09090b; font-weight: 800; font-size: 13px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0; transition: transform 0.1s ease;
    }
    .send-btn:hover { transform: scale(1.06); }
    .send-btn:active { transform: scale(0.94); }
  </style>
</head>
<body>
  <div class="chat-header">
    <div class="agent-badge">
      <span class="status-dot"></span>
      <span>Terminal Chat</span>
      <span class="cwd-pill" id="cwd-label">📁 ${projectName}</span>
    </div>
    <div class="quick-chips">
      <button class="chip-btn" onclick="sendQuick('état git')">🔍 État Git</button>
      <button class="chip-btn" onclick="sendQuick('installe les dépendances')">⚡ Dépendances</button>
      <button class="chip-btn" onclick="sendQuick('analyse le code')">🩺 Analyser</button>
      <button class="chip-btn" onclick="sendQuick('relance l\\'aperçu')">🔄 Relancer l'Aperçu</button>
      <button class="chip-btn" onclick="clearChat()">🗑️ Effacer</button>
    </div>
  </div>

  <div class="chat-stream" id="stream"></div>

  <div class="composer-bar">
    <div class="input-capsule">
      <input
        id="chat-input"
        class="chat-input"
        type="text"
        placeholder="Écris au terminal comme à un collègue (ex: 'état git', 'installe les dépendances', 'flutter pub get')..."
        autocomplete="off"
      />
      <button class="send-btn" onclick="submitMessage()" title="Envoyer (Entrée)">↑</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let messages = ${initialJson};
    const stream = document.getElementById('stream');
    const input = document.getElementById('chat-input');
    const cwdLabel = document.getElementById('cwd-label');

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function formatRichText(str) {
      return escapeHtml(str)
        .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
        .replace(/\`([^\`]+)\`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-family:monospace;">$1</code>')
        .replace(/\\n/g, '<br/>');
    }

    function renderMessages() {
      stream.innerHTML = messages.map((m) => {
        const isUser = m.role === 'user';
        let statusHtml = '';
        if (!isUser && m.status) {
          if (m.status === 'running') statusHtml = '<span class="badge-run">• • • Exécution en cours</span>';
          else if (m.status === 'success') statusHtml = '<span class="badge-ok">✓ Terminé' + (m.durationMs ? ' en ' + m.durationMs + ' ms' : '') + '</span>';
          else if (m.status === 'error') statusHtml = '<span class="badge-err">✕ Erreur' + (m.durationMs ? ' (' + m.durationMs + ' ms)' : '') + '</span>';
        }
        const codeHtml = m.codeOutput
          ? '<div class="code-block">' + escapeHtml(m.codeOutput) + '</div>'
          : '';
        return '<div class="msg-row ' + m.role + '">' +
          '<div class="avatar">' + (isUser ? 'Toi' : '⚡') + '</div>' +
          '<div class="bubble">' +
            '<div>' + formatRichText(m.text) + '</div>' +
            codeHtml +
            '<div class="meta-footer"><span>' + escapeHtml(m.timestamp) + '</span>' + statusHtml + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      stream.scrollTop = stream.scrollHeight;
    }

    function submitMessage() {
      const val = input.value.trim();
      if (!val) return;
      input.value = '';
      vscode.postMessage({ type: 'sendChatCommand', text: val });
    }

    function sendQuick(text) {
      vscode.postMessage({ type: 'sendChatCommand', text });
    }

    function clearChat() {
      vscode.postMessage({ type: 'clearChat' });
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitMessage();
      }
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'syncMessages') {
        messages = msg.messages;
        if (msg.projectName && cwdLabel) cwdLabel.textContent = '📁 ' + msg.projectName;
        renderMessages();
      }
    });

    renderMessages();
    setTimeout(() => input.focus(), 100);
  </script>
</body>
</html>`;
}
//# sourceMappingURL=terminal-chat-html.js.map