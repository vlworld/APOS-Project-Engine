import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { THEME_BOOTSTRAP_SCRIPT, THEME_COOKIE, isThemeMode } from "@/lib/theme";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "APOS — Apricus Project OS",
  description: "Bauprojekt-Management-System — ProjectEngine",
  icons: { icon: "/favicon.ico" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // SSR: Theme-Cookie auslesen, damit das HTML mit der richtigen Klasse
  // gerendert wird. Verhindert weißen Blitz beim Laden.
  const cookieStore = await cookies();
  const cookieMode = cookieStore.get(THEME_COOKIE)?.value;
  const initialMode = cookieMode && isThemeMode(cookieMode) ? cookieMode : "light";
  const initialDark = initialMode === "dark";
  const htmlClass = `h-full${initialDark ? " dark" : ""}`;

  return (
    <html lang="de" className={htmlClass} data-theme-mode={initialMode}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className={`${inter.className} h-full antialiased`}>
        <SessionProvider session={session}>
          <ThemeProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
