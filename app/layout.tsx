"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { FocusModeProvider } from "@/components/providers/focus-mode-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { NavigationHandler } from "@/components/navigation-handler";
import { ThemeInitializer } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { Authenticated, Unauthenticated } from "convex/react";
import { AuthLayoutWrapper } from "@/components/auth-layout-wrapper";
import { memo } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const toastStyle = {
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--foreground))",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          crossOrigin="anonymous"
          src="//unpkg.com/react-scan/dist/auto.global.js"
        />
        {/* rest of your scripts go under */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConvexClientProvider>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              <ThemeInitializer />
              <FocusModeProvider>
                <NavigationHandler />
                <Authenticated>{children}</Authenticated>
                <Unauthenticated>
                  <AuthLayoutWrapper>{children}</AuthLayoutWrapper>
                </Unauthenticated>
              </FocusModeProvider>
              <Toaster
                theme={undefined}
                richColors
                closeButton={false}
                position="bottom-right"
                toastOptions={{
                  style: toastStyle,
                }}
              />
            </ThemeProvider>
          </QueryProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
