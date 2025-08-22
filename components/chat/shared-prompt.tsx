"use client";

import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface SharedPromptProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isTransitioning?: boolean;
  placeholder?: string;
  className?: string;
}

export function SharedPrompt({ 
  value,
  onValueChange,
  onSubmit, 
  isLoading,
  isTransitioning = false,
  placeholder = "Start a new conversation...",
  className = "w-full"
}: SharedPromptProps) {

  return (
    <PromptInput
      value={value}
      onValueChange={onValueChange}
      isLoading={isLoading || isTransitioning}
      onSubmit={onSubmit}
      className={cn("w-full", className)}
    >
      <PromptInputTextarea 
        placeholder={placeholder}
        className="min-h-[3rem] resize-none"
      />

      <PromptInputActions className="flex items-center justify-end gap-2 pt-3">
        <PromptInputAction
          tooltip={
            isTransitioning 
              ? "Creating conversation..." 
              : isLoading 
              ? "Sending..." 
              : "Send message"
          }
        >
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8 rounded-full bg-brand-primary hover:bg-brand-primary/90 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
            onClick={onSubmit}
            disabled={isLoading || isTransitioning || !value?.trim()}
          >
            {isLoading || isTransitioning ? (
              <Square className="size-4 fill-current animate-pulse" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </PromptInputAction>
      </PromptInputActions>
    </PromptInput>
  );
}