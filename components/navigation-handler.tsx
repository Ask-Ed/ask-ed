"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useChatStore } from "@/lib/store/chat-store";

export function NavigationHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentThreadId, setCurrentThread } = useChatStore();

  // Extract thread ID from pathname
  const urlThreadId = pathname?.startsWith('/chat/') ? pathname.split('/')[2] : null;

  useEffect(() => {
    // Sync URL with store state
    if (urlThreadId !== currentThreadId) {
      if (urlThreadId && !currentThreadId) {
        // URL has thread ID but store doesn't - update store
        setCurrentThread(urlThreadId);
      } else if (currentThreadId && !urlThreadId && pathname === '/') {
        // Store has thread ID but we're on home page - this is valid, clear store
        setCurrentThread(null);
      } else if (currentThreadId && !urlThreadId && pathname !== '/') {
        // Store has thread ID but URL doesn't have chat route - redirect to chat
        router.replace(`/chat/${currentThreadId}`);
      } else if (urlThreadId && currentThreadId && urlThreadId !== currentThreadId) {
        // Both have thread IDs but they differ - URL wins
        setCurrentThread(urlThreadId);
      }
    }
  }, [pathname, urlThreadId, currentThreadId, setCurrentThread, router]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const newPathname = window.location.pathname;
      const newThreadId = newPathname.startsWith('/chat/') ? newPathname.split('/')[2] : null;
      setCurrentThread(newThreadId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setCurrentThread]);

  return null;
}
