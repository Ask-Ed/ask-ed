"use client";

import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { ArrowUp, Square } from "lucide-react";
import { useChatStore } from "@/lib/store/chat-store";

interface SharedPromptProps {
  onSubmit: () => void;
  isLoading: boolean;
  placeholder?: string;
  className?: string;
}

export function SharedPrompt({ 
  onSubmit, 
  isLoading,
  placeholder = "Start a new conversation...",
  className = "w-full"
}: SharedPromptProps) {
  const { inputValue, setInputValue, isTransitioning } = useChatStore();

  return (
    <PromptInput
      value={inputValue}
      onValueChange={setInputValue}
      isLoading={isLoading || isTransitioning}
      onSubmit={onSubmit}
      className={className}
    >
      <PromptInputTextarea placeholder={placeholder} />

      <PromptInputActions className="flex items-center justify-end gap-2 pt-2">
        <PromptInputAction
          tooltip={
            isTransitioning 
              ? "Creating conversation..." 
              : isLoading 
              ? "Creating conversation..." 
              : "Send message"
          }
        >
          <Button
            variant="default"
            size="icon"
            className="h-7 w-7 rounded-full hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#007AFF" }}
            onClick={onSubmit}
            disabled={isLoading || isTransitioning}
          >
            {isLoading || isTransitioning ? (
              <Square className="size-4 fill-current" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </PromptInputAction>
      </PromptInputActions>
    </PromptInput>
  );
}