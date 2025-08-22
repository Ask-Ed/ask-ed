"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useThreadMessages,
  toUIMessages,
  optimisticallySendMessage,
} from "@convex-dev/agent/react";
import { useChatStore } from "@/lib/store/chat-store";
import { SharedPrompt } from "./shared-prompt";
import { MessageContent } from "./message-content";

export function ChatInterface() {
  const { currentThreadId, inputValue, setInputValue, setCurrentThread } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mutations
  const createThread = useMutation(api.chat.createChatThread);
  const sendMessage = useMutation(api.chat.sendMessage).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listThreadMessages)
  );

  // Messages query
  const messages = useThreadMessages(
    api.chat.listThreadMessages,
    currentThreadId ? { threadId: currentThreadId } : "skip",
    { initialNumItems: 50, stream: true }
  );

  const uiMessages = messages.results ? toUIMessages(messages.results) : [];
  const isStreaming = uiMessages.some((msg) => msg.status === "streaming");

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [uiMessages.length]);

  // Handle message sending
  const handleSend = async () => {
    const message = inputValue.trim();
    if (!message) return;

    const edToken = localStorage.getItem("ed-session-key");
    if (!edToken) {
      console.error("ED token required");
      return;
    }

    setInputValue("");

    try {
      if (!currentThreadId) {
        // Create new thread
        const result = await createThread({ firstMessage: message, edToken });
        if (result?.threadId) {
          setCurrentThread(result.threadId);
          window.history.pushState({}, "", `/chat/${result.threadId}`);
        }
      } else {
        // Send to existing thread
        await sendMessage({ threadId: currentThreadId, prompt: message, edToken });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setInputValue(message); // Restore on error
    }
  };

  const isHomeMode = !currentThreadId;

  return (
    <div className="flex flex-col h-screen bg-background">
      <AnimatePresence mode="wait">
        {isHomeMode ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex items-center justify-center p-6"
          >
            <div className="w-full max-w-2xl">
              <SharedPrompt
                value={inputValue}
                onValueChange={setInputValue}
                onSubmit={handleSend}
                placeholder="Start a new conversation..."
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-6 py-6 pb-24">
                <div className="space-y-6">
                  {uiMessages.map((message, index) => (
                    <motion.div
                      key={message.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.role === "user" ? (
                        <div className="max-w-[70%] rounded-2xl px-4 py-3 text-sm text-white bg-brand-primary">
                          {message.text}
                        </div>
                      ) : (
                        <div className="max-w-[85%]">
                          <MessageContent message={message} />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-border/50 bg-background/95 backdrop-blur-sm">
              <div className="max-w-4xl mx-auto px-6 py-4">
                <SharedPrompt
                  value={inputValue}
                  onValueChange={setInputValue}
                  onSubmit={handleSend}
                  isLoading={isStreaming}
                  placeholder="Continue your conversation..."
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}