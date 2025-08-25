import { create } from "zustand";
import { subscribeWithSelector, persist } from "zustand/middleware";
import { toast } from "sonner";

// Health check function type
type HealthCheckFunction = (params: { edToken: string }) => Promise<{
  isHealthy: boolean;
  message: string;
  coursesCount?: number;
}>;

// WebSocket-like Extension Bridge
class ExtensionBridge {
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private isReady = false;
  private currentToken: string | null = null;

  constructor() {
    this.init();
  }

  private init() {
    console.log("[Extension Bridge] Initializing bridge...");

    // Listen for extension messages
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.source !== "ask-ed-extension") return;

      console.log("[Extension Bridge] Received:", event.data);

      switch (event.data.type) {
        case "extensionReady":
          console.log("[Extension Bridge] Extension ready signal received");
          this.isReady = true;
          this.emit("ready", {});
          break;
        case "tokenUpdate":
          this.currentToken = event.data.token;
          this.emit("token", { token: event.data.token });
          break;
        case "tokenResponse":
          this.emit("tokenResponse", { token: event.data.token });
          break;
        case "connectionLost":
          this.isReady = false;
          this.emit("disconnected", {});
          break;
      }
    });

    // Send a test message to check if extension is available
    this.checkExtensionAvailability();
  }

  private checkExtensionAvailability() {
    console.log("[Extension Bridge] Checking extension availability on:", window.location.hostname);
    // Try to communicate with extension immediately
    window.postMessage(
      {
        source: "ask-ed-webapp",
        action: "ping",
      },
      "*",
    );
  }

  public send(action: string, data: any = {}) {
    if (!this.isReady) {
      console.warn("[Extension Bridge] Not ready, cannot send message");
      return;
    }

    window.postMessage(
      {
        source: "ask-ed-webapp",
        action,
        ...data,
      },
      "*",
    );
  }

  public getToken() {
    this.send("getToken");
  }

  public on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: (data: any) => void) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(data));
    }
  }

  public isConnected() {
    return this.isReady;
  }
}

// Store interfaces
interface ExtensionStatus {
  isInstalled: boolean;
  isConnected: boolean;
  lastChecked: Date | null;
  error: string | null;
}

interface TokenData {
  value: string;
  source: "manual" | "extension";
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
  setManualToken: (token: string, skipHealthCheck?: boolean) => void;
  toggleAutoDetection: () => void;
  checkTokenHealth: (healthCheckFn?: HealthCheckFunction) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  validateToken: (token: string) => Promise<boolean>;
  clearTokenData: () => void;
}

// Global extension bridge instance
let extensionBridge: ExtensionBridge | null = null;

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
        value: "",
        source: "manual",
        lastUpdated: null,
        isValid: false,
      },

      health: {
        isHealthy: false,
        message: "Not checked",
        lastChecked: null,
      },

      preferences: {
        autoDetectionEnabled: false,
        colorTheme: "default",
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
        // Show attention if no token, token is invalid, or token health check failed
        // Extension connection status should not affect this
        return !activeToken || !state.token.isValid || !state.health.isHealthy;
      },

      isTokenHealthy: () => {
        const state = get();
        const activeToken = state.getActiveToken();
        // Token health is independent of extension connection status
        return !!activeToken && state.token.isValid && state.health.isHealthy;
      },

      getActiveToken: () => {
        const state = get();
        if (
          state.preferences.autoDetectionEnabled &&
          state.extension.isConnected &&
          state.token.source === "extension"
        ) {
          return state.token.value;
        }
        return state.token.source === "manual" ? state.token.value : "";
      },

      isTokenReadonly: () => {
        const state = get();
        return (
          state.preferences.autoDetectionEnabled &&
          state.extension.isConnected &&
          state.token.source === "extension" &&
          state.token.value.length > 0
        );
      },

      // Actions
      setManualToken: (token: string, skipHealthCheck: boolean = false) => {
        const state = get();
        if (state.isTokenReadonly()) {
          toast.error(
            "Cannot modify token while extension auto-detection is active",
          );
          return;
        }

        set((state) => ({
          token: {
            value: token,
            source: "manual",
            lastUpdated: new Date(),
            isValid: token.trim().length > 0,
          },
        }));

        // Save to localStorage
        if (token.trim()) {
          localStorage.setItem("ed-session-key", token);
        } else {
          localStorage.removeItem("ed-session-key");
        }

        // Only trigger health check if explicitly requested
        if (!skipHealthCheck) {
          get().checkTokenHealth();
        }
      },

      toggleAutoDetection: () => {
        const state = get();

        if (!state.preferences.autoDetectionEnabled) {
          // Trying to enable auto-detection
          if (!state.canEnableAutoDetection()) {
            toast.error(
              "Extension must be installed and connected to enable auto-detection",
            );
            return;
          }

          set((state) => ({
            preferences: {
              ...state.preferences,
              autoDetectionEnabled: true,
            },
          }));

          toast.success(
            "Auto-detection enabled - extension will manage your token",
          );

          // Request current token from extension
          if (extensionBridge) {
            extensionBridge.getToken();
          }
        } else {
          // Disabling auto-detection
          set((state) => ({
            preferences: {
              ...state.preferences,
              autoDetectionEnabled: false,
            },
            // Switch to manual token from localStorage
            token: {
              value: localStorage.getItem("ed-session-key") || "",
              source: "manual",
              lastUpdated: new Date(),
              isValid:
                (localStorage.getItem("ed-session-key") || "").trim().length >
                0,
            },
          }));

          toast.info(
            "Auto-detection disabled - you can now manually manage your token",
          );
        }
      },

      checkTokenHealth: async (healthCheckFn?: HealthCheckFunction) => {
        const state = get();
        const activeToken = state.getActiveToken();

        if (!activeToken) {
          set((state) => ({
            health: {
              isHealthy: false,
              message: "ED token not configured",
              lastChecked: new Date(),
            },
            isCheckingHealth: false,
          }));
          return;
        }

        if (!healthCheckFn) {
          set((state) => ({
            health: {
              isHealthy: true,
              message: "Token configured (health check not available)",
              lastChecked: new Date(),
            },
            isCheckingHealth: false,
          }));
          return;
        }

        if (state.isCheckingHealth) return;

        set({ isCheckingHealth: true });

        try {
          // Add timeout to prevent health check from getting stuck
          const healthCheckPromise = healthCheckFn({ edToken: activeToken });
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Health check timeout")), 10000);
          });

          const result = await Promise.race([healthCheckPromise, timeoutPromise]);
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
              message:
                error instanceof Error ? error.message : "Health check failed",
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
          },
        }));
      },

      validateToken: async (token: string): Promise<boolean> => {
        if (!token.trim()) return false;

        set({ isValidatingToken: true });

        try {
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
            value: "",
            source: "manual",
            lastUpdated: null,
            isValid: false,
          },
        }));
        localStorage.removeItem("ed-session-key");
      },
    })),
    {
      name: "user-store",
      partialize: (state) => ({
        preferences: state.preferences,
        token: {
          // Only persist manual tokens, not extension tokens
          value: state.token.source === "manual" ? state.token.value : "",
          source: "manual",
          lastUpdated:
            state.token.source === "manual" ? state.token.lastUpdated : null,
          isValid:
            state.token.source === "manual" ? state.token.isValid : false,
        },
      }),
    },
  ),
);

