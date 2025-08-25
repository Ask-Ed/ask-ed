"use client";

import { Button } from "@/components/ui/button";
import { Command } from "lucide-react";
import { useChatStore } from "@/lib/store/chat-store";
import { memo } from "react";

interface CommandButtonProps {
  onClick: () => void;
}

export const CommandButton = memo(function CommandButton({ onClick }: CommandButtonProps) {
  const isLeftSidebarOpen = useChatStore((state) => state.isLeftSidebarOpen);
  
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={`fixed top-4 z-40 flex items-center gap-2.5 h-9 px-3 bg-card/80 backdrop-blur-xl border border-border hover:bg-accent hover:border-border transition-all duration-300 text-sm font-medium shadow-sm ${
        isLeftSidebarOpen ? "left-[calc(320px+1rem)]" : "left-14"
      }`}
    >
      <Command className="h-3.5 w-3.5" />
      <span className="leading-none">Menu</span>
      <div className="flex items-center gap-0.5">
        <kbd className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-muted text-[9px] font-mono font-medium text-muted-foreground">
          ⌘
        </kbd>
        <kbd className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-muted text-[9px] font-mono font-medium text-muted-foreground">
          K
        </kbd>
      </div>
    </Button>
  );
});