import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/nav/BottomNav";
import TopNav from "@/components/nav/TopNav";
import { RoleProvider } from "@/lib/RoleProvider";

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
    <html lang="vi" className="h-full">
      <body
        className="min-h-full flex flex-col bg-bg text-ink antialiased"
        suppressHydrationWarning
      >
        <RoleProvider>
          <TopNav />
          <div className="flex-1 pb-20 lg:pb-0">{children}</div>
          <BottomNav />
        </RoleProvider>
      </body>
    </html>
  );
}
