export type DesktopPlatform = "windows" | "macos" | "linux";

export function desktopPlatformForUserAgent(userAgent: string, maxTouchPoints = 0): DesktopPlatform | null {
  if (/Android|iPhone|iPad|iPod|Mobile|CrOS/i.test(userAgent)) return null;
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return null;
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macos";
  if (/Linux|X11/i.test(userAgent)) return "linux";
  return null;
}

export function desktopPlatformLabel(platform: DesktopPlatform) {
  if (platform === "windows") return "Windows";
  if (platform === "macos") return "macOS";
  return "Linux";
}
