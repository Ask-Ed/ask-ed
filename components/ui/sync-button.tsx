"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function SyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [edToken, setEdToken] = useState<string>("");
  const [healthStatus, setHealthStatus] = useState<{
    isHealthy: boolean;
    message: string;
    coursesCount?: number;
  } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const syncAllActiveCourses = useAction(api.sync.syncAllActiveCourses);
  const getHealthStatus = useAction(api.sync.getHealthStatus);
  const allSyncStates = useQuery(api.sync.getAllSyncStates);

  // Load ED token from localStorage
  useEffect(() => {
    const token = localStorage.getItem("ed-session-key") || "";
    setEdToken(token);
  }, []);

  // Health check when token changes
  useEffect(() => {
    if (!edToken) {
      setHealthStatus({
        isHealthy: false,
        message: "ED token not configured",
      });
      return;
    }

    let mounted = true;
    setIsCheckingHealth(true);

    const checkHealth = async () => {
      try {
        const result = await getHealthStatus({ edToken });
        if (mounted) {
          setHealthStatus(result);
        }
      } catch (error) {
        if (mounted) {
          setHealthStatus({
            isHealthy: false,
            message: error instanceof Error ? error.message : "Health check failed",
          });
        }
      } finally {
        if (mounted) {
          setIsCheckingHealth(false);
        }
      }
    };

    checkHealth();

    return () => {
      mounted = false;
    };
  }, [edToken, getHealthStatus]);

  // Check if any sync is currently running
  const hasSyncRunning = allSyncStates?.some(state => state.status === "syncing");

  const handleSync = async () => {
    if (!edToken) {
      toast.error("Please configure your ED token in settings first");
      return;
    }

    if (!healthStatus?.isHealthy) {
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

  const isDisabled = isLoading || hasSyncRunning || !healthStatus?.isHealthy;

  // LED color based on health status
  const getLedColor = () => {
    if (isCheckingHealth) return "bg-yellow-400"; // Loading
    if (!edToken) return "bg-gray-400";
    if (healthStatus?.isHealthy) return "bg-green-400";
    return "bg-red-400";
  };

  const getLedAnimation = () => {
    if (isCheckingHealth) return "animate-pulse"; // Loading
    if (healthStatus?.isHealthy) return "";
    return "animate-pulse";
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSync}
      disabled={isDisabled}
      className="h-8 gap-1 px-2"
      title={
        !edToken 
          ? "ED token not configured" 
          : isCheckingHealth
          ? "Checking connection..."
          : healthStatus?.message || "Unknown status"
      }
    >
      <RefreshCw className={`h-4 w-4 ${isLoading || hasSyncRunning ? 'animate-spin' : ''}`} />
      <span className="text-xs font-medium">Sync</span>
      <span className="text-xs">•</span>
      
      {/* Realistic LED Light */}
      <div className="relative">
        <div 
          className={`w-2 h-2 rounded-full ${getLedColor()} ${getLedAnimation()}`}
          style={{
            boxShadow: `0 0 6px ${
              isCheckingHealth ? '#facc15' :
              !edToken ? '#9ca3af' :
              healthStatus?.isHealthy ? '#22c55e' : '#ef4444'
            }, 0 0 12px ${
              isCheckingHealth ? '#facc15' :
              !edToken ? '#9ca3af' :
              healthStatus?.isHealthy ? '#22c55e' : '#ef4444'
            }50`
          }}
          title={
            isCheckingHealth
              ? "Checking connection..." 
              : healthStatus?.message || "Unknown status"
          }
        />
        {/* Inner bright core */}
        <div 
          className={`absolute inset-0.5 rounded-full ${
            isCheckingHealth ? 'bg-yellow-200' :
            !edToken ? 'bg-gray-200' :
            healthStatus?.isHealthy ? 'bg-green-200' : 'bg-red-200'
          }`}
        />
      </div>
    </Button>
  );
}