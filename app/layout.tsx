import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { I18nProvider, T } from "@/components/i18n/I18nProvider";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import CommandPalette from "@/components/commands/CommandPalette";
import { SearchIndexProvider } from "@/libs/search/SearchIndexProvider";

const googleSans = localFont({
  src: [
    {
      path: "../src/fonts/Google_Sans/GoogleSans-VariableFont_GRAD,opsz,wght.ttf",
      style: "normal",
    },
    {
      path: "../src/fonts/Google_Sans/GoogleSans-Italic-VariableFont_GRAD,opsz,wght.ttf",
      style: "italic",
    },
  ],
  variable: "--font-google-sans",
  display: "swap",
});

const notoSansThai = localFont({
  src: "../src/fonts/Noto_Sans_Thai/NotoSansThai-VariableFont_wdth,wght.ttf",
  variable: "--font-noto-sans-thai",
  display: "swap",
});

const notoSansJp = localFont({
  src: "../src/fonts/Noto_Sans_JP/NotoSansJP-VariableFont_wght.ttf",
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Novelndex",
  description: "Novel indexing app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${googleSans.variable} ${notoSansThai.variable} ${notoSansJp.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <AuthProvider>
          <I18nProvider>
            <SearchIndexProvider>
              <a
                href="#main-content"
                className="sr-only fixed left-4 top-4 z-100 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-stone-400">
                <T k="common.skipToContent" />
              </a>
              <LanguageToggle />
              <CommandPalette />
              {children}
            </SearchIndexProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
