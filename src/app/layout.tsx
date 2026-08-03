import type { Metadata } from "next";
import {
  Be_Vietnam_Pro,
  Geist,
  Geist_Mono,
  Merriweather,
  Noto_Sans,
  Roboto_Slab,
  Source_Sans_3,
} from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin-ext"],
});

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["vietnamese"],
  weight: "variable",
});

const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans-3",
  subsets: ["vietnamese"],
  weight: "variable",
});

const robotoSlab = Roboto_Slab({
  variable: "--font-roboto-slab",
  subsets: ["vietnamese"],
  weight: "variable",
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["vietnamese"],
  weight: "variable",
});

export const metadata: Metadata = {
  title: "Flowgram Tools",
  description: "Animated flowchart editor built with Next.js and flowgram.ai",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${beVietnamPro.variable} ${notoSans.variable} ${sourceSans3.variable} ${robotoSlab.variable} ${merriweather.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
        <Toaster theme="dark" richColors position="top-right" />
      </body>
    </html>
  );
}
