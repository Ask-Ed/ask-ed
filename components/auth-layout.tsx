"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export function AuthLayout() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only redirect if not already on auth page
    if (pathname !== "/auth") {
      router.push("/auth");
    }
  }, [pathname, router]);

  // If already on auth page, don't show loading spinner
  if (pathname === "/auth") {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-muted border-t-foreground" />
    </div>
  );
}