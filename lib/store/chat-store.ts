import { create } from 'zustand';

interface ChatState {
  // Chat state
  currentThreadId: string | null;
  inputValue: string;
  isTransitioning: boolean;
  
  // Actions
  setCurrentThread: (threadId: string | null) => void;
  setInputValue: (value: string) => void;
  setTransitioning: (transitioning: boolean) => void;
  clearInput: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // Initial state
  currentThreadId: null,
  inputValue: '',
  isTransitioning: false,
  
  // Actions
  setCurrentThread: (threadId: string | null) => {
    set({ currentThreadId: threadId });
  },
  
  setInputValue: (value: string) => {
    set({ inputValue: value });
  },
  
  setTransitioning: (transitioning: boolean) => {
    set({ isTransitioning: transitioning });
  },
  
  clearInput: () => {
    set({ inputValue: '' });
  },
}));