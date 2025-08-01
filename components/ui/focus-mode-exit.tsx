"use client";

import { Button } from "@/components/ui/button";
import { EyeOff } from "lucide-react";
import { motion } from "framer-motion";

interface FocusModeExitProps {
  onClick: () => void;
}

export function FocusModeExit({ onClick }: FocusModeExitProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <Button
        variant="outline"
        onClick={onClick}
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 h-8 px-3 bg-background/80 backdrop-blur-xl border border-border/40 hover:bg-accent/30 hover:border-border transition-all duration-200 text-sm font-medium shadow-sm"
      >
        <EyeOff className="h-3.5 w-3.5" />
        <span className="leading-none">Exit Focus</span>
      </Button>
    </motion.div>
  );
}