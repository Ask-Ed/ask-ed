"use client";

import { useDocumentStore } from "@/lib/store/document-store";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

export function NavigationHandler() {
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get store actions directly to avoid selector issues
  const setIsMainPage = useDocumentStore((state) => state.setIsMainPage);
  const clearCurrentDocument = useDocumentStore(
    (state) => state.clearCurrentDocument
  );

  const handleNavigation = useCallback(
    (currentPath: string) => {
      const isMainPage = currentPath === "/";
      setIsMainPage(isMainPage);

      // Clear document state when navigating to main page
      if (isMainPage) {
        clearCurrentDocument();
      }
    },
    [setIsMainPage, clearCurrentDocument]
  );

  useEffect(() => {
    // Initialize navigation state immediately on mount
    handleNavigation(pathname);
    prevPathnameRef.current = pathname;
  }, []); // Run once on mount

  useEffect(() => {
    // Handle subsequent navigation changes
    if (prevPathnameRef.current === pathname) return;

    prevPathnameRef.current = pathname;

    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Use setTimeout to avoid immediate re-renders and batch updates
    updateTimeoutRef.current = setTimeout(() => {
      handleNavigation(pathname);
    }, 0);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [pathname, handleNavigation]);

  return null; // This component doesn't render anything
}
