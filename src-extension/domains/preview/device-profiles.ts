export type DeviceOrientation = "portrait" | "landscape";

export type PreviewMode = "fast" | "native";

export interface DeviceProfile {
  id: string;
  name: string;
  width: number;
  height: number;
  dpi: number;
  isDefault: boolean;
}

export const STANDARD_PROFILES: DeviceProfile[] = [
  { id: "fluid", name: "Adaptatif (Plein panneau)", width: 0, height: 0, dpi: 1.0, isDefault: true },
  { id: "iphone-15-pro", name: "iPhone 15 Pro", width: 393, height: 852, dpi: 3.0, isDefault: false },
  { id: "iphone-15-promax", name: "iPhone 15 Pro Max", width: 430, height: 932, dpi: 3.0, isDefault: false },
  { id: "pixel-8-pro", name: "Pixel 8 Pro", width: 412, height: 915, dpi: 2.625, isDefault: false },
  { id: "desktop-hd", name: "Bureau 16:9 (1280×720)", width: 1280, height: 720, dpi: 1.0, isDefault: false },
  { id: "tablet-ipad", name: "iPad (820×1180)", width: 820, height: 1180, dpi: 2.0, isDefault: false },
  { id: "iphone-se", name: "iPhone SE", width: 375, height: 667, dpi: 2.0, isDefault: false },
  { id: "compact-360", name: "Compact (360×800)", width: 360, height: 800, dpi: 2.0, isDefault: false },
  // Backward compatibility alias
  { id: "flagship-390", name: "iPhone 15 Pro", width: 393, height: 852, dpi: 3.0, isDefault: false },
];

export function calculateDeviceDimensions(
  profile: DeviceProfile,
  orientation: DeviceOrientation
): { width: number; height: number } {
  if (profile.id === "fluid" || profile.width === 0) {
    return { width: 0, height: 0 };
  }
  if (orientation === "landscape") {
    return { width: profile.height, height: profile.width };
  }
  return { width: profile.width, height: profile.height };
}
