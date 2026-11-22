import type { Metadata } from "next";
import {
  Be_Vietnam_Pro,
  Geist,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Merriweather,
  Noto_Sans,
  Roboto_Slab,
  Source_Sans_3,
} from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

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

// The app's text and mono fonts (globals.css --font-sans / --font-mono),
// the pair DocsHub uses. Unlike Geist / Geist Mono they ship a Vietnamese
// subset, so tone-marked letters (ị, ữ, ồ…) come from the same font
// instead of a fallback. Geist stays loaded: diagrams can pick Geist Mono.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "X Flow Tool",
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${beVietnamPro.variable} ${notoSans.variable} ${sourceSans3.variable} ${robotoSlab.variable} ${merriweather.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      {/* Browser extensions add attributes to <body> before React hydrates
          (ColorZilla's cz-shortcut-listen, Grammarly's data-*): not a real mismatch. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <AuthProvider>{children}</AuthProvider>
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
