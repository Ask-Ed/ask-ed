"use client";

import { use, Suspense, useEffect, useCallback, useRef } from "react";
import { Authenticated, Unauthenticated, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import {
  useThreadMessages,
  toUIMessages,
  useSmoothText,
  optimisticallySendMessage,
  type UIMessage,
} from "@convex-dev/agent/react";
import { useChatStore } from "@/lib/store/chat-store";
import { useLeftSidebar } from "@/lib/store/document-store";
import { SharedPrompt } from "@/components/chat/shared-prompt";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface PageProps {
  params: Promise<{ id: string }>;
}

function MessageContent({ message }: { message: UIMessage }) {
  const [visibleText] = useSmoothText(message.content, {
    startStreaming: message.status === "streaming",
  });

  return (
    <div className="max-w-none leading-relaxed text-sm text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="text-sm leading-6 mb-2 last:mb-0 text-foreground">
              {children}
            </p>
          ),
          h1: ({ children }) => (
            <h1 className="text-base font-semibold mt-4 mb-2 first:mt-0 text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-semibold mt-3 mb-2 first:mt-0 text-foreground">
              {children}
            </h2>
          ),
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground border">
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-muted p-3 rounded-md overflow-x-auto my-3 border">
                <code className="text-xs font-mono text-foreground block">
                  {children}
                </code>
              </pre>
            );
          },
          ul: ({ children }) => (
            <ul className="list-disc pl-6 space-y-1 my-2 text-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 space-y-1 my-2 text-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-foreground">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
        }}
      >
        {visibleText}
      </ReactMarkdown>
    </div>
  );
}

function ChatPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const threadId = resolvedParams.id;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isOpen: leftSidebarOpen } = useLeftSidebar();

  const { inputValue, setInputValue, setTransitioning, clearInput } =
    useChatStore();

  const sendMessage = useMutation(api.chat.sendMessage).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listThreadMessages)
  );

  const messages = useThreadMessages(
    api.chat.listThreadMessages,
    { threadId },
    { initialNumItems: 50, stream: true }
  );

  const uiMessages = messages.results ? toUIMessages(messages.results) : [];
  const isStreaming = uiMessages.some((msg) => msg.status === "streaming");

  // Reset transition state when page loads
  useEffect(() => {
    setTransitioning(false);
  }, [setTransitioning]);

  // Clear input after first message loads (smooth transition)
  useEffect(() => {
    if (uiMessages.length > 0) {
      setTimeout(() => clearInput(), 1000);
    }
  }, [uiMessages.length, clearInput]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (uiMessages.length > 0) {
      scrollToBottom();
    }
  }, [scrollToBottom, uiMessages.length]);

  const handleSubmit = async () => {
    if (!inputValue.trim() || isStreaming) return;

    try {
      await sendMessage({
        threadId,
        prompt: inputValue.trim(),
      });
      clearInput();
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 pb-32">
        <div className="max-w-2xl mx-auto w-full">
          <AnimatePresence initial={false}>
            {uiMessages.map((message) => (
              <motion.div
                key={message.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className={`flex mb-4 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "user" ? (
                  <div className="max-w-[70%] rounded-2xl px-3 py-2 text-sm text-white bg-brand-primary">
                    <p className="leading-snug">{message.content}</p>
                  </div>
                ) : (
                  <div className="max-w-[85%] bg-muted/50 rounded-2xl px-3 py-2">
                    <MessageContent message={message} />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div
        className={`fixed bottom-4 transition-all duration-300 ${
          leftSidebarOpen ? "left-80" : "left-0"
        } right-4`}
      >
        <div className="max-w-2xl mx-auto w-full">
          <SharedPrompt
            onSubmit={handleSubmit}
            isLoading={isStreaming}
            placeholder="Continue your conversation..."
            className="w-full"
          />
        </div>
      </div>
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

export default function Page({ params }: PageProps) {
  return (
    <>
      <Unauthenticated>
        <RedirectToLogin />
      </Unauthenticated>
      <Authenticated>
        <Suspense
          fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground" />
            </div>
          }
        >
          <ChatPage params={params} />
        </Suspense>
      </Authenticated>
    </>
  );
}
