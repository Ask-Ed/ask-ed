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
import { Search } from "lucide-react";
import { Source, SourceTrigger, SourceContent } from "@/components/ui/source";

// Simple tool rendering for searchInCourse
function ToolAction({ part }: { part: any }) {
  if (!part.input) return null;
  
  const { courseCode, query } = part.input;
  
  if (!courseCode || !query) return null;
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-muted/50 border border-border/50 rounded-lg text-xs text-muted-foreground">
      <Search className="size-3" />
      <span>
        Searched in Course <span className="font-medium text-foreground">{courseCode}</span> for "{query}"
      </span>
    </div>
  );
}

// Extract search results and render as sources
function SearchSources({ toolParts }: { toolParts: any[] }) {
  const sources = useMemo(() => {
    const results: any[] = [];
    
    toolParts.forEach((part) => {
      if ('output' in part && part.output?.success && part.output?.results) {
        part.output.results.forEach((result: any, index: number) => {
          if (result.content && result.metadata) {
            // Construct ED thread URL from metadata
            let edUrl = '#';
            if (result.metadata.thread_id && result.metadata.course_id) {
              // Use the proper ED URL structure: https://edstem.org/eu/courses/[course_id]/discussion/[thread_id]
              edUrl = `https://edstem.org/eu/courses/${result.metadata.course_id}/discussion/${result.metadata.thread_id}`;
            } else if (result.metadata.url) {
              edUrl = result.metadata.url;
            }
            
            results.push({
              id: `${part.toolCallId || 'unknown'}-${index}`,
              content: result.content,
              metadata: result.metadata,
              score: result.score,
              courseCode: part.output.courseCode,
              courseName: part.output.courseName,
              edUrl,
            });
          }
        });
      }
    });
    
    return results;
  }, [toolParts]);

  if (sources.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="text-xs text-muted-foreground mb-2 font-medium">Sources</div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source, index) => {
          // Create a concise title like "CS200 - Thread Title"
          const title = `${source.courseCode} - ${source.metadata?.title || `Thread ${source.metadata?.thread_id || index + 1}`}`;
          
          const description = source.content.length > 200 
            ? source.content.substring(0, 200) + '...' 
            : source.content;

          return (
            <Source 
              key={source.id} 
              href={source.edUrl}
            >
              <SourceTrigger 
                label={index + 1}
                showFavicon
                className="text-xs"
              />
              <SourceContent
                title={title}
                description={description}
              />
            </Source>
          );
        })}
      </div>
    </div>
  );
}

// Compact Message component
function ChatMessage({
  message,
  isFirst,
}: {
  message: UIMessage;
  isFirst?: boolean;
}) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });

  const toolParts = useMemo(() => {
    return message.parts?.filter((part) => part.type.startsWith("tool-") && 'input' in part) || [];
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
      {/* Tool calls - clean and minimal */}
      {toolParts.length > 0 && (
        <div className="mb-3">
          {toolParts.map((part, index) => (
            <ToolAction
              key={index}
              part={{
                type: part.type.replace("tool-", ""),
                input: 'input' in part ? part.input : {},
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

      {/* Sources from search results */}
      <SearchSources toolParts={toolParts} />
    </div>
  );
}

export function ChatInterface() {
  const router = useRouter();
  const { currentThreadId, inputValue, setInputValue, setCurrentThread } =
    useChatStore();

  // Mutations
  const createThread = useMutation(api.chat.createChatThread);
  const sendMessage = useMutation(api.chat.sendMessage).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listThreadMessages),
  );

  // Messages query
  const messages = useThreadMessages(
    api.chat.listThreadMessages,
    currentThreadId ? { threadId: currentThreadId } : "skip",
    { initialNumItems: 50, stream: true },
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
        // Create new thread - delay the thread setting to allow animation
        const result = await createThread({ firstMessage: message, edToken });
        if (result?.threadId) {
          // Small delay to let the input animate to bottom position first
          setTimeout(() => {
            setCurrentThread(result.threadId);
            router.push(`/chat/${result.threadId}`);
          }, 300);
        }
      } else {
        // Send to existing thread
        await sendMessage({
          threadId: currentThreadId,
          prompt: message,
          edToken,
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setInputValue(message); // Restore on error
    }
  };

  const isHomeMode = !currentThreadId;

  return (
    <div className="flex flex-col h-screen bg-background relative">
      {/* Messages area - only shows when not in home mode */}
      <AnimatePresence>
        {!isHomeMode && (
          <motion.div
            key="messages"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-1 overflow-hidden"
            transition={{ duration: 0.3, ease: "easeInOut" }}
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
                {isStreaming &&
                  uiMessages[uiMessages.length - 1]?.role === "user" && (
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

      {/* Single prompt input that animates from center to bottom */}
      <motion.div
        className={`relative flex px-6 ${!isHomeMode ? "py-4" : ""}`}
        animate={{
          flexGrow: isHomeMode ? 1 : 0,
          alignItems: isHomeMode ? "center" : "flex-end",
          justifyContent: "center"
        }}
        transition={{
          duration: 0.6,
          ease: [0.23, 1, 0.32, 1],
          layout: { duration: 0.6, ease: [0.23, 1, 0.32, 1] }
        }}
        layout
      >
        <motion.div
          className="absolute inset-0 bg-background/80 backdrop-blur-md"
          animate={{ opacity: !isHomeMode ? 1 : 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
        <motion.div 
          className="relative w-full max-w-2xl"
          layout
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <PromptInput
            value={inputValue}
            onValueChange={setInputValue}
            isLoading={isStreaming}
            onSubmit={handleSend}
            className="w-full"
          >
            <PromptInputTextarea
              placeholder={
                isHomeMode
                  ? "Ask me anything..."
                  : "Continue the conversation..."
              }
              className="min-h-[2.5rem] resize-none text-sm border-0 shadow-lg"
            />
            <PromptInputActions className="flex items-center justify-end gap-2 pt-2">
              <PromptInputAction
                tooltip={isStreaming ? "Sending..." : "Send message"}
              >
                <Button
                  variant="default"
                  size="icon"
                  className="h-7 w-7 rounded-full bg-brand-primary hover:bg-brand-primary/90 transition-colors duration-150 ease-out shadow-sm"
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
