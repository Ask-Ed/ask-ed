"use client";

import { ArrowUp, Square, Plus, Hash, Quote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useAction } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@/convex/_generated/api";
import {
  useThreadMessages,
  toUIMessages,
  useSmoothText,
  optimisticallySendMessage,
  type UIMessage,
} from "@convex-dev/agent/react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStore } from "@/lib/store/chat-store";

interface ChatInterfaceProps {
  threadId?: string;
}

interface ChatTag {
  id: string;
  type: 'section' | 'quote';
  label: string;
  content: string;
}

function TagBadge({ tag, onRemove }: { tag: ChatTag; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-primary rounded-md border border-brand-primary/30 dark:border-brand-primary/40">
      {tag.type === 'section' ? (
        <Hash className="h-3 w-3" />
      ) : (
        <Quote className="h-3 w-3" />
      )}
      <span className="font-medium">{tag.label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="hover:bg-brand-primary/20 dark:hover:bg-brand-primary/30 rounded-sm p-0.5 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function MessageContent({ message }: { message: UIMessage }) {
  const [visibleText] = useSmoothText(message.content, {
    startStreaming: message.status === "streaming",
  });

  const { tags, cleanContent } = useMemo(() => {
    const lines = visibleText.split('\n');
    const extractedTags: Array<{type: 'section' | 'quote', content: string}> = [];
    let contentStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('[Referenced Section:') && line.endsWith(']')) {
        const sectionName = line.replace('[Referenced Section: ', '').replace(']', '');
        extractedTags.push({ type: 'section', content: sectionName });
        contentStartIndex = i + 1;
      } else if (line.startsWith('[Referenced Quote:') && line.endsWith(']')) {
        const quote = line.replace('[Referenced Quote: "', '').replace('"]', '');
        extractedTags.push({ type: 'quote', content: quote });
        contentStartIndex = i + 1;
      } else if (line.trim() === '') {
        if (extractedTags.length > 0 && contentStartIndex === i) {
          contentStartIndex = i + 1;
        }
      } else {
        break;
      }
    }

    const remainingLines = lines.slice(contentStartIndex);
    return {
      tags: extractedTags,
      cleanContent: remainingLines.join('\n').trim()
    };
  }, [visibleText]);

  return (
    <div className="max-w-full text-sm text-foreground">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag) => (
            <div
              key={`${tag.type}-${tag.content.substring(0, 20)}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-primary rounded-md border border-brand-primary/30 dark:border-brand-primary/40"
            >
              {tag.type === 'section' ? (
                <Hash className="h-3 w-3" />
              ) : (
                <Quote className="h-3 w-3" />
              )}
              <span className="font-medium">
                {tag.type === 'quote' && tag.content.length > 30 
                  ? `${tag.content.substring(0, 27)}...`
                  : tag.content
                }
              </span>
            </div>
          ))}
        </div>
      )}
      
      <div
        className="leading-relaxed max-w-none"
        style={{ userSelect: "text", WebkitUserSelect: "text" }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => (
              <p className="text-sm leading-6 mb-2 last:mb-0 text-foreground">{children}</p>
            ),
            h1: ({ children }) => (
              <h1 className="text-base font-semibold mt-4 mb-2 first:mt-0 text-foreground">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-sm font-semibold mt-3 mb-2 first:mt-0 text-foreground">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-medium mt-2 mb-1 first:mt-0 text-foreground">{children}</h3>
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
                  <code className="text-xs font-mono text-foreground block">{children}</code>
                </pre>
              );
            },
            ul: ({ children }) => (
              <ul className="list-disc pl-6 space-y-1 my-2 text-foreground">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-6 space-y-1 my-2 text-foreground">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-sm text-foreground">{children}</li>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-brand-primary dark:text-brand-primary hover:underline font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic my-3 text-muted-foreground bg-muted/30 py-2 rounded-r">
                {children}
              </blockquote>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-foreground">{children}</em>
            ),
            hr: () => (
              <hr className="my-4 border-t border-border" />
            ),
          }}
        >
          {cleanContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export function ChatInterface({ threadId }: ChatInterfaceProps) {
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(threadId || null);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [tags, setTags] = useState<ChatTag[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { 
    inputValue, 
    setInputValue, 
    isTransitioning, 
    transitionMessage,
    transitionDirection,
    completeTransition,
    setCurrentThread
  } = useChatStore();

  const createThread = useAction(api.chat.createChatThread);
  const sendMessage = useMutation(api.chat.sendMessage).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listThreadMessages),
  );

  const messages = useThreadMessages(
    api.chat.listThreadMessages,
    currentThreadId ? { threadId: currentThreadId } : "skip",
    { initialNumItems: 50, stream: true },
  );

  useEffect(() => {
    if (threadId) {
      setCurrentThreadId(threadId);
      setCurrentThread(threadId);
      
      // Clear input value after successful transition
      if (transitionDirection === 'home-to-chat' && transitionMessage) {
        setTimeout(() => {
          setInputValue('');
        }, 1500);
      }
    }
  }, [threadId, setCurrentThread, transitionDirection, transitionMessage, setInputValue, completeTransition]);

  const uiMessages = messages.results ? toUIMessages(messages.results) : [];

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleTagRemove = useCallback((tagId: string) => {
    setTags(prev => prev.filter(tag => tag.id !== tagId));
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (uiMessages.length > 0) {
      scrollToBottom();
    }
  }, [scrollToBottom, uiMessages.length]);

  const buildPromptWithTags = useCallback((prompt: string, chatTags: ChatTag[]) => {
    if (chatTags.length === 0) return prompt;
    
    const tagContexts: string[] = [];
    
    for (const tag of chatTags) {
      if (tag.type === 'section') {
        tagContexts.push(`[Referenced Section: ${tag.content}]`);
      } else if (tag.type === 'quote') {
        tagContexts.push(`[Referenced Quote: "${tag.content}"]`);
      }
    }
    
    if (tagContexts.length > 0) {
      return `${tagContexts.join('\n')}\n\n${prompt}`;
    }
    
    return prompt;
  }, []);

  const handleSubmit = async () => {
    if (!inputValue.trim()) return;

    let threadToUse = currentThreadId;

    if (!threadToUse) {
      try {
        setIsCreatingThread(true);
        const { threadId: newThreadId } = await createThread({});
        threadToUse = newThreadId;
        setCurrentThreadId(newThreadId);
        
        // Update the URL to reflect the new thread
        if (typeof window !== 'undefined') {
          window.history.pushState({}, '', `/chat/${newThreadId}`);
        }
      } catch (error) {
        console.error("Failed to create thread:", error);
        return;
      } finally {
        setIsCreatingThread(false);
      }
    }

    const prompt = inputValue.trim();
    const currentTags = [...tags];
    
    // Get ED session token from localStorage if available
    const edToken = typeof window !== 'undefined' 
      ? localStorage.getItem("ed-session-key") || undefined
      : undefined;
    
    setInputValue("");
    setTags([]);

    try {
      await sendMessage({
        threadId: threadToUse,
        prompt: buildPromptWithTags(prompt, currentTags),
        edToken,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const isStreaming = uiMessages.some((msg) => msg.status === "streaming");

  // Debug logging
  console.log("ChatInterface render:", { 
    threadId, 
    currentThreadId, 
    messagesCount: uiMessages.length,
    isTransitioning,
    transitionDirection 
  });

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-8 max-w-4xl mx-auto w-full">
        {/* Show transitioning message as a ghost message */}
        {isTransitioning && transitionMessage && transitionDirection === 'home-to-chat' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.6, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex justify-end mb-6"
          >
            <div
              className="max-w-[70%] rounded-2xl px-4 py-3 text-sm text-white/70 border border-brand-primary/30 bg-brand-primary/30"
            >
              <p className="leading-relaxed">{transitionMessage}</p>
            </div>
          </motion.div>
        )}
        
        <AnimatePresence initial={false}>
          {uiMessages.map((message) => (
            <motion.div
              key={message.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex mb-6",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {message.role === "user" ? (
                <div
                  className="max-w-[70%] rounded-2xl px-4 py-3 text-sm text-white bg-brand-primary"
                >
                  <p className="leading-relaxed">{message.content}</p>
                </div>
              ) : (
                <div className="max-w-[85%]">
                  <MessageContent message={message} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      <motion.div 
        className="border-t border-border/30 bg-background p-4"
        initial={
          transitionDirection === 'home-to-chat' 
            ? { y: "calc(50vh - 4rem)", opacity: 0.8 }
            : { y: 0, opacity: 1 }
        }
        animate={{ y: 0, opacity: 1 }}
        transition={{ 
          type: "spring", 
          damping: 30, 
          stiffness: 300,
          delay: transitionDirection === 'home-to-chat' ? 0.2 : 0
        }}
      >
        <div className="max-w-4xl mx-auto w-full">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  onRemove={() => handleTagRemove(tag.id)}
                />
              ))}
            </div>
          )}

          <PromptInput
            value={inputValue}
            onValueChange={handleInputChange}
            isLoading={isStreaming}
            onSubmit={handleSubmit}
            className="w-full"
          >
            <PromptInputTextarea
              ref={inputRef}
              placeholder={
                isCreatingThread
                  ? "Creating conversation..."
                  : isTransitioning && transitionMessage
                  ? `"${transitionMessage}"`
                  : "Continue your conversation..."
              }
              disabled={isCreatingThread}
            />

            <PromptInputActions className="flex items-center justify-end gap-2 pt-2">
              <PromptInputAction
                tooltip={isStreaming ? "AI is responding..." : "Send message"}
              >
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:opacity-90 transition-opacity bg-brand-primary hover:bg-brand-primary/90"
                  onClick={handleSubmit}
                  disabled={isStreaming || isCreatingThread}
                  type="button"
                >
                  {isStreaming ? (
                    <Square className="size-4 fill-current" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
      </motion.div>
    </div>
  );
}