// Initialize extension bridge and set up reactive communication (client-side only)
if (typeof window !== "undefined") {
  // Initialize extension bridge
  extensionBridge = new ExtensionBridge();

  // Set up extension event handlers
  extensionBridge.on("ready", () => {
    console.log("[Extension Bridge] Extension ready");
    useUserStore.setState((state) => ({
      extension: {
        ...state.extension,
        isInstalled: true,
        isConnected: true,
        error: null,
        lastChecked: new Date(),
      },
    }));

    // Request current token immediately when extension connects
    extensionBridge!.getToken();

    // Also request again if auto-detection is enabled
    const state = useUserStore.getState();
    if (state.preferences.autoDetectionEnabled) {
      setTimeout(() => extensionBridge!.getToken(), 100);
    }
  });

  extensionBridge.on("disconnected", () => {
    console.log("[Extension Bridge] Extension disconnected");
    useUserStore.setState((state) => ({
      extension: {
        ...state.extension,
        isConnected: false,
        error: "Extension disconnected",
      },
      // Reset health checking state to prevent stuck yellow indicator
      isCheckingHealth: false,
      // Preserve token when extension disconnects - it may still be valid
      // Switch to manual mode if we had an extension token
      token: state.token.source === "extension" ? {
        ...state.token,
        source: "manual", // Switch to manual so user can still use the token
      } : state.token,
    }));
  });

  extensionBridge.on("token", (data) => {
    console.log("[Extension Bridge] Token updated:", !!data.token);
    const state = useUserStore.getState();

    if (state.preferences.autoDetectionEnabled) {
      useUserStore.setState((state) => ({
        token: {
          value: data.token || "",
          source: "extension",
          lastUpdated: new Date(),
          isValid: !!data.token,
        },
      }));

      // Save to localStorage as backup
      if (data.token) {
        localStorage.setItem("ed-session-key", data.token);
        toast.success("Extension token automatically updated");
      }
    }
  });

  extensionBridge.on("tokenResponse", (data) => {
    console.log("[Extension Bridge] Token response:", !!data.token);
    const state = useUserStore.getState();

    if (state.preferences.autoDetectionEnabled && data.token) {
      useUserStore.setState((state) => ({
        token: {
          value: data.token,
          source: "extension",
          lastUpdated: new Date(),
          isValid: true,
        },
      }));

      localStorage.setItem("ed-session-key", data.token);
      toast.success("Extension token detected and applied!");
    }
  });

  // Load manual token from localStorage on startup
  const savedToken = localStorage.getItem("ed-session-key") || "";
  if (savedToken) {
    useUserStore.getState().setManualToken(savedToken, true);
  }

  // Set timeout to detect if extension is not installed
  setTimeout(() => {
    const currentState = useUserStore.getState();
    if (
      !currentState.extension.isInstalled &&
      !currentState.extension.isConnected
    ) {
      console.log("[Extension Bridge] Extension not detected after timeout");
      useUserStore.setState((state) => ({
        extension: {
          ...state.extension,
          error: "Extension not installed or not enabled",
          lastChecked: new Date(),
        },
      }));
    }
  }, 3000); // Wait 3 seconds for extension to respond
}
