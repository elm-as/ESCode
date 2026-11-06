"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STANDARD_PROFILES = void 0;
exports.calculateDeviceDimensions = calculateDeviceDimensions;
exports.STANDARD_PROFILES = [
    { id: "compact-360", name: "Compact Phone (360×800)", width: 360, height: 800, dpi: 2.0, isDefault: false },
    { id: "standard-375", name: "iPhone SE / Standard (375×812)", width: 375, height: 812, dpi: 3.0, isDefault: false },
    { id: "flagship-390", name: "Flagship Modern (390×844)", width: 390, height: 844, dpi: 3.0, isDefault: true },
    { id: "pixel-412", name: "Pixel 8 / Large (412×915)", width: 412, height: 915, dpi: 2.625, isDefault: false },
    { id: "pro-max-432", name: "Pro Max / Ultra (432×960)", width: 432, height: 960, dpi: 3.0, isDefault: false },
];
function calculateDeviceDimensions(profile, orientation) {
    if (orientation === "landscape") {
        return { width: profile.height, height: profile.width };
    }
    return { width: profile.width, height: profile.height };
}
//# sourceMappingURL=device-profiles.js.map