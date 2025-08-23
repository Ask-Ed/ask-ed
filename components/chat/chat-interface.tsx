"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useThreadMessages,
  toUIMessages,
  optimisticallySendMessage,
  useSmoothText,
  type UIMessage,
} from "@convex-dev/agent/react";
import { useChatStore } from "@/lib/store/chat-store";
import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/ui/chat-container";
import { Message, MessageContent } from "@/components/ui/message";
import { Loader } from "@/components/ui/loader";
import { Tool } from "@/components/ui/tool";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";

// Compact Message component
function ChatMessage({ message, isFirst }: { message: UIMessage; isFirst?: boolean }) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });

  const toolParts = useMemo(() => {
    return message.parts?.filter(part => part.type.startsWith('tool-')) || [];
  }, [message.parts]);


  const isUser = message.role === "user";

  if (isUser) {
    return (
      <motion.div
        initial={isFirst ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex justify-end mb-3"
      >
        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl px-3 py-2 text-sm">
          {message.text}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mb-4">
      {/* Tool calls - compact */}
      {toolParts.length > 0 && (
        <div className="mb-2 space-y-1">
          {toolParts.map((part, index) => (
            <Tool
              key={index}
              className="w-full text-xs"
              toolPart={{
                type: part.type.replace('tool-', ''),
                state: "output-available",
                input: part.input || {},
                output: part.output || {},
                toolCallId: part.toolCallId,
                errorText: part.errorText,
              }}
            />
          ))}
        </div>
      )}
      
      {/* AI message - no bubble, just clean text */}
      {(visibleText || message.text) && (
        <MessageContent 
          className="text-sm leading-relaxed text-foreground max-w-none prose prose-sm bg-transparent p-0 rounded-none border-0 shadow-none"
          markdown
        >
          {visibleText || message.text}
        </MessageContent>
      )}
    </div>
  );
}

export function ChatInterface() {
  const router = useRouter();
  const { currentThreadId, inputValue, setInputValue, setCurrentThread } = useChatStore();

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
          router.push(`/chat/${result.threadId}`);
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
    <div className="flex flex-col h-screen bg-background relative">
      {/* Messages area with smooth layout transition */}
      <div className="flex-1 flex flex-col relative">
        <AnimatePresence mode="wait">
          {!isHomeMode && (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-hidden"
            >
              <ChatContainerRoot className="h-full">
                <ChatContainerContent className="px-12 py-4 pt-20 pr-32 space-y-0 max-w-4xl mx-auto">
                  {uiMessages.map((message, index) => (
                    <ChatMessage 
                      key={message.id || index} 
                      message={message} 
                      isFirst={index === 0}
                    />
                  ))}
                  {isStreaming && uiMessages[uiMessages.length - 1]?.role === "user" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4"
                    >
                      <Loader variant="typing" size="sm" text="Thinking" />
                    </motion.div>
                  )}
                </ChatContainerContent>
              </ChatContainerRoot>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center content for home mode */}
        {isHomeMode && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center px-6 pr-24"
          >
            <div className="w-full max-w-2xl text-center">
              <motion.h1 
                className="text-2xl font-medium text-foreground mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                How can I help you today?
              </motion.h1>
            </div>
          </motion.div>
        )}
      </div>

      {/* Unified prompt input - always at bottom */}
      <motion.div
        layout
        className="relative"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
        <motion.div 
          layout
          className={`relative px-6 py-4 pr-24 ${isHomeMode ? 'max-w-2xl mx-auto' : 'max-w-4xl mx-auto'}`}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <PromptInput
            value={inputValue}
            onValueChange={setInputValue}
            isLoading={isStreaming}
            onSubmit={handleSend}
            className="w-full"
          >
            <PromptInputTextarea 
              placeholder={isHomeMode ? "Ask me anything..." : "Continue the conversation..."}
              className="min-h-[2.5rem] resize-none text-sm border-0 shadow-lg"
            />
            <PromptInputActions className="flex items-center justify-end gap-2 pt-2">
              <PromptInputAction tooltip={isStreaming ? "Sending..." : "Send message"}>
                <Button
                  variant="default"
                  size="icon"
                  className="h-7 w-7 rounded-full bg-brand-primary hover:bg-brand-primary/90 transition-all duration-200 shadow-sm"
                  onClick={handleSend}
                  disabled={isStreaming || !inputValue?.trim()}
                >
                  {isStreaming ? (
                    <Square className="size-3 fill-current animate-pulse" />
                  ) : (
                    <ArrowUp className="size-3" />
                  )}
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </motion.div>
      </motion.div>
    </div>
  );
}