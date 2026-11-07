"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileFlutterWorkspace = compileFlutterWorkspace;
const flutter_project_scanner_1 = require("./flutter-project-scanner");
function escapeHtml(raw) {
    return raw
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function formatInterpolatedText(rawText) {
    const escaped = escapeHtml(rawText);
    return escaped
        .replace(/\$\{?_(counter)\}?/g, `<span data-flutter-var="_counter">0</span>`)
        .replace(/\$\{?(counter)\}?/g, `<span data-flutter-var="counter">0</span>`)
        .replace(/\$\{?totalPoidsNet[^}]*\}?/g, "1 240.0")
        .replace(/\$\{?fmt\.format\(totalRevenu\)\}?/g, "434 000")
        .replace(/\$\{?fmt\.format\(totalPayeSaigneurs\)\}?/g, "186 000")
        .replace(/\$\{?fmt\.format\(totalDepenses\)\}?/g, "42 500")
        .replace(/\$\{?fmt\.format\(benefice\)\}?/g, "205 500")
        .replace(/\$\{?monthLabel[^}]*\}?/g, "NOVEMBRE 2026");
}
function extractBalancedParen(source, startIdx) {
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    for (let i = startIdx; i < source.length; i++) {
        const ch = source[i];
        const prev = i > 0 ? source[i - 1] : "";
        if (ch === "'" && !inDouble && prev !== "\\")
            inSingle = !inSingle;
        else if (ch === '"' && !inSingle && prev !== "\\")
            inDouble = !inDouble;
        else if (!inSingle && !inDouble) {
            if (ch === "(")
                depth++;
            else if (ch === ")") {
                depth--;
                if (depth === 0)
                    return source.slice(startIdx + 1, i);
            }
        }
    }
    return source.slice(startIdx + 1);
}
function parseTextStyleCss(block, theme, onDarkBg) {
    const styles = [];
    const defaultColor = onDarkBg || theme.isDark ? "#ffffff" : "#1f2937";
    const color = (0, flutter_project_scanner_1.resolveDartColor)(block, theme, defaultColor);
    if (color)
        styles.push(`color: ${color}`);
    const sizeMatch = block.match(/fontSize\s*:\s*([0-9.]+)/);
    if (sizeMatch)
        styles.push(`font-size: ${sizeMatch[1]}px`);
    if (block.includes("FontWeight.bold") || block.includes("FontWeight.w700")) {
        styles.push("font-weight: 700");
    }
    else if (block.includes("FontWeight.w600")) {
        styles.push("font-weight: 600");
    }
    const spacingMatch = block.match(/letterSpacing\s*:\s*(-?[0-9.]+)/);
    if (spacingMatch)
        styles.push(`letter-spacing: ${spacingMatch[1]}px`);
    return styles.join("; ");
}
function compileActionGrid(source, theme) {
    const actions = [];
    const regex = /_actionButton\s*\([^,]+,\s*Icons\.([a-z0-9_]+)\s*,\s*(['"])([^'"]+)\2\s*,\s*([^,]+),\s*\(\)\s*\{([\s\S]*?)\}\s*\)/g;
    let m;
    while ((m = regex.exec(source)) !== null) {
        const iconName = m[1];
        const label = escapeHtml(m[3]);
        const color = (0, flutter_project_scanner_1.resolveDartColor)(m[4], theme, theme.primaryColor);
        const navMatch = m[5].match(/([A-Za-z0-9_]+Screen|[A-Za-z0-9_]+Dashboard)\s*\(/);
        const targetScreen = navMatch ? navMatch[1] : "";
        const iconGlyph = iconName.includes("cart") ? "⚖️" :
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
    if (actions.length === 0)
        return "";
    return `<div class="fl-action-grid">${actions.join("")}</div>`;
}
function compileFormFields(source, theme) {
    const fields = [];
    const fieldRegex = /_field\s*\([^,]+,\s*(['"])([^'"]+)\1/g;
    let m;
    while ((m = fieldRegex.exec(source)) !== null) {
        const label = escapeHtml(m[2]);
        fields.push(`
      <div class="fl-input-group">
        <label class="fl-input-label">${label}</label>
        <input class="fl-input" type="text" placeholder="${label}" />
      </div>
    `);
    }
    const decRegex = /InputDecoration\s*\([\s\S]*?labelText\s*:\s*(['"])([^'"]+)\1/g;
    while ((m = decRegex.exec(source)) !== null) {
        const label = escapeHtml(m[2]);
        fields.push(`
      <div class="fl-input-group">
        <label class="fl-input-label">${label}</label>
        <input class="fl-input" type="text" placeholder="${label}" />
      </div>
    `);
    }
    if (fields.length === 0)
        return "";
    return `<div style="width:100%; display:flex; flex-direction:column; gap:10px; margin:8px 0;">${fields.join("")}</div>`;
}
function compilePinKeypad(source, theme) {
    if (!source.includes("_buildKeypad()") && !source.includes("_enteredPin"))
        return "";
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
function compileScreenWidgets(screen, theme, hasDarkGradient) {
    const source = screen.source;
    const parts = [];
    // 1. Check Image.asset(...)
    const imgMatch = source.match(/Image\.asset\(\s*(['"])([^'"]+)\1/);
    if (imgMatch) {
        parts.push(`<img src="/__asset/${imgMatch[2]}" style="width:76px; height:76px; border-radius:20px; object-fit:cover; box-shadow:0 8px 20px rgba(0,0,0,0.3); margin-bottom:12px;" onerror="this.style.display='none'" />`);
    }
    // 2. Parse primary build() widgets in order
    const buildIdx = source.indexOf("Widget build(");
    const mainSlice = buildIdx !== -1 ? source.slice(buildIdx) : source;
    const fabIdx = mainSlice.indexOf("floatingActionButton:");
    const bodySection = fabIdx !== -1 ? mainSlice.slice(0, fabIdx) : mainSlice;
    const tokenRegex = /(?:const\s+|new\s+)?(Text|SizedBox|ElevatedButton|OutlinedButton|TextButton)\s*(?:\.icon\s*)?\(/g;
    let match;
    while ((match = tokenRegex.exec(bodySection)) !== null) {
        const widgetType = match[1];
        const openParenIdx = match.index + match[0].length - 1;
        const inner = extractBalancedParen(bodySection, openParenIdx);
        if (widgetType === "Text") {
            const strMatch = inner.match(/^\s*(['"])([\s\S]*?)\1/);
            const ternaryMatch = !strMatch
                ? inner.match(/\?\s*(['"])([\s\S]*?)\1\s*:\s*(['"])([\s\S]*?)\3/)
                : null;
            const rawStr = strMatch ? strMatch[2] : ternaryMatch ? ternaryMatch[4] : null;
            if (rawStr && !rawStr.includes("AppBar")) {
                const textVal = formatInterpolatedText(rawStr);
                const styleCss = parseTextStyleCss(inner, theme, hasDarkGradient);
                parts.push(`<div class="fl-text" style="${styleCss}">${textVal}</div>`);
            }
        }
        else if (widgetType === "SizedBox") {
            const hMatch = inner.match(/height\s*:\s*([0-9.]+)/);
            if (hMatch) {
                const h = Math.min(parseFloat(hMatch[1]), 28);
                parts.push(`<div style="height: ${h}px; width: 100%; flex-shrink: 0;"></div>`);
            }
        }
        else if (widgetType === "ElevatedButton" || widgetType === "OutlinedButton") {
            const labelMatch = inner.match(/Text\(\s*(?:[a-zA-Z0-9_]+\s*\?\s*['"][^'"]+['"]\s*:\s*)?(['"])([\s\S]*?)\1/);
            const label = labelMatch ? formatInterpolatedText(labelMatch[2]) : "Valider";
            const bg = widgetType === "OutlinedButton" ? "transparent" : (0, flutter_project_scanner_1.resolveDartColor)(inner, theme, theme.primaryColor);
            const border = widgetType === "OutlinedButton" ? `border:1.5px solid ${theme.primaryColor}; color:${theme.primaryColor};` : "";
            parts.push(`<button class="fl-btn" style="background:${bg}; ${border}" onclick="window.__incrementFlutterCounter()">${label}</button>`);
        }
        tokenRegex.lastIndex = openParenIdx + inner.length + 1;
    }
    // 3. Inject specialized components (PIN Keypad, Form Fields, Action Grid, Financial Card)
    const pinHtml = compilePinKeypad(source, theme);
    if (pinHtml)
        parts.push(pinHtml);
    const formHtml = compileFormFields(source, theme);
    if (formHtml)
        parts.push(formHtml);
    if (source.includes("_buildFinancialSummary")) {
        parts.unshift(`
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
    const gridHtml = compileActionGrid(source, theme);
    if (gridHtml)
        parts.push(gridHtml);
    return parts.join("\n");
}
/**
 * Compiles a Flutter workspace snapshot into a live-patchable JSON model.
 */
function compileFlutterWorkspace(snapshot) {
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
    // Detect full-screen LinearGradient (e.g. LockScreen)
    let scaffoldGradient = "";
    const hasSliverAppBar = src.includes("SliverAppBar(");
    if (!hasSliverAppBar && src.includes("LinearGradient(")) {
        const gradMatch = src.match(/LinearGradient\s*\([\s\S]*?colors\s*:\s*\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]/);
        if (gradMatch) {
            const c1 = (0, flutter_project_scanner_1.resolveDartColor)(gradMatch[1], theme, theme.primaryColor);
            const c2 = (0, flutter_project_scanner_1.resolveDartColor)(gradMatch[2], theme, "#00251a");
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
        const tMatch = inner.match(/Text\(\s*(?:[a-zA-Z0-9_]+\s*\?\s*['"][^'"]+['"]\s*:\s*)?(['"])([\s\S]*?)\1/);
        appBarTitle = tMatch ? formatInterpolatedText(tMatch[2]) : activeScreen.shortLabel;
        appBarBg = (0, flutter_project_scanner_1.resolveDartColor)(inner, theme, appBarBg);
    }
    else if (hasSliverAppBar) {
        hasAppBar = true;
        appBarTitle = escapeHtml(theme.appTitle);
        appBarSubtitle = "Champ Principal";
        appBarBg = theme.primaryColor;
    }
    let hasFab = false;
    let fabBg = theme.primaryColor;
    let fabLabel = "";
    let fabIcon = "+";
    const fabIdx = src.indexOf("FloatingActionButton");
    if (fabIdx !== -1) {
        hasFab = true;
        const openIdx = src.indexOf("(", fabIdx);
        if (openIdx !== -1) {
            const fabInner = extractBalancedParen(src, openIdx);
            fabBg = (0, flutter_project_scanner_1.resolveDartColor)(fabInner, theme, theme.primaryColor);
            const lblMatch = fabInner.match(/label\s*:\s*(?:const\s+)?Text\(\s*(['"])([^'"]+)\1/);
            if (lblMatch)
                fabLabel = escapeHtml(lblMatch[2]);
        }
    }
    const bodyAlignCenter = !hasSliverAppBar &&
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
//# sourceMappingURL=flutter-live-compiler.js.map