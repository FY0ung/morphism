import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/contexts/theme";
import { PoppinsFont, AnuphanFont } from "@/material/fonts";
import LanguageProvider from "@/languages";

export const metadata: Metadata = {
  title: "App",
  description: "Application description.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${PoppinsFont.variable} ${AnuphanFont.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
