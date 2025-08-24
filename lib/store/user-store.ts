import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { toast } from 'sonner';

// We'll need to pass the health check function from outside since we can't import Convex directly in the store
type HealthCheckFunction = (params: { edToken: string }) => Promise<{
  isHealthy: boolean;
  message: string;
  coursesCount?: number;
}>;

// Extension communication
const EXTENSION_ID = 'khkpabmjdnppeahmgpdjkomocjenpabe';

interface ExtensionStatus {
  isInstalled: boolean;
  isConnected: boolean;
  lastChecked: Date | null;
  error: string | null;
}

interface TokenData {
  value: string;
  source: 'manual' | 'extension';
  lastUpdated: Date | null;
  isValid: boolean;
}

interface HealthStatus {
  isHealthy: boolean;
  message: string;
  coursesCount?: number;
  lastChecked: Date | null;
}

interface UserPreferences {
  autoDetectionEnabled: boolean;
  colorTheme: string;
  darkMode: boolean;
}

interface UserState {
  // Extension status
  extension: ExtensionStatus;
  
  // Token management
  token: TokenData;
  
  // Health status
  health: HealthStatus;
  
  // User preferences
  preferences: UserPreferences;
  
  // Loading states
  isCheckingExtension: boolean;
  isValidatingToken: boolean;
  isCheckingHealth: boolean;
  
  // Computed getters
  canEnableAutoDetection: () => boolean;
  shouldShowTokenAttention: () => boolean;
  getActiveToken: () => string;
  isTokenReadonly: () => boolean;
  isTokenHealthy: () => boolean;
  
  // Actions
  checkExtensionStatus: () => Promise<void>;
  setManualToken: (token: string, skipHealthCheck?: boolean) => void;
  toggleAutoDetection: () => void;
  refreshExtensionToken: () => Promise<void>;
  checkTokenHealth: (healthCheckFn?: HealthCheckFunction) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  validateToken: (token: string) => Promise<boolean>;
  clearTokenData: () => void;
}

