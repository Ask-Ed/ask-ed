"use client";

import { useEffect } from "react";
import { redirect } from "next/navigation";

export function AuthLayout() {
  useEffect(() => {
    redirect("/auth");
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-muted border-t-foreground" />
    </div>
  );
}