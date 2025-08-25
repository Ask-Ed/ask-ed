"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, memo, useMemo } from "react";
import { toast } from "sonner";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserStore } from "@/lib/store/user-store";

export const SyncButton = memo(function SyncButton() {
  const [isLoading, setIsLoading] = useState(false);

  // Get token and health status from user store
  const { 
    getActiveToken, 
    shouldShowTokenAttention, 
    health,
    isCheckingHealth,
    checkTokenHealth,
    isTokenHealthy
  } = useUserStore();
  const edToken = getActiveToken();

  const syncAllActiveCourses = useAction(api.sync.syncAllActiveCourses);
  const getHealthStatus = useAction(api.sync.getHealthStatus);
  const allSyncStates = useQuery(api.sync.getAllSyncStates);

  // Health check when token changes - now handled by user store
  useEffect(() => {
    // Only check health if we have a token
    if (!edToken) return;
    
    // Register health check function with user store
    const healthCheckFn = async (params: { edToken: string }) => {
      try {
        return await getHealthStatus(params);
      } catch (error) {
        // Handle health check errors gracefully
        return {
          isHealthy: false,
          message: error instanceof Error ? error.message : "Health check failed",
        };
      }
    };

    checkTokenHealth(healthCheckFn);
  }, [edToken, getHealthStatus, checkTokenHealth]);

  // Check if any sync is currently running
  const hasSyncRunning = allSyncStates?.some(state => state.status === "syncing");

  const handleSync = async () => {
    if (!edToken) {
      toast.error("Please configure your ED token in settings first");
      return;
    }

    if (!health.isHealthy) {
      toast.error("ED connection is not healthy. Please check your token in settings.");
      return;
    }

    if (hasSyncRunning) {
      toast.info("Sync already in progress");
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await syncAllActiveCourses({
        syncType: "delta",
        forceFullSync: false,
        edToken,
      });
      
      toast.success(
        `Started sync for ${result.startedSyncs}/${result.totalCourses} active courses`
      );
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error(
        error instanceof Error 
          ? `Sync failed: ${error.message}`
          : "Sync failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || hasSyncRunning || !health.isHealthy;

  // LED color and animation based on health status - memoized to prevent re-renders
  const ledColor = useMemo(() => {
    if (isCheckingHealth) return "bg-yellow-400"; // Loading
    if (!edToken) return "bg-gray-400";
    if (health.isHealthy) return "bg-green-400";
    return "bg-red-400";
  }, [isCheckingHealth, edToken, health.isHealthy]);

  const ledAnimation = useMemo(() => {
    if (isCheckingHealth) return "animate-pulse"; // Loading
    if (health.isHealthy) return "";
    return "animate-pulse";
  }, [isCheckingHealth, health.isHealthy]);

  const ledShadowColor = useMemo(() => {
    return isCheckingHealth ? '#facc15' :
           !edToken ? '#9ca3af' :
           health.isHealthy ? '#22c55e' : '#ef4444';
  }, [isCheckingHealth, edToken, health.isHealthy]);

  const ledInnerColor = useMemo(() => {
    return isCheckingHealth ? 'bg-yellow-200' :
           !edToken ? 'bg-gray-200' :
           health.isHealthy ? 'bg-green-200' : 'bg-red-200';
  }, [isCheckingHealth, edToken, health.isHealthy]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={isDisabled}
      className="h-9 gap-1 px-2 bg-card/80 backdrop-blur-xl border border-border hover:bg-accent hover:border-border"
      title={
        !edToken 
          ? "ED token not configured" 
          : isCheckingHealth
          ? "Checking connection..."
          : health.message || "Unknown status"
      }
    >
      <RefreshCw className={`h-4 w-4 ${isLoading || hasSyncRunning ? 'animate-spin' : ''}`} />
      <span className="text-xs font-medium">Sync</span>
      <span className="text-xs">•</span>
      
      {/* Realistic LED Light */}
      <div className="relative">
        <div 
          className={`w-2 h-2 rounded-full ${ledColor} ${ledAnimation}`}
          style={{
            boxShadow: `0 0 6px ${ledShadowColor}, 0 0 12px ${ledShadowColor}50`
          }}
          title={
            isCheckingHealth
              ? "Checking connection..." 
              : health.message || "Unknown status"
          }
        />
        {/* Inner bright core */}
        <div className={`absolute inset-0.5 rounded-full ${ledInnerColor}`} />
      </div>
    </Button>
  );
});