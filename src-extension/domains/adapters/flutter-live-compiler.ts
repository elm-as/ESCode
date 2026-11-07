import {
  DiscoveredFlutterScreen,
  FlutterThemeTokens,
  FlutterWorkspaceSnapshot,
  resolveDartColor,
} from "./flutter-project-scanner";

export interface CompiledFlutterPayload {
  scaffoldBg: string;
  scaffoldGradient: string;
  isDark: boolean;
  showDebugBanner: boolean;
  hasAppBar: boolean;
  appBarTitle: string;
  appBarSubtitle: string;
  appBarBg: string;
  bodyHtml: string;
  bodyAlignCenter: boolean;
  hasFab: boolean;
  fabBg: string;
  fabLabel: string;
  fabIcon: string;
  activeScreenId: string;
  screens: Array<{ id: string; label: string }>;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractDartStringLiteral(src: string): string | null {
  const idxSingle = src.indexOf("'");
  const idxDouble = src.indexOf('"');
  let quote = "'";
  let start = idxSingle;
  if (idxSingle === -1 || (idxDouble !== -1 && idxDouble < idxSingle)) {
    quote = '"';
    start = idxDouble;
  }
  if (start === -1) return null;

  let braceDepth = 0;
  for (let i = start + 1; i < src.length; i++) {
    const ch = src[i];
    const prev = src[i - 1];
    if (ch === "{" && prev === "$") {
      braceDepth++;
    } else if (ch === "}" && braceDepth > 0) {
      braceDepth--;
    } else if (ch === quote && braceDepth === 0 && prev !== "\\") {
      return src.slice(start + 1, i);
    }
  }
  return null;
}

function formatInterpolatedText(rawText: string): string {
  const replaced = rawText.replace(/\$\{([^}]+)\}|\$([a-zA-Z0-9_]+)/g, (_full, braced, simple) => {
    const expr = (braced || simple || "").trim();
    if (expr === "_counter" || expr === "counter") {
      return `__ELMAS_COUNTER__`;
    }
    if (expr.includes("DateFormat") || expr.includes("monthLabel")) {
      return "Novembre 2026";
    }
    if (expr.includes("totalPoidsNet") || expr.includes("totalBrut") || expr.includes("totalNet")) {
      return "1 240.0";
    }
    if (
      expr.includes("totalRevenu") ||
      expr.includes("montantNetRecu") ||
      expr.includes("gainNet") ||
      expr.includes("benefice")
    ) {
      return "205 500";
    }
    if (expr.includes("totalPayeSaigneurs") || expr.includes("gainBrut")) {
      return "186 000";
    }
    if (expr.includes("totalDepenses") || expr.includes("totalRetenues") || expr.includes("amount")) {
      return "42 500";
    }
    if (expr.includes(".id")) return "1";
    if (expr.includes(".name")) return "Champ Principal";
    if (expr.includes(".length")) return "8";
    return "0";
  });

  return escapeHtml(replaced).replace(
    /__ELMAS_COUNTER__/g,
    `<span data-flutter-var="_counter">0</span>`
  );
}

export function extractBalancedParen(source: string, startIdx: number): string {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = startIdx; i < source.length; i++) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : "";
    if (ch === "'" && !inDouble && prev !== "\\") inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== "\\") inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) return source.slice(startIdx + 1, i);
      }
    }
  }
  return source.slice(startIdx + 1);
}

function stripDialogsAndModals(source: string): string {
  let result = source;
  const dialogCallRegex = /(?:showDialog|showModalBottomSheet|ScaffoldMessenger\.of)\s*(?:<[^>]+>)?\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = dialogCallRegex.exec(result)) !== null) {
    const openIdx = match.index + match[0].length - 1;
    const inner = extractBalancedParen(result, openIdx);
    result = result.slice(0, match.index) + "/* modal */" + result.slice(openIdx + inner.length + 1);
    dialogCallRegex.lastIndex = match.index + 11;
  }
  return result;
}

function parseTextStyleCss(block: string, theme: FlutterThemeTokens, onDarkBg: boolean): string {
  const styles: string[] = [];
  const defaultColor = onDarkBg || theme.isDark ? "#ffffff" : "#1f2937";
  const color = resolveDartColor(block, theme, defaultColor);
  if (color) styles.push(`color: ${color}`);

  const sizeMatch = block.match(/fontSize\s*:\s*([0-9.]+)/);
  if (sizeMatch) styles.push(`font-size: ${sizeMatch[1]}px`);

  if (block.includes("FontWeight.bold") || block.includes("FontWeight.w700")) {
    styles.push("font-weight: 700");
  } else if (block.includes("FontWeight.w600")) {
    styles.push("font-weight: 600");
  }

  const spacingMatch = block.match(/letterSpacing\s*:\s*(-?[0-9.]+)/);
  if (spacingMatch) styles.push(`letter-spacing: ${spacingMatch[1]}px`);

  return styles.join("; ");
}

