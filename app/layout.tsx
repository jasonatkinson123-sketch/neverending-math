import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neverending Math",
  description: "A mysterious daily math ritual in an abandoned classroom.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
