import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile.css";
import "./toolbar.css";
import "./drawing.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content" };

export const metadata: Metadata = {
  title: "Cadverix 3D editor",
  description: "Browser-based Cadverix 3D design workspace",
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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
