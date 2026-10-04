import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile.css";
import "./toolbar.css";
import "./drawing.css";
import "./modeling.css";
import "./offline.css";

const STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";
const INSTALL_EVENTS = `window.addEventListener("beforeinstallprompt",function(event){event.preventDefault();window.cadverixInstallPrompt=event;window.dispatchEvent(new Event("cadverix-install-available"));});window.addEventListener("appinstalled",function(){window.cadverixInstallPrompt=null;});`;

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content" };

export const metadata: Metadata = {
  title: "Cadverix 3D editor",
  description: "Browser-based Cadverix 3D design workspace",
  ...(STATIC_EXPORT ? { manifest: "/manifest.webmanifest", applicationName: "Cadverix 3D", appleWebApp: { capable: true, title: "Cadverix 3D", statusBarStyle: "default" as const } } : {}),
  icons: {
    icon: [
      { url: "assets/cadverix/cadverix-logo.svg", type: "image/svg+xml" },
      { url: "assets/cadverix/cadverix-favicon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: { url: "assets/cadverix/cadverix-apple-touch-icon.png", sizes: "180x180" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <body suppressHydrationWarning>{STATIC_EXPORT ? <script dangerouslySetInnerHTML={{ __html: INSTALL_EVENTS }} /> : null}{children}</body>
    </html>
  );
}
