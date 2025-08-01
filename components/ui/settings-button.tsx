'use client';

import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SettingsButton() {
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-9 w-9 bg-sidebar border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-foreground"
      aria-label="Settings"
    >
      <Settings className="h-4 w-4" />
    </Button>
  );
}