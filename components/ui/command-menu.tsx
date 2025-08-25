"use client";

import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Sun, Moon, SunMoon } from "lucide-react";
import { useTheme } from "next-themes";

interface CommandMenuProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onToggleFocusMode: () => void;
  isFocusMode: boolean;
}

export const CommandMenu = memo(function CommandMenu({ open, setOpen, onToggleFocusMode, isFocusMode }: CommandMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === 'Escape') {
        if (isFocusMode) {
          onToggleFocusMode();
        } else {
          setOpen(false);
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen, isFocusMode, onToggleFocusMode]);

  // Focus input when menu opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Prevent background scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  const handleFocusModeToggle = useCallback(() => {
    onToggleFocusMode();
    setOpen(false);
  }, [onToggleFocusMode, setOpen]);
  
  const handleThemeToggle = useCallback(() => {
    const themes = ['light', 'dark'];
    const currentTheme = theme === 'system' ? 'light' : theme; // Default system to light
    const currentIndex = themes.indexOf(currentTheme || 'light');
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
    setOpen(false);
  }, [theme, setTheme, setOpen]);
  
  const themeInfo = useMemo(() => {
    switch (theme) {
      case 'dark':
        return { icon: SunMoon, label: 'Switch to Light', description: 'Change to light theme' };
      case 'light':
      default:
        return { icon: SunMoon, label: 'Switch to Dark', description: 'Change to dark theme' };
    }
  }, [theme]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-background/60 backdrop-blur-md z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setOpen(false)}
          />
          
          {/* Command Dialog */}
          <motion.div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-lg mx-4"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <Command className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden">
              <Command.Input
                ref={inputRef}
                placeholder="Search commands..."
                className="flex h-14 w-full bg-transparent px-5 py-4 text-sm outline-none placeholder:text-muted-foreground border-0 border-b border-border"
              />
              
              <Command.List className="max-h-80 overflow-y-auto px-2 pb-2">
                <Command.Empty className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  No commands found.
                </Command.Empty>

                <div className="px-2 py-1.5 space-y-1">
                  <Command.Item 
                    onSelect={handleFocusModeToggle}
                    className="relative flex cursor-pointer select-none items-center rounded-xl px-3 py-3 text-sm outline-none hover:bg-secondary data-[selected=true]:bg-secondary transition-colors duration-150 gap-3 group"
                  >
                    {isFocusMode ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {isFocusMode ? "Show all interface elements (or press Esc)" : "Hide distractions while reading"}
                      </div>
                    </div>
                  </Command.Item>
                  
                  <Command.Item 
                    onSelect={handleThemeToggle}
                    className="relative flex cursor-pointer select-none items-center rounded-xl px-3 py-3 text-sm outline-none hover:bg-secondary data-[selected=true]:bg-secondary transition-colors duration-150 gap-3 group"
                  >
                    <themeInfo.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {themeInfo.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {themeInfo.description}
                      </div>
                    </div>
                  </Command.Item>
                </div>
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});