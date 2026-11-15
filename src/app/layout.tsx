import type { Metadata, Viewport } from "next";
import { Noto_Sans_Sinhala, Noto_Sans_Tamil, Plus_Jakarta_Sans } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const sinhala = Noto_Sans_Sinhala({ variable: "--font-sinhala", subsets: ["sinhala"], preload: false });
const tamil = Noto_Sans_Tamil({ variable: "--font-tamil", subsets: ["tamil"], preload: false });

export const metadata: Metadata = {
  title: "Air Fibre Household",
  description: "Share one 5G data pool across your Air Fibre home and your family's Dialog lines.",
  appleWebApp: { capable: true, title: "Air Fibre", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#4b1170",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${sinhala.variable} ${tamil.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        {/* Phone-width column: the product is a mobile app, shown as a web app for now. */}
        <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-background sm:shadow-[0_0_0_1px_var(--border)]">
          <main className="flex-1 pb-28">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
