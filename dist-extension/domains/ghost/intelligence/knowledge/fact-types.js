"use strict";
/**
 * Formal raw fact definitions extracted from code.
 * Raw facts represent direct structural and semantic observations:
 * declared symbols, resolved/unresolved references, scopes, exports, and imports.
 *
 * All higher-level conclusions (e.g. missing imports, diagnostics) are Findings,
 * derived downstream by the InferenceEngine.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RawPredicate = void 0;
var RawPredicate;
(function (RawPredicate) {
    RawPredicate["DECLARES"] = "declares";
    RawPredicate["REFERENCES"] = "references";
    RawPredicate["EXPORTS"] = "exports";
    RawPredicate["IMPORTS"] = "imports";
    RawPredicate["MANIFEST_DEPENDENCY"] = "manifest_dependency";
})(RawPredicate || (exports.RawPredicate = RawPredicate = {}));
//# sourceMappingURL=fact-types.js.map