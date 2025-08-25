'use client';

import { PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store/chat-store';
import { memo } from 'react';

export const ThreadsToggle = memo(function ThreadsToggle() {
  // Only subscribe to the specific store values we need
  const toggleLeftSidebar = useChatStore((state) => state.toggleLeftSidebar);
  const isLeftSidebarOpen = useChatStore((state) => state.isLeftSidebarOpen);
  
  if (isLeftSidebarOpen) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleLeftSidebar}
      className="fixed top-4 left-4 z-40 h-9 w-9 bg-sidebar border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-foreground"
      aria-label="Toggle conversations sidebar"
    >
      <PanelLeft className="h-4 w-4" />
    </Button>
  );
});