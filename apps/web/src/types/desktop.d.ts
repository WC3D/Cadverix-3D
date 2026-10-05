export {};

type CadverixDesktopUpdateResult = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  downloaded: boolean;
  checkedAt: string;
  error?: string;
};

declare global {
  interface Window {
    cadverixDesktop?: {
      mcpAvailable: boolean;
      getVersion: () => Promise<string>;
      checkForUpdates: () => Promise<CadverixDesktopUpdateResult>;
      installUpdate: () => Promise<CadverixDesktopUpdateResult>;
    };
    sketchforgeDesktop?: Window["cadverixDesktop"];
  }
}
