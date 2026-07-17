import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/nav/BottomNav";
import TopNav from "@/components/nav/TopNav";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Trạm Bản — Cảnh báo thiên tai Điện Biên",
  description:
    "Cảnh báo thời tiết nguy hiểm theo từng xã ở Điện Biên, có định lượng bất định, đa ngôn ngữ Việt/H'Mông.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2f4b8c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${jetbrainsMono.variable} h-full`}>
      <body
        className="min-h-full flex flex-col bg-bg text-ink antialiased"
        suppressHydrationWarning
      >
        <TopNav />
        <div className="flex-1 pb-20 lg:pb-0">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
