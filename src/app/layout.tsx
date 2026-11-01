import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-unbounded", weight: ["300", "400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "Uzum sehr — Исполни мечту! Зажги огонь на ёлке",
  description: "Одна лампочка — одна детская мечта — одно доброе дело.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#080d27",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${unbounded.variable}`}>
      <body>{children}</body>
    </html>
  );
}
