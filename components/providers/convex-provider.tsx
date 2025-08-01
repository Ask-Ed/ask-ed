"use client";

import { ReactNode, useState, useEffect } from "react";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AnimatePresence } from "framer-motion";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function ConvexAuthWrapper({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  useEffect(() => {
    // Only show loading on first auth check, not on subsequent navigations
    if (!isLoading && !hasInitialized) {
      setIsExiting(true);
    }
  }, [isLoading, hasInitialized]);
  
  const handleLoadingComplete = () => {
    if (isExiting) {
      setHasInitialized(true);
    }
  };
  
  // Show loading only during initial auth check
  if (isLoading && !hasInitialized) {
    return (
      <LoadingScreen 
        isExiting={isExiting} 
        onAnimationComplete={handleLoadingComplete}
      />
    );
  }
  
  return <>{children}</>;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <ConvexAuthWrapper>
        {children}
      </ConvexAuthWrapper>
    </ConvexBetterAuthProvider>
  );
}