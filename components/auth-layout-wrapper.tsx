"use client";

import { usePathname } from "next/navigation";
import { AuthLayout } from "./auth-layout";

export function AuthLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // If on auth page, show the actual auth page content
  if (pathname === "/auth") {
    return <>{children}</>;
  }

  // Otherwise, redirect to auth and show loading
  return <AuthLayout />;
}
