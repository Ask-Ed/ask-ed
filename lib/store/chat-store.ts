import { create } from 'zustand';

interface ChatState {
  // Core state
  currentThreadId: string | null;
  inputValue: string;
  isLeftSidebarOpen: boolean;
  
  // Actions
  setCurrentThread: (threadId: string | null) => void;
  setInputValue: (value: string) => void;
  clearInput: () => void;
  toggleLeftSidebar: () => void;
  closeLeftSidebar: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // Initial state
  currentThreadId: null,
  inputValue: "",
  isLeftSidebarOpen: false,
  
  // Actions
  setCurrentThread: (threadId) => set({ currentThreadId: threadId }),
  setInputValue: (value) => set({ inputValue: value }),
  clearInput: () => set({ inputValue: "" }),
  toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),
  closeLeftSidebar: () => set({ isLeftSidebarOpen: false }),
}));