import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ChatLayout } from "@/components/chat/chat-layout";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { FocusModeProvider } from "@/components/providers/focus-mode-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { NavigationHandler } from "@/components/navigation-handler";
import { ThemeInitializer } from "@/components/theme-provider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Chat",
  description: "Clean AI chat application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        
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
                <ChatLayout>
                  {children}
                </ChatLayout>
              </FocusModeProvider>
              <Toaster
                theme={undefined}
                richColors
                closeButton={false}
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                  },
                }}
              />
            </ThemeProvider>
          </QueryProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
