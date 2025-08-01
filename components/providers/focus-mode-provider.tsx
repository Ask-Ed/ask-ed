"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface FocusModeContextType {
  isFocusMode: boolean;
  toggleFocusMode: () => void;
  exitFocusMode: () => void;
}

const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined);

export function useFocusMode() {
  const context = useContext(FocusModeContext);
  if (!context) {
    throw new Error("useFocusMode must be used within a FocusModeProvider");
  }
  return context;
}

interface FocusModeProviderProps {
  children: ReactNode;
}

export function FocusModeProvider({ children }: FocusModeProviderProps) {
  const [isFocusMode, setIsFocusMode] = useState(false);

  const toggleFocusMode = () => {
    setIsFocusMode(!isFocusMode);
  };

  const exitFocusMode = () => {
    setIsFocusMode(false);
  };

  return (
    <FocusModeContext.Provider value={{ isFocusMode, toggleFocusMode, exitFocusMode }}>
      {children}
    </FocusModeContext.Provider>
  );
}