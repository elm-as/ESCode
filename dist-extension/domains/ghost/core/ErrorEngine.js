"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorEngine = void 0;
const types_1 = require("../types");
const AzertyLayout_1 = require("../keyboard/AzertyLayout");
const KeyDistance_1 = require("../keyboard/KeyDistance");
const random_1 = require("../infrastructure/random");
const logger_1 = require("../infrastructure/logger");
const typing_context_1 = require("./typing-context");
/**
 * Characters/contexts where errors should be suppressed to avoid
 * breaking critical syntax structures.
 */
const PROTECTED_CHARS = new Set(['\n', '\r', '\t']);
/**
 * Weights for each error type. Higher = more likely to be chosen.
 */
const ERROR_TYPE_WEIGHTS = {
    [types_1.ErrorType.ADJACENT_KEY]: 40,
    [types_1.ErrorType.OMITTED_CHAR]: 15,
    [types_1.ErrorType.REPEATED_CHAR]: 12,
    [types_1.ErrorType.WRONG_CHAR]: 8,
    [types_1.ErrorType.MISSING_SPACE]: 5,
    [types_1.ErrorType.EXTRA_SPACE]: 5,
    [types_1.ErrorType.WRONG_PUNCTUATION]: 8,
    [types_1.ErrorType.WRONG_CASE]: 7,
};
class ErrorEngine {
    layout;
    keyDistance;
    rng;
    logger = logger_1.Logger.getInstance();
    constructor(config) {
        this.layout = new AzertyLayout_1.AzertyLayout();
        this.keyDistance = new KeyDistance_1.KeyDistance(this.layout);
        this.rng = new random_1.SeededRandom(config.deterministicMode ? config.seed : Date.now());
    }
    /**
     * Determine if an error should be generated at this position.
     * @param content The full target content
     * @param position Current character index
     * @param errorRate Error rate (0-100)
     * @returns A generated error, or null if no error should occur
     */
    maybeGenerateError(content, position, errorRate) {
        if (errorRate <= 0 || position >= content.length) {
            return null;
        }
        const char = content[position];
        // Never generate errors on newlines/tabs
        if (PROTECTED_CHARS.has(char)) {
            return null;
        }
        // Analyze context to adjust error probability
        const context = (0, typing_context_1.analyzeTypingContext)(content, position);
        // Apply context multiplier to error rate
        const effectiveRate = (errorRate / 100) * context.contextMultiplier;
        if (!this.rng.chance(effectiveRate)) {
            return null;
        }
        // Select error type
        const errorType = this.selectErrorType(char, context);
        const errorChar = this.generateErrorChar(char, errorType);
        if (errorChar === char) {
            return null; // Could not generate a different character
        }
        this.logger.debug(`Error generated at position ${position}: '${char}' → '${errorChar}' (${errorType})`);
        return {
            type: errorType,
            correctChar: char,
            errorChar,
            position,
        };
    }
    /**
     * Create a PendingError from a GeneratedError for tracking corrections.
     */
    toPendingError(error) {
        return {
            position: error.position,
            correctChar: error.correctChar,
            wrongChar: error.errorChar,
            errorType: error.type,
            charsSinceError: 0,
        };
    }
    /**
     * Select an error type based on weights and context.
     */
    selectErrorType(char, context) {
        const candidates = [];
        for (const [type, weight] of Object.entries(ERROR_TYPE_WEIGHTS)) {
            const errorType = type;
            let adjustedWeight = weight;
            // Adjust weights based on character and context
            if (errorType === types_1.ErrorType.ADJACENT_KEY) {
                // Only if the char is on the AZERTY layout
                if (!this.layout.hasChar(char.toLowerCase())) {
                    adjustedWeight = 0;
                }
            }
            if (errorType === types_1.ErrorType.WRONG_CASE) {
                if (!/[a-zA-ZÀ-ÿ]/.test(char)) {
                    adjustedWeight = 0;
                }
            }
            if (errorType === types_1.ErrorType.MISSING_SPACE || errorType === types_1.ErrorType.EXTRA_SPACE) {
                if (char !== ' ' && errorType === types_1.ErrorType.MISSING_SPACE) {
                    adjustedWeight = 0;
                }
                if (char === ' ' && errorType === types_1.ErrorType.EXTRA_SPACE) {
                    adjustedWeight = 0;
                }
            }
            if (adjustedWeight > 0) {
                candidates.push({ type: errorType, weight: adjustedWeight });
            }
        }
        if (candidates.length === 0) {
            return types_1.ErrorType.ADJACENT_KEY;
        }
        const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
        let roll = this.rng.next() * totalWeight;
        for (const candidate of candidates) {
            roll -= candidate.weight;
            if (roll <= 0) {
                return candidate.type;
            }
        }
        return candidates[candidates.length - 1].type;
    }
    /**
     * Generate the actual erroneous character for the given error type.
     */
    generateErrorChar(char, errorType) {
        switch (errorType) {
            case types_1.ErrorType.ADJACENT_KEY:
                return this.adjacentKeyError(char);
            case types_1.ErrorType.OMITTED_CHAR:
                return ''; // Character is omitted
            case types_1.ErrorType.REPEATED_CHAR:
                return char + char; // Character is doubled
            case types_1.ErrorType.WRONG_CHAR:
                return this.randomWrongChar(char);
            case types_1.ErrorType.MISSING_SPACE:
                return ''; // Space is omitted
            case types_1.ErrorType.EXTRA_SPACE:
                return ' ' + char; // Extra space before char
            case types_1.ErrorType.WRONG_PUNCTUATION:
                return this.wrongPunctuation(char);
            case types_1.ErrorType.WRONG_CASE:
                return this.toggleCase(char);
            default:
                return char;
        }
    }
    /**
     * Get an adjacent key on the AZERTY layout.
     */
    adjacentKeyError(char) {
        const lowerChar = char.toLowerCase();
        const neighbor = this.keyDistance.getWeightedRandomNeighbor(lowerChar, this.rng.next());
        // Preserve case
        if (char !== lowerChar && neighbor.length === 1) {
            return neighbor.toUpperCase();
        }
        return neighbor;
    }
    /**
     * Generate a random wrong character (not adjacent, just wrong).
     */
    randomWrongChar(char) {
        const allChars = this.layout.getAllChars().filter(c => c !== char && c.length === 1);
        if (allChars.length === 0) {
            return char;
        }
        return this.rng.pick(allChars);
    }
    /**
     * Swap punctuation with a nearby/related punctuation mark.
     */
    wrongPunctuation(char) {
        const punctuationSets = [
            ['.', ',', ';', ':'],
            ['(', ')', '[', ']', '{', '}'],
            ['"', "'", '`'],
            ['!', '?', '.'],
            ['-', '_', '='],
            ['/', '\\', '|'],
        ];
        for (const set of punctuationSets) {
            if (set.includes(char)) {
                const others = set.filter(c => c !== char);
                if (others.length > 0) {
                    return this.rng.pick(others);
                }
            }
        }
        // Fallback: try adjacent key
        return this.adjacentKeyError(char);
    }
    /**
     * Toggle character case.
     */
    toggleCase(char) {
        if (char === char.toLowerCase()) {
            return char.toUpperCase();
        }
        return char.toLowerCase();
    }
}
exports.ErrorEngine = ErrorEngine;
//# sourceMappingURL=ErrorEngine.js.map