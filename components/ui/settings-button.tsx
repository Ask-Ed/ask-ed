'use client';

import * as React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const SettingsButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button>
>(({ ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      className="h-9 w-9 bg-sidebar border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-foreground"
      aria-label="Settings"
      {...props}
    >
      <Settings className="h-4 w-4" />
    </Button>
  );
});

SettingsButton.displayName = 'SettingsButton';