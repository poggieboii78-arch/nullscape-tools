import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nullscape Altar Price Checker",
  description: "Calculate Protection and Purification Altar prices for Nullscape runs.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "https://nullscape.wiki/wiki/Special:Redirect/file/MoreAltars.png",
    shortcut: "https://nullscape.wiki/wiki/Special:Redirect/file/MoreAltars.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