function compileActionGrid(source: string, theme: FlutterThemeTokens): string {
  const actions: string[] = [];
  const regex = /_actionButton\s*\(\s*context\s*,\s*Icons\.([a-z0-9_]+)\s*,\s*(['"])([^'"]+)\2\s*,\s*(?:const\s+)?([^,]+),\s*\(\)\s*\{([\s\S]*?)\}\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source)) !== null) {
    const iconName = m[1];
    const label = escapeHtml(m[3]);
    const color = resolveDartColor(m[4], theme, theme.primaryColor);
    const navMatch = m[5].match(/([A-Za-z0-9_]+Screen|[A-Za-z0-9_]+Dashboard)\s*\(/);
    const targetScreen = navMatch ? navMatch[1] : "";
    const iconGlyph =
      iconName.includes("cart") ? "⚖️" :
      iconName.includes("group") ? "👥" :
      iconName.includes("receipt") ? "🧾" :
      iconName.includes("analytics") ? "📊" : "⚡";

    actions.push(`
      <div class="fl-grid-card" onclick="window.__switchFlutterScreen('${targetScreen}')">
        <div class="fl-grid-icon" style="background:${color}1f; color:${color}">${iconGlyph}</div>
        <div class="fl-grid-label">${label}</div>
      </div>
    `);
  }
  if (actions.length === 0) return "";
  return `<div class="fl-action-grid">${actions.join("")}</div>`;
}

function compileFormFields(cleanSource: string): string {
  const fields: string[] = [];
  const seen = new Set<string>();
  const fieldRegex = /_field\s*\([^,]+,\s*(['"])([^'"]+)\1/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRegex.exec(cleanSource)) !== null) {
    const label = escapeHtml(m[2]);
    if (seen.has(label)) continue;
    seen.add(label);
    fields.push(`
      <div class="fl-input-group">
        <label class="fl-input-label">${label}</label>
        <input class="fl-input" type="text" placeholder="${label}" />
      </div>
    `);
  }

  const decRegex = /InputDecoration\s*\([\s\S]{0,160}?labelText\s*:\s*(['"])([^'"]+)\1/g;
  while ((m = decRegex.exec(cleanSource)) !== null) {
    const label = escapeHtml(m[2]);
    if (seen.has(label)) continue;
    seen.add(label);
    fields.push(`
      <div class="fl-input-group">
        <label class="fl-input-label">${label}</label>
        <input class="fl-input" type="text" placeholder="${label}" />
      </div>
    `);
  }
  if (fields.length === 0) return "";
  return `<div style="width:100%; display:flex; flex-direction:column; gap:10px; margin:8px 0;">${fields.join("")}</div>`;
}

function compilePinKeypad(source: string): string {
  if (!source.includes("_buildKeypad()") && !source.includes("_enteredPin")) return "";
  return `
    <div class="fl-pin-dots" id="fl-pin-dots">
      <span class="fl-pin-dot" data-dot="0"></span>
      <span class="fl-pin-dot" data-dot="1"></span>
      <span class="fl-pin-dot" data-dot="2"></span>
      <span class="fl-pin-dot" data-dot="3"></span>
    </div>
    <div class="fl-keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="fl-key" onclick="window.__pressPinDigit('${n}')">${n}</button>`).join("")}
      <div></div>
      <button class="fl-key" onclick="window.__pressPinDigit('0')">0</button>
      <button class="fl-key" onclick="window.__pressPinBackspace()">⌫</button>
    </div>
  `;
}

function compileScreenWidgets(
  screen: DiscoveredFlutterScreen,
  theme: FlutterThemeTokens,
  hasDarkGradient: boolean
): string {
  const fullSource = screen.source;
  const cleanSource = stripDialogsAndModals(fullSource);
  const parts: string[] = [];

  const imgMatch = cleanSource.match(/Image\.asset\(\s*(['"])([^'"]+)\1/);
  if (imgMatch) {
    parts.push(
      `<img src="/__asset/${imgMatch[2]}" style="width:76px; height:76px; border-radius:20px; object-fit:cover; box-shadow:0 8px 20px rgba(0,0,0,0.3); margin-bottom:8px;" onerror="this.style.display='none'" />`
    );
  }

  if (fullSource.includes("_buildFinancialSummary")) {
    parts.push(`
      <div class="fl-summary-card" style="background:linear-gradient(135deg, ${theme.primaryColor}, #00251a);">
        <div style="font-size:11px; color:rgba(255,255,255,0.65); letter-spacing:1.2px;">NOVEMBRE 2026</div>
        <div style="font-size:28px; font-weight:800; color:#fff; margin:4px 0;">1 240.0 kg</div>
        <div style="font-size:16px; font-weight:700; color:${theme.accentColor}; margin-bottom:10px;">Revenu: 434 000 F</div>
        <div class="fl-summary-box">
          <div class="fl-summary-row"><span>Payé saigneurs</span><span style="color:#ffab40">-186 000 F</span></div>
          <div class="fl-summary-row"><span>Dépenses</span><span style="color:#ff5252">-42 500 F</span></div>
          <div class="fl-summary-row" style="border-top:1px solid rgba(255,255,255,0.15); padding-top:4px; margin-top:4px; font-weight:700;">
            <span>Bénéfice Net</span><span style="color:#69f0ae">+205 500 F</span>
          </div>
        </div>
      </div>
    `);
  }

  const gridHtml = compileActionGrid(fullSource, theme);
  if (gridHtml) {
    parts.push(`<div class="fl-text" style="font-size:16px; font-weight:700; width:100%; text-align:left; margin:4px 0;">Actions Rapides</div>`);
    parts.push(gridHtml);
  }

  const formHtml = compileFormFields(cleanSource);
  if (formHtml) parts.push(formHtml);

  const buildIdx = cleanSource.indexOf("Widget build(");
  const buildSlice = buildIdx !== -1 ? cleanSource.slice(buildIdx) : cleanSource;
  const bodyIdx = buildSlice.indexOf("body:");
  const fabIdx = buildSlice.indexOf("floatingActionButton:");
  const bodySection =
    bodyIdx !== -1
      ? buildSlice.slice(bodyIdx + 5, fabIdx !== -1 ? fabIdx : undefined)
      : buildSlice;

  const tokenRegex = /(?:const\s+|new\s+)?(Text|SizedBox|ElevatedButton|OutlinedButton)\s*(?:\.icon\s*)?\(/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(bodySection)) !== null) {
    const widgetType = match[1];
    const openParenIdx = match.index + match[0].length - 1;
    const inner = extractBalancedParen(bodySection, openParenIdx);

    if (widgetType === "Text" && !fullSource.includes("_buildFinancialSummary")) {
      const ternaryMatch = inner.match(/\?\s*(['"])([\s\S]*?)\1\s*:\s*(['"])([\s\S]*?)\3/);
      const rawStr = ternaryMatch ? ternaryMatch[4] : extractDartStringLiteral(inner);

      if (
        rawStr &&
        !rawStr.startsWith("Erreur") &&
        !rawStr.startsWith("Chargement") &&
        !rawStr.includes("_lockExpiry") &&
        rawStr !== "MMMM yyyy" &&
        rawStr !== "dd/MM/yyyy"
      ) {
        const textVal = formatInterpolatedText(rawStr);
        const styleCss = parseTextStyleCss(inner, theme, hasDarkGradient);
        parts.push(`<div class="fl-text" style="${styleCss}">${textVal}</div>`);
      }
    } else if (widgetType === "SizedBox" && !fullSource.includes("_buildFinancialSummary")) {
      const hMatch = inner.match(/height\s*:\s*([0-9.]+)/);
      if (hMatch) {
        const h = Math.min(parseFloat(hMatch[1]), 16);
        parts.push(`<div style="height: ${h}px; width: 100%; flex-shrink: 0;"></div>`);
      }
    } else if (widgetType === "ElevatedButton" || widgetType === "OutlinedButton") {
      const labelMatch = inner.match(/Text\(\s*(?:[a-zA-Z0-9_]+\s*\?\s*['"][^'"]+['"]\s*:\s*)?(['"])([\s\S]*?)\1/);
      const label = labelMatch ? formatInterpolatedText(labelMatch[2]) : "Valider";
      const bg = widgetType === "OutlinedButton" ? "transparent" : resolveDartColor(inner, theme, theme.primaryColor);
      const border = widgetType === "OutlinedButton" ? `border:1.5px solid ${theme.primaryColor}; color:${theme.primaryColor};` : "";
      parts.push(
        `<button class="fl-btn" style="background:${bg}; ${border}" onclick="window.__incrementFlutterCounter()">${label}</button>`
      );
    }

    tokenRegex.lastIndex = openParenIdx + inner.length + 1;
  }

  const pinHtml = compilePinKeypad(fullSource);
  if (pinHtml) parts.push(pinHtml);

  return parts.join("\n");
}

/**
 * Compiles a Flutter workspace snapshot into a live-patchable JSON model.
 */
export function compileFlutterWorkspace(snapshot: FlutterWorkspaceSnapshot): CompiledFlutterPayload {
  const { theme, screens, activeScreen } = snapshot;

  if (!activeScreen) {
    return {
      scaffoldBg: theme.scaffoldBg,
      scaffoldGradient: "",
      isDark: theme.isDark,
      showDebugBanner: theme.showDebugBanner,
      hasAppBar: true,
      appBarTitle: escapeHtml(theme.appTitle),
      appBarSubtitle: "",
      appBarBg: theme.primaryColor,
      bodyHtml: `<div class="fl-text">Aucun écran Scaffold détecté</div>`,
      bodyAlignCenter: true,
      hasFab: false,
      fabBg: theme.primaryColor,
      fabLabel: "",
      fabIcon: "+",
      activeScreenId: "",
      screens: [],
    };
  }

  const src = activeScreen.source;

  let scaffoldGradient = "";
  const hasSliverAppBar = src.includes("SliverAppBar(");
  if (!hasSliverAppBar && src.includes("LinearGradient(")) {
    const gradMatch = src.match(/LinearGradient\s*\([\s\S]*?colors\s*:\s*\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]/);
    if (gradMatch) {
      const c1 = resolveDartColor(gradMatch[1], theme, theme.primaryColor);
      const c2 = resolveDartColor(gradMatch[2], theme, "#00251a");
      scaffoldGradient = `linear-gradient(180deg, ${c1} 0%, ${c2} 100%)`;
    }
  }

  let hasAppBar = false;
  let appBarTitle = "";
  let appBarSubtitle = "";
  let appBarBg = theme.isDark ? "#18181b" : theme.primaryColor;

  const appBarIdx = src.indexOf("AppBar(");
  if (appBarIdx !== -1) {
    hasAppBar = true;
    const inner = extractBalancedParen(src, appBarIdx + 6);
    const ternaryMatch = inner.match(/Text\(\s*[a-zA-Z0-9_]+\s*\?\s*(['"])([^'"]+)\1\s*:\s*(['"])([^'"]+)\3/);
    const rawTitle = ternaryMatch ? ternaryMatch[4] : extractDartStringLiteral(inner);
    appBarTitle = rawTitle ? formatInterpolatedText(rawTitle) : activeScreen.shortLabel;
    appBarBg = resolveDartColor(inner, theme, appBarBg);
  } else if (hasSliverAppBar) {
    hasAppBar = true;
    appBarTitle = escapeHtml(theme.appTitle);
    appBarSubtitle = "Champ Principal";
    appBarBg = theme.primaryColor;
  }

  let hasFab = false;
  let fabBg = theme.primaryColor;
  let fabLabel = "";
  const fabIcon = "+";

  const fabIdx = src.indexOf("FloatingActionButton");
  if (fabIdx !== -1) {
    hasFab = true;
    const openIdx = src.indexOf("(", fabIdx);
    if (openIdx !== -1) {
      const fabInner = extractBalancedParen(src, openIdx);
      fabBg = resolveDartColor(fabInner, theme, theme.primaryColor);
      const lblMatch = fabInner.match(/label\s*:\s*(?:const\s+)?Text\(\s*(['"])([^'"]+)\1/);
      if (lblMatch) fabLabel = escapeHtml(lblMatch[2]);
    }
  }

  const bodyAlignCenter =
    !hasSliverAppBar &&
    !src.includes("ListView") &&
    !src.includes("Form(") &&
    (src.includes("MainAxisAlignment.center") || src.includes("Center("));

  const bodyHtml = compileScreenWidgets(activeScreen, theme, Boolean(scaffoldGradient));

  return {
    scaffoldBg: theme.scaffoldBg,
    scaffoldGradient,
    isDark: theme.isDark,
    showDebugBanner: theme.showDebugBanner,
    hasAppBar,
    appBarTitle,
    appBarSubtitle,
    appBarBg,
    bodyHtml,
    bodyAlignCenter,
    hasFab,
    fabBg,
    fabLabel,
    fabIcon,
    activeScreenId: activeScreen.id,
    screens: screens.map((s) => ({ id: s.id, label: s.shortLabel })),
  };
}
