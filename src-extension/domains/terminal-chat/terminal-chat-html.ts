export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  codeOutput?: string;
  status?: "running" | "success" | "error";
  durationMs?: number;
  timestamp: string;
}

/**
 * Generates the Terminal Chat UI matching the Elmas Studio editor aesthetic.
 * Strictly compliant with ELMAS.md: <= 350 lines, pure function.
 */
export function renderTerminalChatHtml(projectName: string, initialMessages: ChatMessageItem[]): string {
  const initialJson = JSON.stringify(initialMessages);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100vh; overflow: hidden; background-color: #0c0c10;
      color: #e4e4e7; font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: 13px; line-height: 20px; display: flex; flex-direction: column;
    }
    .top-bar {
      height: 32px; padding: 0 12px; background: #0c0c10;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-shrink: 0;
    }
    .cwd-group { display: flex; align-items: center; gap: 6px; color: #a1a1aa; font-size: 12px; }
    .cwd-group svg { width: 14px; height: 14px; stroke: #f59e0b; fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .cwd-name { color: #e4e4e7; font-weight: 500; font-family: monospace; font-size: 12px; }
    .actions-group { display: flex; align-items: center; gap: 6px; }
    .pill-btn {
      height: 23px; padding: 0 9px; border-radius: 6px; font-size: 11px; font-weight: 500;
      font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
      border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.04); color: #d4d4d8;
    }
    .pill-btn:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
    .pill-btn svg { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 1.7; stroke-linecap: round; }

    .chat-stream {
      flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; background: #101015;
    }
    .msg-row { display: flex; flex-direction: column; max-width: 82%; }
    .msg-row.user { align-self: flex-end; align-items: flex-end; }
    .msg-row.assistant { align-self: flex-start; align-items: flex-start; }
    .bubble {
      padding: 8px 12px; border-radius: 9px; font-size: 13px; line-height: 20px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .msg-row.user .bubble {
      background: rgba(245, 158, 11, 0.14); border: 1px solid rgba(245, 158, 11, 0.32);
      color: #fef3c7; border-bottom-right-radius: 3px;
    }
    .msg-row.assistant .bubble {
      background: #16161d; border: 1px solid rgba(255, 255, 255, 0.07);
      color: #e4e4e7; border-bottom-left-radius: 3px;
    }
    .code-block {
      background: #0b0b0f; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 7px;
      padding: 8px 10px; font-family: monospace; font-size: 12px; line-height: 19px;
      color: #d4d4d8; white-space: pre-wrap; word-break: break-word; max-height: 170px;
      overflow-y: auto; user-select: text; font-variant-numeric: tabular-nums;
    }
    .meta-line {
      display: flex; align-items: center; gap: 8px; margin-top: 2px;
      padding: 0 2px; font-size: 11px; line-height: 14px; color: #71717a;
    }
    .status-ok { color: #34d399; }
    .status-err { color: #f87171; }
    .status-run { color: #fbbf24; }

    .composer-bar {
      padding: 8px 12px; background: #0c0c10; border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }
    .input-box {
      flex: 1; height: 32px; background: #16161d; border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 8px; padding: 0 6px 0 12px; display: flex; align-items: center; gap: 8px;
    }
    .input-box:focus-within { border-color: rgba(245, 158, 11, 0.5); }
    .chat-input {
      flex: 1; background: transparent; border: none; outline: none;
      color: #f4f4f6; font-size: 13px; font-family: inherit;
    }
    .chat-input::placeholder { color: #71717a; }
    .send-btn {
      width: 22px; height: 22px; border-radius: 6px; border: none;
      background: #d97706; color: #09090b; display: inline-flex; align-items: center;
      justify-content: center; cursor: pointer; flex-shrink: 0;
    }
    .send-btn:hover { background: #f59e0b; }
    .send-btn svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="cwd-group">
      <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="cwd-name" id="cwd-label">${projectName}</span>
    </div>
    <div class="actions-group">
      <button class="pill-btn" onclick="sendQuick('git status -s')">
        <svg viewBox="0 0 24 24"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12"/></svg>
        <span>État Git</span>
      </button>
      <button class="pill-btn" onclick="sendQuick('dépendances')">
        <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        <span>Dépendances</span>
      </button>
      <button class="pill-btn" onclick="sendQuick('analyser')">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Analyser</span>
      </button>
      <button class="pill-btn" onclick="clearChat()">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Effacer</span>
      </button>
    </div>
  </div>

  <div class="chat-stream" id="stream"></div>

  <div class="composer-bar">
    <div class="input-box">
      <input
        id="chat-input"
        class="chat-input"
        type="text"
        placeholder="Écrire un message ou une commande..."
        autocomplete="off"
      />
      <button class="send-btn" onclick="submitMessage()" title="Envoyer">
        <svg viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
      </button>
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

    function formatText(str) {
      return escapeHtml(str)
        .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
        .replace(/\`([^\`]+)\`/g, '<code style="background:rgba(255,255,255,0.07);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:12px;">$1</code>')
        .replace(/\\n/g, '<br/>');
    }

    function renderMessages() {
      stream.innerHTML = messages.map((m) => {
        const isUser = m.role === 'user';
        let statusHtml = '';
        if (!isUser && m.status) {
          if (m.status === 'running') statusHtml = '<span class="status-run">En cours...</span>';
          else if (m.status === 'success') statusHtml = '<span class="status-ok">Prêt' + (m.durationMs ? ' · ' + m.durationMs + ' ms' : '') + '</span>';
          else if (m.status === 'error') statusHtml = '<span class="status-err">Erreur' + (m.durationMs ? ' · ' + m.durationMs + ' ms' : '') + '</span>';
        }
        const textHtml = m.text ? '<div>' + formatText(m.text) + '</div>' : '';
        const codeHtml = m.codeOutput ? '<div class="code-block">' + escapeHtml(m.codeOutput) + '</div>' : '';

        return '<div class="msg-row ' + m.role + '">' +
          '<div class="bubble">' + textHtml + codeHtml + '</div>' +
          '<div class="meta-line"><span>' + escapeHtml(m.timestamp) + '</span>' + statusHtml + '</div>' +
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
        if (msg.projectName && cwdLabel) cwdLabel.textContent = msg.projectName;
        renderMessages();
      }
    });

    renderMessages();
    setTimeout(() => input.focus(), 100);
  </script>
</body>
</html>`;
}
