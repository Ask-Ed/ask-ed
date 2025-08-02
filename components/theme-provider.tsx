"use client";

import * as React from "react";

export function ThemeInitializer() {
  React.useEffect(() => {
    // Initialize theme from localStorage on app start
    const savedTheme = localStorage.getItem('color-theme');
    if (savedTheme && savedTheme !== 'default') {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  return null;
}