// Extension communication helper
const checkExtension = async (): Promise<{
  installed: boolean;
  connected: boolean;
  token: string | null;
  error?: string;
}> => {
  try {
    if (typeof window === 'undefined') {
      return { installed: false, connected: false, token: null, error: 'Not in browser' };
    }

    return new Promise((resolve) => {
      const messageId = Math.random().toString(36).substr(2, 9);
      let resolved = false;

      const handleMessage = (event: MessageEvent) => {
        if (resolved || !event.data || event.data.source !== 'ask-ed-extension' || event.data.messageId !== messageId) {
          return;
        }
        
        resolved = true;
        window.removeEventListener('message', handleMessage);
        
        if (event.data.success && event.data.token !== undefined) {
          resolve({
            installed: true,
            connected: true,
            token: event.data.token || null
          });
        } else {
          resolve({
            installed: true,
            connected: false,
            token: null,
            error: event.data.error || 'Extension communication failed'
          });
        }
      };

      window.addEventListener('message', handleMessage);

      // Send request to extension
      window.postMessage({
        source: 'ask-ed-webapp',
        action: 'getEdToken',
        messageId
      }, '*');

      // Chrome runtime API fallback
      setTimeout(() => {
        if (resolved) return;
        
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          try {
            chrome.runtime.sendMessage(
              EXTENSION_ID,
              { action: 'getEdToken' },
              (response) => {
                if (resolved) return;
                
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
            // Chrome API failed, continue to timeout
          }
        }
      }, 1000);

      // Timeout
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener('message', handleMessage);
        resolve({ 
          installed: false, 
          connected: false, 
          token: null, 
          error: 'Extension not detected'
        });
      }, 3000);
    });
  } catch (error) {
    return { 
      installed: false, 
      connected: false, 
      token: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

export const useUserStore = create<UserState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // Initial state
      extension: {
        isInstalled: false,
        isConnected: false,
        lastChecked: null,
        error: null,
      },
      
      token: {
        value: '',
        source: 'manual',
        lastUpdated: null,
        isValid: false,
      },
      
      health: {
        isHealthy: false,
        message: 'Not checked',
        lastChecked: null,
      },
      
      preferences: {
        autoDetectionEnabled: false,
        colorTheme: 'default',
        darkMode: false,
      },
      
      isCheckingExtension: false,
      isValidatingToken: false,
      isCheckingHealth: false,

      // Computed getters
      canEnableAutoDetection: () => {
        const state = get();
        return state.extension.isInstalled && state.extension.isConnected;
      },

      shouldShowTokenAttention: () => {
        const state = get();
        const activeToken = state.getActiveToken();
        return !activeToken || !state.token.isValid || !state.health.isHealthy;
      },

      isTokenHealthy: () => {
        const state = get();
        const activeToken = state.getActiveToken();
        return !!activeToken && state.token.isValid && state.health.isHealthy;
      },

      getActiveToken: () => {
        const state = get();
        if (state.preferences.autoDetectionEnabled && state.extension.isConnected && state.token.source === 'extension') {
          return state.token.value;
        }
        return state.token.source === 'manual' ? state.token.value : '';
      },

      isTokenReadonly: () => {
        const state = get();
        return state.preferences.autoDetectionEnabled && 
               state.extension.isConnected && 
               state.token.source === 'extension' &&
               state.token.value.length > 0;
      },

      // Actions
      checkExtensionStatus: async () => {
        const state = get();
        if (state.isCheckingExtension) return;

        set({ isCheckingExtension: true });

        try {
          const result = await checkExtension();
          
          set((state) => ({
            extension: {
              isInstalled: result.installed,
              isConnected: result.connected,
              lastChecked: new Date(),
              error: result.error || null,
            },
            isCheckingExtension: false,
          }));

          // If extension has a token and auto-detection is enabled, use it
          if (result.connected && result.token && state.preferences.autoDetectionEnabled) {
            set((state) => ({
              token: {
                value: result.token!,
                source: 'extension',
                lastUpdated: new Date(),
                isValid: true, // We'll validate this separately if needed
              }
            }));
            
            // Save to localStorage as backup
            localStorage.setItem('ed-session-key', result.token);
            toast.success('Extension token detected and applied!');
          }
          
          // If extension is not available but auto-detection was enabled, disable it
          if (!result.connected && state.preferences.autoDetectionEnabled) {
            set((state) => ({
              preferences: {
                ...state.preferences,
                autoDetectionEnabled: false,
              }
            }));
            toast.info('Auto-detection disabled - extension not available');
          }

        } catch (error) {
          set({
            extension: {
              isInstalled: false,
              isConnected: false,
              lastChecked: new Date(),
              error: error instanceof Error ? error.message : 'Check failed',
            },
            isCheckingExtension: false,
          });
        }
      },

      setManualToken: (token: string, skipHealthCheck: boolean = false) => {
        // Only allow manual token setting if not in extension mode
        const state = get();
        if (state.isTokenReadonly()) {
          toast.error('Cannot modify token while extension auto-detection is active');
          return;
        }

        set((state) => ({
          token: {
            value: token,
            source: 'manual',
            lastUpdated: new Date(),
            isValid: token.trim().length > 0,
          }
        }));

        // Save to localStorage
        if (token.trim()) {
          localStorage.setItem('ed-session-key', token);
        } else {
          localStorage.removeItem('ed-session-key');
        }

        // Only trigger health check if explicitly requested (e.g., on save)
        if (!skipHealthCheck) {
          setTimeout(() => get().checkTokenHealth(), 100);
        }
      },

      toggleAutoDetection: () => {
        const state = get();
        
        if (!state.preferences.autoDetectionEnabled) {
          // Trying to enable auto-detection
          if (!state.canEnableAutoDetection()) {
            toast.error('Extension must be installed and connected to enable auto-detection');
            return;
          }
          
          set((state) => ({
            preferences: {
              ...state.preferences,
              autoDetectionEnabled: true,
            }
          }));

          toast.success('Auto-detection enabled - extension will manage your token');
          
          // Immediately try to get extension token
          get().refreshExtensionToken();
        } else {
          // Disabling auto-detection
          set((state) => ({
            preferences: {
              ...state.preferences,
              autoDetectionEnabled: false,
            },
            // Switch to manual token from localStorage
            token: {
              value: localStorage.getItem('ed-session-key') || '',
              source: 'manual',
              lastUpdated: new Date(),
              isValid: (localStorage.getItem('ed-session-key') || '').trim().length > 0,
            }
          }));

          toast.info('Auto-detection disabled - you can now manually manage your token');
        }
      },

      refreshExtensionToken: async () => {
        const state = get();
        if (!state.preferences.autoDetectionEnabled) return;

        await state.checkExtensionStatus();
      },

      checkTokenHealth: async (healthCheckFn?: HealthCheckFunction) => {
        const state = get();
        const activeToken = state.getActiveToken();
        
        if (!activeToken) {
          set((state) => ({
            health: {
              isHealthy: false,
              message: 'ED token not configured',
              lastChecked: new Date(),
            }
          }));
          return;
        }

        if (!healthCheckFn) {
          // If no health check function provided, just assume token is valid if it exists
          set((state) => ({
            health: {
              isHealthy: true,
              message: 'Token configured (health check not available)',
              lastChecked: new Date(),
            }
          }));
          return;
        }

        if (state.isCheckingHealth) return;

        set({ isCheckingHealth: true });

        try {
          const result = await healthCheckFn({ edToken: activeToken });
          set((state) => ({
            health: {
              isHealthy: result.isHealthy,
              message: result.message,
              coursesCount: result.coursesCount,
              lastChecked: new Date(),
            },
            isCheckingHealth: false,
          }));
        } catch (error) {
          set((state) => ({
            health: {
              isHealthy: false,
              message: error instanceof Error ? error.message : 'Health check failed',
              lastChecked: new Date(),
            },
            isCheckingHealth: false,
          }));
        }
      },

      updatePreferences: (newPreferences: Partial<UserPreferences>) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...newPreferences,
          }
        }));
      },

      validateToken: async (token: string): Promise<boolean> => {
        if (!token.trim()) return false;
        
        set({ isValidatingToken: true });
        
        try {
          // Here you would implement actual token validation
          // For now, just check if it's not empty
          const isValid = token.trim().length > 0;
          
          set((state) => ({
            token: {
              ...state.token,
              isValid,
            },
            isValidatingToken: false,
          }));
          
          return isValid;
        } catch (error) {
          set({ isValidatingToken: false });
          return false;
        }
      },

      clearTokenData: () => {
        set((state) => ({
          token: {
            value: '',
            source: 'manual',
            lastUpdated: null,
            isValid: false,
          }
        }));
        localStorage.removeItem('ed-session-key');
      },
    })),
    {
      name: 'user-store',
      partialize: (state) => ({
        preferences: state.preferences,
        token: {
          // Only persist manual tokens, not extension tokens
          value: state.token.source === 'manual' ? state.token.value : '',
          source: 'manual',
          lastUpdated: state.token.source === 'manual' ? state.token.lastUpdated : null,
          isValid: state.token.source === 'manual' ? state.token.isValid : false,
        },
      }),
    }
  )
);

// Initialize extension detection
if (typeof window !== 'undefined') {
  // Load manual token from localStorage on startup
  const savedToken = localStorage.getItem('ed-session-key') || '';
  if (savedToken) {
    useUserStore.getState().setManualToken(savedToken);
  }

  // Check extension status on startup
  const initializeExtension = () => {
    useUserStore.getState().checkExtensionStatus();
  };

  if (document.readyState === 'complete') {
    setTimeout(initializeExtension, 500);
  } else {
    window.addEventListener('load', () => {
      setTimeout(initializeExtension, 500);
    });
  }
}

// Auto-refresh extension token when auto-detection is enabled
let refreshInterval: NodeJS.Timeout | null = null;

useUserStore.subscribe(
  (state) => state.preferences.autoDetectionEnabled,
  (enabled) => {
    if (enabled) {
      // Start periodic refresh
      refreshInterval = setInterval(() => {
        const state = useUserStore.getState();
        if (state.preferences.autoDetectionEnabled && !state.isCheckingExtension) {
          state.refreshExtensionToken();
        }
      }, 30000); // Check every 30 seconds
    } else {
      // Stop periodic refresh
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    }
  }
);