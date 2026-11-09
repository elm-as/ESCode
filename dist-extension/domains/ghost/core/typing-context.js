"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTypingContext = analyzeTypingContext;
/** String delimiters — errors on these are de-prioritized */
const STRING_DELIMITERS = new Set(['"', "'", '`']);
/** Bracket characters — errors on these are reduced */
const BRACKET_CHARS = new Set(['(', ')', '{', '}', '[', ']', '<', '>']);
/** How far back we look to decide whether we are inside a string literal. */
const STRING_LOOKBEHIND = 50;
/**
 * Analyzes the typing context at a given position. Pure function.
 * @param content Full target content
 * @param position Index of the character about to be typed
 */
function analyzeTypingContext(content, position) {
    const char = content[position];
    const before = content.slice(Math.max(0, position - STRING_LOOKBEHIND), position);
    const lineStart = content.lastIndexOf('\n', position - 1) + 1;
    const lineBeforePos = content.slice(lineStart, position);
    const context = {
        inString: isInString(before),
        inComment: lineBeforePos.includes('//') || isInBlockComment(content, position),
        atIndentation: /^\s*$/.test(lineBeforePos),
        isDelimiter: STRING_DELIMITERS.has(char),
        isBracket: BRACKET_CHARS.has(char),
    };
    return { ...context, contextMultiplier: computeContextMultiplier(context) };
}
function computeContextMultiplier(context) {
    let multiplier = 1.0;
    if (context.inString) {
        multiplier *= 0.7;
    }
    if (context.inComment) {
        multiplier *= 0.5;
    }
    if (context.atIndentation) {
        multiplier *= 0.2;
    }
    if (context.isDelimiter) {
        multiplier *= 0.3;
    }
    if (context.isBracket) {
        multiplier *= 0.4;
    }
    return multiplier;
}
/** Rough check whether the end of textBefore is inside a string literal. */
function isInString(textBefore) {
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    for (let i = 0; i < textBefore.length; i++) {
        const ch = textBefore[i];
        if (i > 0 && textBefore[i - 1] === '\\') {
            continue;
        }
        if (ch === '"' && !inSingle && !inTemplate) {
            inDouble = !inDouble;
        }
        else if (ch === "'" && !inDouble && !inTemplate) {
            inSingle = !inSingle;
        }
        else if (ch === '`' && !inDouble && !inSingle) {
            inTemplate = !inTemplate;
        }
    }
    return inSingle || inDouble || inTemplate;
}
function isInBlockComment(content, position) {
    const before = content.slice(0, position);
    return before.lastIndexOf('/*') > before.lastIndexOf('*/');
}
//# sourceMappingURL=typing-context.js.map