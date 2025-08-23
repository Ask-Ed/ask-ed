"use client";

import { useState, type ReactNode } from "react";
import { Authenticated } from "convex/react";
import { usePathname } from "next/navigation";
import { ThreadsToggle } from "./threads-sidebar/threads-toggle";
import { ThreadsSidebar } from "./threads-sidebar/threads-sidebar";
import { SettingsButton } from "@/components/ui/settings-button";
import { SyncButton } from "@/components/ui/sync-button";
import { ModeToggle } from "@/components/mode-toggle";
import { SettingsDialog } from "@/components/settings-dialog";
import { CommandMenu } from "@/components/ui/command-menu";
import { CommandButton } from "@/components/ui/command-button";
import { FocusModeExit } from "@/components/ui/focus-mode-exit";
import { useFocusMode } from "@/components/providers/focus-mode-provider";
import { AnimatePresence } from "framer-motion";
import { useChatStore } from "@/lib/store/chat-store";

interface ChatLayoutProps {
  children: ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const { isFocusMode, toggleFocusMode, exitFocusMode } = useFocusMode();
  const { isLeftSidebarOpen, currentThreadId } = useChatStore();
  const pathname = usePathname();

  const isAuthPage = pathname?.startsWith('/auth') || pathname?.startsWith('/register');
  const isInChatMode = !!currentThreadId;

  return (
    <div className="relative min-h-screen">
      {/* Sidebar */}
      {!isFocusMode && (
        <Authenticated>
          <ThreadsSidebar />
        </Authenticated>
      )}

      {/* Main content */}
      <div
        className={`min-h-screen transition-all duration-300 ease-out ${
          !isFocusMode && isLeftSidebarOpen ? "ml-80" : "ml-0"
        }`}
      >
        {children}

        {/* UI Controls */}
        {!isFocusMode && !isAuthPage && (
          <>
            <Authenticated>
              <ThreadsToggle />
              <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
                <SyncButton />
                <SettingsDialog>
                  <SettingsButton />
                </SettingsDialog>
              </div>
            </Authenticated>

            <CommandButton onClick={() => setCommandMenuOpen(true)} />
            
            <div className="fixed bottom-6 right-6 z-40">
              <ModeToggle />
            </div>
          </>
        )}

        {isFocusMode && !isAuthPage && (
          <AnimatePresence>
            <FocusModeExit onClick={exitFocusMode} />
          </AnimatePresence>
        )}

        {/* Command Menu */}
        <CommandMenu
          open={commandMenuOpen}
          setOpen={setCommandMenuOpen}
          onToggleFocusMode={toggleFocusMode}
          isFocusMode={isFocusMode}
        />
      </div>
    </div>
  );
}