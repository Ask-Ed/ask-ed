'use client';

import { PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLeftSidebar } from '@/lib/store/document-store';

export function ThreadsToggle() {
  const { toggle, isOpen } = useLeftSidebar();
  
  if (isOpen) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      className="fixed top-4 left-4 z-40 h-9 w-9 bg-sidebar border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-foreground"
      aria-label="Toggle conversations sidebar"
    >
      <PanelLeft className="h-4 w-4" />
    </Button>
  );
}