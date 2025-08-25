"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { memo } from "react";

export const ModeToggle = memo(function ModeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="h-9 w-9 rounded-full bg-background hover:bg-accent transition-all duration-300 ease-out relative flex items-center justify-center"
        aria-label="Toggle theme"
        disabled
      >
        <div className="w-4 h-4 rounded-full bg-gray-500 opacity-50" />
        <span className="sr-only">Toggle theme</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="h-9 w-9 rounded-full bg-background hover:bg-accent transition-all duration-300 ease-out relative flex items-center justify-center"
      aria-label="Toggle theme"
    >
      {/* Dark ball that moves and changes appearance */}
      <div
        className={`w-4 h-4 rounded-full transition-all duration-500 ease-out ${
          theme === "dark"
            ? "bg-white shadow-sm"
            : "bg-gray-900 shadow-md"
        }`}
      />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
});