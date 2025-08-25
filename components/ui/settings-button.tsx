'use client';

import * as React from 'react';
import { Settings, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/lib/store/user-store';

export const SettingsButton = React.memo(React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button>
>(({ ...props }, ref) => {
  // Only subscribe to the computed attention value to minimize re-renders
  const showAttention = useUserStore((state) => state.shouldShowTokenAttention());

  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      className="h-9 w-9 bg-sidebar border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-foreground relative"
      aria-label="Settings"
      {...props}
    >
      <Settings className="h-4 w-4" />
      {showAttention && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center">
          <AlertCircle className="h-2 w-2 text-yellow-900" />
        </div>
      )}
    </Button>
  );
}));

SettingsButton.displayName = 'SettingsButton';