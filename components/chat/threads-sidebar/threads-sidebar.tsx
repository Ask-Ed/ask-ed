"use client";

import Link from "next/link";
import { Plus, PanelLeftClose, MoreHorizontal, Trash2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Suspense, useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { useChatStore } from "@/lib/store/chat-store";

function ThreadsList() {
  const { closeLeftSidebar } = useChatStore();
  const deleteThread = useMutation(api.chat.deleteThread);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  
  // Use useSuspenseQuery to get user's chat threads
  const { data: threads } = useSuspenseQuery(
    convexQuery(api.chat.getUserThreads, {})
  );

  const handleDeleteThread = useCallback(async (threadId: string, title: string) => {
    setDeletingId(threadId);
    try {
      await deleteThread({ threadId });
      toast.success(`"${title}" deleted successfully`);
      setOpenDropdowns(prev => {
        if (!prev[threadId]) return prev;
        const newState = { ...prev };
        delete newState[threadId];
        return newState;
      });
    } catch (error) {
      console.error("Failed to delete thread:", error);
      toast.error("Failed to delete thread. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }, [deleteThread]);

  const toggleDropdown = useCallback((threadId: string, isOpen: boolean) => {
    setOpenDropdowns(prev => {
      if (prev[threadId] === isOpen) return prev;
      return {
        ...prev,
        [threadId]: isOpen
      };
    });
  }, []);

  const handleRightClick = useCallback((e: React.MouseEvent, threadId: string) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown(threadId, true);
  }, [toggleDropdown]);

  // Handle paginated response from getUserThreads
  const threadsArray = threads?.page ? threads.page : [];

  if (threadsArray.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs mt-1">Start a new chat to begin</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {threadsArray.map((thread) => (
        <div key={thread._id} className="group relative">
          <Link
            href={`/chat/${thread._id}`}
            onClick={closeLeftSidebar}
            prefetch={true}
            className="block p-3 rounded-md hover:bg-accent transition-colors duration-200 border border-transparent hover:border-border pr-10"
            onContextMenu={(e) => handleRightClick(e, thread._id)}
          >
            <h3 className="font-medium text-foreground mb-1 text-sm leading-tight line-clamp-1">
              {thread.title || "New Conversation"}
            </h3>
            <div className="text-xs text-muted-foreground">
              {new Date(thread._creationTime).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short', 
                day: 'numeric'
              })}
            </div>
          </Link>
          
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu 
              open={openDropdowns[thread._id] || false}
              onOpenChange={(isOpen) => toggleDropdown(thread._id, isOpen)}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                      disabled={deletingId === thread._id}
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this conversation? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDeleteThread(thread._id, thread.title || "Conversation")}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ThreadsSidebar() {
  const { isLeftSidebarOpen, toggleLeftSidebar } = useChatStore();

  return (
    <div
      className={`fixed top-0 left-0 h-full w-80 bg-background border-r border-border z-50 transform transition-transform duration-300 ease-out flex flex-col ${
        isLeftSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Conversations</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="New conversation"
            >
              <Link href="/">
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLeftSidebar}
              className="h-7 w-7 hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle conversations sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Suspense
          fallback={
            <div className="space-y-1">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={`loading-skeleton-item-${i + 1}`} className="p-3 rounded-md border border-transparent">
                  <div className="h-4 bg-muted rounded mb-2 animate-pulse" />
                  <div className="h-3 bg-muted/60 rounded w-2/3 animate-pulse" />
                </div>
              ))}
            </div>
          }
        >
          <ThreadsList />
        </Suspense>
      </div>
    </div>
  );
}