import type { Metadata, Viewport } from "next";
import { cssVariableBlock } from "@spectra/design-tokens/css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spectra — materialize software from intent",
  description:
    "Zero-interface, fluid on-demand software. Express intent; Spectra materializes a bespoke application in milliseconds.",
};

export const viewport: Viewport = {
  themeColor: "#08080A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Single source of truth: Spectral Prism tokens as CSS custom properties. */}
        <style dangerouslySetInnerHTML={{ __html: cssVariableBlock(":root") }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
