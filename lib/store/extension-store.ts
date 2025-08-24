import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface ExtensionState {
  // Extension connection status
  isExtensionInstalled: boolean;
  isExtensionConnected: boolean;
  
  // Token management
  edAuthToken: string | null;
  tokenLastUpdated: Date | null;
  isTokenValid: boolean;
  
  // Auto-detection state
  isAutoDetectionEnabled: boolean;
  isDetecting: boolean;
  detectionError: string | null;
  
  // Actions
  setExtensionInstalled: (installed: boolean) => void;
  setExtensionConnected: (connected: boolean) => void;
  setEdAuthToken: (token: string | null) => void;
  setTokenValid: (valid: boolean) => void;
  enableAutoDetection: () => void;
  disableAutoDetection: () => void;
  startDetection: () => void;
  stopDetection: () => void;
  setDetectionError: (error: string | null) => void;
  refreshToken: () => Promise<void>;
  checkExtensionStatus: () => Promise<void>;
  clearTokenData: () => void;
}

// Extension ID for the Ask Ed Extension
const EXTENSION_ID = 'khkpabmjdnppeahmgpdjkomocjenpabe';

// Check if extension is installed and get token using postMessage API
const checkExtension = async (): Promise<{
  installed: boolean;
  connected: boolean;
  token: string | null;
  error?: string;
}> => {
  try {
    console.log('[Extension Store] Checking extension status...');
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.log('[Extension Store] Not in browser environment');
      return { installed: false, connected: false, token: null, error: 'Not in browser' };
    }

    // First try: Direct communication via window.postMessage
    console.log('[Extension Store] Attempting window.postMessage communication');
    
    return new Promise((resolve) => {
      const messageId = Math.random().toString(36).substr(2, 9);
      let resolved = false;

      // Listen for response from extension
      const handleMessage = (event: MessageEvent) => {
        if (resolved) return;
        
        console.log('[Extension Store] Received message:', event.data);
        
        if (event.data && event.data.source === 'ask-ed-extension' && event.data.messageId === messageId) {
          resolved = true;
          window.removeEventListener('message', handleMessage);
          
          if (event.data.success && event.data.token !== undefined) {
            console.log('[Extension Store] Extension communication successful, token:', !!event.data.token);
            resolve({
              installed: true,
              connected: true,
              token: event.data.token || null
            });
          } else {
            console.log('[Extension Store] Extension responded but with error:', event.data.error);
            resolve({
              installed: true,
              connected: false,
              token: null,
              error: event.data.error || 'Extension communication failed'
            });
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Send request to extension via content script
      window.postMessage({
        source: 'ask-ed-webapp',
        action: 'getEdToken',
        messageId
      }, '*');

      // Fallback: Try Chrome runtime API if available
      setTimeout(() => {
        if (resolved) return;
        
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          console.log('[Extension Store] Trying Chrome runtime API fallback');
          try {
            chrome.runtime.sendMessage(
              EXTENSION_ID,
              { action: 'getEdToken' },
              (response) => {
                if (resolved) return;
                
                console.log('[Extension Store] Chrome API response:', response);
                console.log('[Extension Store] Chrome API error:', chrome.runtime.lastError);
                
                if (!chrome.runtime.lastError && response && typeof response === 'object' && 'token' in response) {
                  resolved = true;
                  window.removeEventListener('message', handleMessage);
                  resolve({
                    installed: true,
                    connected: true,
                    token: response.token || null
                  });
                }
              }
            );
          } catch (error) {
            console.log('[Extension Store] Chrome API fallback failed:', error);
          }
        }
      }, 1000);

      // Final timeout
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener('message', handleMessage);
        console.log('[Extension Store] Extension communication timeout');
        resolve({ 
          installed: false, 
          connected: false, 
          token: null, 
          error: 'Extension not detected - install Ask Ed Extension' 
        });
      }, 3000);
    });
  } catch (error) {
    console.log('[Extension Store] Check extension error:', error);
    return { 
      installed: false, 
      connected: false, 
      token: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

export const useExtensionStore = create<ExtensionState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isExtensionInstalled: false,
    isExtensionConnected: false,
    edAuthToken: null,
    tokenLastUpdated: null,
    isTokenValid: false,
    isAutoDetectionEnabled: false,
    isDetecting: false,
    detectionError: null,

    // Actions
    setExtensionInstalled: (installed) => set({ isExtensionInstalled: installed }),
    setExtensionConnected: (connected) => set({ isExtensionConnected: connected }),
    
    setEdAuthToken: (token) => set({ 
      edAuthToken: token,
      tokenLastUpdated: token ? new Date() : null,
      isTokenValid: Boolean(token),
      detectionError: null
    }),
    
    setTokenValid: (valid) => set({ isTokenValid: valid }),
    
    enableAutoDetection: () => set({ isAutoDetectionEnabled: true }),
    disableAutoDetection: () => set({ isAutoDetectionEnabled: false, isDetecting: false }),
    
    startDetection: () => set({ isDetecting: true, detectionError: null }),
    stopDetection: () => set({ isDetecting: false }),
    
    setDetectionError: (error) => set({ detectionError: error, isDetecting: false }),
    
    refreshToken: async () => {
      const state = get();
      if (state.isDetecting) return; // Prevent concurrent requests
      
      set({ isDetecting: true, detectionError: null });
      
      try {
        const result = await checkExtension();
        
        set({
          isExtensionInstalled: result.installed,
          isExtensionConnected: result.connected,
          detectionError: result.error || null,
          isDetecting: false
        });
        
        if (result.connected && result.token) {
          set({
            edAuthToken: result.token,
            tokenLastUpdated: new Date(),
            isTokenValid: true
          });
        } else if (result.connected && !result.token) {
          // Extension is connected but no token available
          set({
            edAuthToken: null,
            tokenLastUpdated: null,
            isTokenValid: false
          });
        }
      } catch (error) {
        set({
          detectionError: error instanceof Error ? error.message : 'Failed to refresh token',
          isDetecting: false,
          isExtensionInstalled: false,
          isExtensionConnected: false
        });
      }
    },
    
    checkExtensionStatus: async () => {
      try {
        const result = await checkExtension();
        set({
          isExtensionInstalled: result.installed,
          isExtensionConnected: result.connected,
          detectionError: result.error || null
        });
      } catch (error) {
        set({
          detectionError: error instanceof Error ? error.message : 'Failed to check extension',
          isExtensionInstalled: false,
          isExtensionConnected: false
        });
      }
    },
    
    clearTokenData: () => set({
      edAuthToken: null,
      tokenLastUpdated: null,
      isTokenValid: false,
      detectionError: null
    })
  }))
);

// Auto-detection hook - runs periodically when enabled
let detectionInterval: NodeJS.Timeout | null = null;

// Subscribe to auto-detection changes
useExtensionStore.subscribe(
  (state) => state.isAutoDetectionEnabled,
  (enabled) => {
    if (enabled) {
      // Start periodic token refresh
      detectionInterval = setInterval(() => {
        const state = useExtensionStore.getState();
        if (state.isAutoDetectionEnabled && !state.isDetecting) {
          state.refreshToken();
        }
      }, 30000); // Check every 30 seconds
      
      // Initial check
      useExtensionStore.getState().refreshToken();
    } else {
      // Stop periodic refresh
      if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
      }
    }
  }
);

// Initialize extension detection on load (client-side only)
if (typeof window !== 'undefined') {
  // Wait for DOM and extension to be ready
  const initializeExtension = () => {
    console.log('[Extension Store] Initializing extension detection');
    useExtensionStore.getState().checkExtensionStatus();
  };

  // Try multiple times to ensure extension is loaded
  if (document.readyState === 'complete') {
    setTimeout(initializeExtension, 500);
    setTimeout(initializeExtension, 2000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(initializeExtension, 500);
      setTimeout(initializeExtension, 2000);
    });
  }
}