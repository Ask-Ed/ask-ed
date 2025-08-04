"use client";

import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useChatStore } from "@/lib/store/chat-store";
import { SharedPrompt } from "@/components/chat/shared-prompt";

function MainApp() {
  const [isLoading, setIsLoading] = useState(false);
  const createThread = useAction(api.chat.createChatThread);
  const router = useRouter();
  const { 
    inputValue, 
    setCurrentThread,
    isTransitioning,
    setTransitioning
  } = useChatStore();

  const handleSubmit = async () => {
    if (!inputValue.trim() || isLoading || isTransitioning) return;

    const message = inputValue.trim();
    setIsLoading(true);
    setTransitioning(true);

    try {
      // Get ED session token from localStorage if available
      const edToken = typeof window !== 'undefined' 
        ? localStorage.getItem("ed-session-key") || undefined
        : undefined;

      // Create thread with the first message and ED token
      const response = await createThread({ 
        firstMessage: message,
        edToken 
      });
      
      if (response?.threadId) {
        setCurrentThread(response.threadId);
        
        // Navigate during the animation (after input starts moving down)
        setTimeout(() => {
          router.push(`/chat/${response.threadId}`);
        }, 350); // Navigate at the right moment for smooth transition
      }
    } catch (error) {
      console.error("Error creating chat thread:", error);
      setIsLoading(false);
      setTransitioning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 relative">
      <motion.div 
        className="absolute inset-0 flex items-center justify-center"
        animate={{ 
          y: isTransitioning ? "calc(50vh - 4rem)" : 0,
          opacity: isTransitioning ? 0.8 : 1,
        }}
        transition={{ 
          type: "spring", 
          damping: 30, 
          stiffness: 250,
          duration: 0.6
        }}
      >
        <div className="w-full max-w-2xl mx-auto">
          <SharedPrompt
            onSubmit={handleSubmit}
            isLoading={isLoading}
            placeholder="Start a new conversation..."
            className="w-full"
          />
        </div>
      </motion.div>
    </div>
  );
}

function RedirectToLogin() {
  const router = useRouter();

  useEffect(() => {
    router.push("/auth");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-muted border-t-foreground" />
    </div>
  );
}

export default function Page() {
  return (
    <>
      <Unauthenticated>
        <RedirectToLogin />
      </Unauthenticated>
      <Authenticated>
        <MainApp />
      </Authenticated>
    </>
  );
}
