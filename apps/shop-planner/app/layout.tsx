import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop Planner — Nullscape Tools",
  description: "Visual Nullscape shop and upgrade dependency planner",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
