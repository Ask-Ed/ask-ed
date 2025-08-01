import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Id } from '@/convex/_generated/dataModel';

interface TimelineSection {
  id: string;
  title: string;
  progress: number;
}

interface DocumentStore {
  // Sidebar states
  leftSidebar: {
    isOpen: boolean;
  };
  rightSidebar: {
    isOpen: boolean;
  };
  
  // Document state
  currentDocument: {
    id: Id<"documents"> | null;
    sections: TimelineSection[];
    currentSection: string;
  };
  
  // Navigation state
  isMainPage: boolean;
  
  // Sidebar actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  closeLeftSidebar: () => void;
  closeRightSidebar: () => void;
  openLeftSidebar: () => void;
  openRightSidebar: () => void;
  closeBothSidebars: () => void;
  
  // Document actions
  setCurrentDocument: (id: Id<"documents"> | null, sections?: TimelineSection[]) => void;
  setCurrentSection: (section: string) => void;
  clearCurrentDocument: () => void;
  
  // Navigation actions
  setIsMainPage: (isMainPage: boolean) => void;
  
  // Reset actions
  resetSidebarStates: () => void;
  resetAll: () => void;
}

export const useDocumentStore = create<DocumentStore>()(
  subscribeWithSelector(
    (set, get) => ({
      // Initial states
      leftSidebar: {
        isOpen: false,
      },
      rightSidebar: {
        isOpen: false,
      },
      currentDocument: {
        id: null,
        sections: [],
        currentSection: "intro",
      },
      isMainPage: true,
      
      // Sidebar actions
      toggleLeftSidebar: () =>
        set((state) => ({
          leftSidebar: { isOpen: !state.leftSidebar.isOpen },
        })),
        
      toggleRightSidebar: () =>
        set((state) => ({
          rightSidebar: { isOpen: !state.rightSidebar.isOpen },
        })),
        
      closeLeftSidebar: () =>
        set(() => ({
          leftSidebar: { isOpen: false },
        })),
        
      closeRightSidebar: () =>
        set(() => ({
          rightSidebar: { isOpen: false },
        })),
        
      openLeftSidebar: () =>
        set(() => ({
          leftSidebar: { isOpen: true },
        })),
        
      openRightSidebar: () =>
        set(() => ({
          rightSidebar: { isOpen: true },
        })),
        
      closeBothSidebars: () =>
        set(() => ({
          leftSidebar: { isOpen: false },
          rightSidebar: { isOpen: false },
        })),
      
      // Document actions
      setCurrentDocument: (id, sections = []) =>
        set(() => ({
          currentDocument: {
            id,
            sections,
            currentSection: sections.length > 0 ? sections[0].id : "intro",
          },
        })),
        
      setCurrentSection: (section) =>
        set((state) => ({
          currentDocument: {
            ...state.currentDocument,
            currentSection: section,
          },
        })),
        
      clearCurrentDocument: () =>
        set(() => ({
          currentDocument: {
            id: null,
            sections: [],
            currentSection: "intro",
          },
        })),
      
      // Navigation actions
      setIsMainPage: (isMainPage) => {
        set((state) => ({
          isMainPage,
          // Automatically close right sidebar when navigating to main page
          rightSidebar: isMainPage 
            ? { isOpen: false }
            : state.rightSidebar
        }));
      },
      
      // Reset actions
      resetSidebarStates: () =>
        set(() => ({
          leftSidebar: { isOpen: false },
          rightSidebar: { isOpen: false },
        })),
        
      resetAll: () =>
        set(() => ({
          leftSidebar: { isOpen: false },
          rightSidebar: { isOpen: false },
          currentDocument: {
            id: null,
            sections: [],
            currentSection: "intro",
          },
          isMainPage: true,
        })),
    })
  )
);

// Utility hooks for easier access to specific parts of the store
export const useLeftSidebar = () => {
  const isOpen = useDocumentStore((state) => state.leftSidebar.isOpen);
  const toggle = useDocumentStore((state) => state.toggleLeftSidebar);
  const close = useDocumentStore((state) => state.closeLeftSidebar);
  const open = useDocumentStore((state) => state.openLeftSidebar);
  
  return { isOpen, toggle, close, open };
};

export const useRightSidebar = () => {
  const isOpen = useDocumentStore((state) => state.rightSidebar.isOpen);
  const toggle = useDocumentStore((state) => state.toggleRightSidebar);
  const close = useDocumentStore((state) => state.closeRightSidebar);
  const open = useDocumentStore((state) => state.openRightSidebar);
  
  return { isOpen, toggle, close, open };
};

export const useCurrentDocument = () => {
  const id = useDocumentStore((state) => state.currentDocument.id);
  const sections = useDocumentStore((state) => state.currentDocument.sections);
  const currentSection = useDocumentStore((state) => state.currentDocument.currentSection);
  const setDocument = useDocumentStore((state) => state.setCurrentDocument);
  const setSection = useDocumentStore((state) => state.setCurrentSection);
  const clear = useDocumentStore((state) => state.clearCurrentDocument);
  
  return { id, sections, currentSection, setDocument, setSection, clear };
};

export const useNavigation = () => {
  const isMainPage = useDocumentStore((state) => state.isMainPage);
  const setIsMainPage = useDocumentStore((state) => state.setIsMainPage);
  
  return { isMainPage, setIsMainPage };
};

// Hook for components that need both sidebars (like SidebarLayout replacement)
export const useSidebars = () => {
  const leftSidebarOpen = useDocumentStore((state) => state.leftSidebar.isOpen);
  const toggleLeft = useDocumentStore((state) => state.toggleLeftSidebar);
  const closeLeft = useDocumentStore((state) => state.closeLeftSidebar);
  const openLeft = useDocumentStore((state) => state.openLeftSidebar);
  
  const rightSidebarOpen = useDocumentStore((state) => state.rightSidebar.isOpen);
  const toggleRight = useDocumentStore((state) => state.toggleRightSidebar);
  const closeRight = useDocumentStore((state) => state.closeRightSidebar);
  const openRight = useDocumentStore((state) => state.openRightSidebar);
  
  const closeBoth = useDocumentStore((state) => state.closeBothSidebars);
  const resetAll = useDocumentStore((state) => state.resetAll);
  
  return {
    leftSidebar: {
      isOpen: leftSidebarOpen,
      toggle: toggleLeft,
      close: closeLeft,
      open: openLeft,
    },
    rightSidebar: {
      isOpen: rightSidebarOpen,
      toggle: toggleRight,
      close: closeRight,
      open: openRight,
    },
    closeBoth,
    resetAll,
  };
}; 