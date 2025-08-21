import { WorkflowManager } from "@convex-dev/workflow";
import { components, api } from "./_generated/api";
import { internalMutation, internalAction, mutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { EdClient, type ParsedUserData } from "../lib/ed-client";

export const workflow = new WorkflowManager(components.workflow);

// Constants
const DEFAULT_CLEANUP_DAYS = 7;
const DEFAULT_STUCK_SYNC_HOURS = 2;
const HEALTH_CHECK_TIMEOUT_MS = 10000;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

// Helper function to validate and get environment variables
function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Helper function to create vector config
function createVectorConfig() {
  return {
    url: getRequiredEnvVar('UPSTASH_VECTOR_REST_URL'),
    token: getRequiredEnvVar('UPSTASH_VECTOR_REST_TOKEN'),
  };
}

// Cleanup functions for sync states
export const cleanupCompletedSyncs = mutation({
  args: {
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - (args.olderThanDays ?? DEFAULT_CLEANUP_DAYS) * MILLISECONDS_PER_DAY;

    const completedSyncs = await ctx.db
      .query("courseSyncStates")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "completed"),
            q.eq(q.field("status"), "failed")
          ),
          q.lt(q.field("lastSyncAt"), cutoffTime)
        )
      )
      .collect();

    let deletedCount = 0;
    for (const sync of completedSyncs) {
      await ctx.db.delete(sync._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});

// Reset stuck syncs that have been running too long
export const resetStuckSyncs = mutation({
  args: {
    maxHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxAge = (args.maxHours ?? DEFAULT_STUCK_SYNC_HOURS) * MILLISECONDS_PER_HOUR;
    const cutoffTime = Date.now() - maxAge;

    const stuckSyncs = await ctx.db
      .query("courseSyncStates")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "syncing"),
          q.lt(q.field("lastSyncAt"), cutoffTime)
        )
      )
      .collect();

    let resetCount = 0;
    for (const sync of stuckSyncs) {
      await ctx.db.patch(sync._id, {
        status: "failed",
        errorMessage: "Sync timed out - reset by cleanup",
      });
      resetCount++;
    }

    return { resetCount };
  },
});

// Delete sync state for a specific course
export const deleteCourseSync = mutation({
  args: {
    courseId: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("courseSyncStates")
      .withIndex("by_course_id", (q) => q.eq("courseId", args.courseId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { deleted: true };
    }
    return { deleted: false };
  },
});

// Vector database cleanup functions
export const cleanupCourseVectors = action({
  args: {
    courseId: v.number(),
    edToken: v.string(),
  },
  handler: async (ctx, args) => {
    const vectorConfig = createVectorConfig();

    const client = new EdClient(args.edToken, "eu", vectorConfig);

    try {
      await client.deleteCourseVectors(args.courseId);
      return { success: true, message: `Deleted all vectors for course ${args.courseId}` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete course vectors"
      };
    }
  },
});

export const getCourseVectorStats = action({
  args: {
    courseId: v.number(),
    edToken: v.string(),
  },
  handler: async (ctx, args) => {
    const vectorConfig = createVectorConfig();

    const client = new EdClient(args.edToken, "eu", vectorConfig);

    try {
      const stats = await client.getCourseVectorStats(args.courseId);
      return { success: true, stats };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to get vector stats"
      };
    }
  },
});

// Force full resync of a course (complete cleanup and rebuild)
export const forceFullResync = action({
  args: {
    courseId: v.number(),
    courseName: v.string(),
    courseCode: v.string(),
    edToken: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
    workflowId?: string;
  }> => {
    const vectorConfig = createVectorConfig();

    const client = new EdClient(args.edToken, "eu", vectorConfig);

    try {
      // Step 1: Delete existing vectors
      await client.deleteCourseVectors(args.courseId);

      // Step 2: Reset sync state
      await ctx.runMutation(internal.sync.updateSyncState, {
        courseId: args.courseId,
        courseName: args.courseName,
        courseCode: args.courseCode,
        status: "idle",
        syncType: "full",
        errorMessage: undefined,
        syncedThreads: 0,
        totalThreads: 0,
      });

      // Step 3: Start fresh full sync workflow
      const workflowId: string = await workflow.start(
        ctx,
        internal.sync.courseSyncWorkflow,
        {
          courseId: args.courseId,
          courseName: args.courseName,
          courseCode: args.courseCode,
          syncType: "full",
          forceFullSync: true,
          edToken: args.edToken,
        }
      );

      // Step 4: Update sync state with new workflow
      await ctx.runMutation(internal.sync.updateSyncState, {
        courseId: args.courseId,
        courseName: args.courseName,
        courseCode: args.courseCode,
        status: "syncing",
        syncType: "full",
        workflowId,
        lastSyncAt: Date.now(),
        errorMessage: undefined,
      });

      return {
        success: true,
        message: `Started full resync for course ${args.courseId}`,
        workflowId
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to start full resync"
      };
    }
  },
});

// Internal action for health check (used by query)
export const performHealthCheck = internalAction({
  args: {
    edToken: v.string(),
  },
  handler: async (ctx, args): Promise<{
    isHealthy: boolean;
    message: string;
    coursesCount?: number;
  }> => {
    try {
      if (!args.edToken || args.edToken.trim() === "") {
        return {
          isHealthy: false,
          message: "ED token is required",
        };
      }

      const vectorConfig = createVectorConfig();

      const client = new EdClient(args.edToken, "eu", vectorConfig);

      // Add timeout to prevent hanging on invalid tokens
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Health check timeout - invalid token or network issue")), HEALTH_CHECK_TIMEOUT_MS);
      });

      const userData = await Promise.race([
        client.getUserCourses(),
        timeoutPromise
      ]) as ParsedUserData;

      return {
        isHealthy: true,
        message: "ED connection is healthy",
        coursesCount: userData.courses.length,
      };
    } catch (error) {
      return {
        isHealthy: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});

// Health check action (server-side)
export const getHealthStatus = action({
  args: {
    edToken: v.string(),
  },
  handler: async (ctx, args): Promise<{
    isHealthy: boolean;
    message: string;
    coursesCount?: number;
  }> => {
    if (!args.edToken || args.edToken.trim() === "") {
      return {
        isHealthy: false,
        message: "ED token not configured",
        coursesCount: undefined,
      };
    }

    // Use internal action for the actual health check
    return await ctx.runAction(internal.sync.performHealthCheck, {
      edToken: args.edToken,
    });
  },
});


// Query to get sync state for a course
export const getCourseSyncState = query({
  args: { courseId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("courseSyncStates")
      .withIndex("by_course_id", (q) => q.eq("courseId", args.courseId))
      .first();
  },
});

// Query to get all sync states
export const getAllSyncStates = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("courseSyncStates").collect();
  },
});

// Mutation to update sync state
export const updateSyncState = internalMutation({
  args: {
    courseId: v.number(),
    courseName: v.optional(v.string()),
    courseCode: v.optional(v.string()),
    status: v.union(
      v.literal("idle"),
      v.literal("syncing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    lastSyncAt: v.optional(v.number()),
    lastSuccessfulSyncAt: v.optional(v.number()),
    nextScheduledSync: v.optional(v.number()),
    totalThreads: v.optional(v.number()),
    syncedThreads: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    syncType: v.union(v.literal("full"), v.literal("delta")),
    workflowId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("courseSyncStates")
      .withIndex("by_course_id", (q) => q.eq("courseId", args.courseId))
      .first();

    if (existing) {
      // Smart update logic for lastSyncAt and errorMessage
      const updates: Partial<typeof args> = { ...args };

      // Only update lastSyncAt if not in error state, or if explicitly provided
      if (args.status === "failed" && args.lastSyncAt === undefined) {
        updates.lastSyncAt = undefined; // Keep existing lastSyncAt on error
      }

      // Clear error message on successful sync
      if (args.status === "completed" || args.status === "syncing") {
        updates.errorMessage = undefined;
      }

      // Preserve existing lastSuccessfulSyncAt if not provided and not successful
      if (args.lastSuccessfulSyncAt === undefined && args.status !== "completed") {
        updates.lastSuccessfulSyncAt = existing.lastSuccessfulSyncAt;
      }

      return await ctx.db.patch(existing._id, {
        ...updates,
        lastSyncAt: updates.lastSyncAt ?? existing.lastSyncAt,
      });
    }

    return await ctx.db.insert("courseSyncStates", {
      courseId: args.courseId,
      courseName: args.courseName ?? `Course ${args.courseId}`,
      courseCode: args.courseCode ?? "",
      status: args.status,
      lastSyncAt: args.lastSyncAt,
      lastSuccessfulSyncAt: args.lastSuccessfulSyncAt,
      nextScheduledSync: args.nextScheduledSync,
      totalThreads: args.totalThreads,
      syncedThreads: args.syncedThreads,
      errorMessage: args.errorMessage,
      syncType: args.syncType,
      workflowId: args.workflowId,
    });
  },
});

// Internal action to perform the actual sync
export const performCourseSync = internalAction({
  args: {
    courseId: v.number(),
    courseName: v.string(),
    courseCode: v.string(),
    syncType: v.union(v.literal("full"), v.literal("delta")),
    forceFullSync: v.optional(v.boolean()),
    edToken: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.edToken) {
      throw new Error("ED token is required");
    }

    const vectorConfig = createVectorConfig();

    const client = new EdClient(args.edToken, "eu", vectorConfig);

    try {
      // Quick validation of ED token before starting sync
      try {
        await client.getUserCourses();
      } catch (tokenError) {
        throw new Error(`Invalid ED token: ${tokenError instanceof Error ? tokenError.message : 'Authentication failed'}`);
      }

      // Update state to syncing
      await ctx.runMutation(internal.sync.updateSyncState, {
        courseId: args.courseId,
        courseName: args.courseName,
        courseCode: args.courseCode,
        status: "syncing",
        syncType: args.syncType,
        lastSyncAt: Date.now(),
        errorMessage: undefined,
      });

      // Get current sync state to determine sync strategy
      const currentState = await ctx.runQuery(api.sync.getCourseSyncState, {
        courseId: args.courseId,
      });

      // Perform the sync based on type
      let syncResult: { upserted: number; deleted: number; errors: string[] };
      if (args.syncType === "full" || args.forceFullSync) {
        // Full sync - get entire course from beginning to end
        syncResult = await client.syncCourseVectors(args.courseId, {
          forceFullSync: true,
        });
      } else {
        // Delta sync - only if we have a last successful sync date
        if (currentState?.lastSuccessfulSyncAt) {
          const sinceDate = new Date(currentState.lastSuccessfulSyncAt);
          syncResult = await client.syncCourseVectors(args.courseId, {
            sinceDate,
          });
        } else {
          // No previous successful sync - fall back to full sync
          syncResult = await client.syncCourseVectors(args.courseId, {
            forceFullSync: true,
          });
        }
      }

      // Update state to completed
      await ctx.runMutation(internal.sync.updateSyncState, {
        courseId: args.courseId,
        courseName: args.courseName,
        courseCode: args.courseCode,
        status: "completed",
        syncType: args.syncType,
        lastSuccessfulSyncAt: Date.now(),
        syncedThreads: syncResult.upserted,
        errorMessage: syncResult.errors.length > 0 ? syncResult.errors.join("; ") : undefined,
      });

      return {
        success: true,
        upserted: syncResult.upserted,
        errors: syncResult.errors,
      };
    } catch (error) {
      // Update state to failed
      await ctx.runMutation(internal.sync.updateSyncState, {
        courseId: args.courseId,
        courseName: args.courseName,
        courseCode: args.courseCode,
        status: "failed",
        syncType: args.syncType,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  },
});

// Workflow definition for course sync
export const courseSyncWorkflow = workflow.define({
  args: {
    courseId: v.number(),
    courseName: v.string(),
    courseCode: v.string(),
    syncType: v.union(v.literal("full"), v.literal("delta")),
    forceFullSync: v.optional(v.boolean()),
    edToken: v.string(),
  },
  handler: async (step, args): Promise<{ success: boolean; upserted: number; errors: string[] }> => {
    // Step 1: Perform the sync
    const syncResult = await step.runAction(
      internal.sync.performCourseSync,
      {
        courseId: args.courseId,
        courseName: args.courseName,
        courseCode: args.courseCode,
        syncType: args.syncType,
        forceFullSync: args.forceFullSync,
        edToken: args.edToken,
      }
    );

    return syncResult;
  },
});

// Internal action to get user courses data
export const getUserCoursesData = internalAction({
  args: {
    edToken: v.string(),
  },
  handler: async (ctx, args): Promise<ParsedUserData> => {
    if (!args.edToken) {
      throw new Error("ED token is required");
    }

    const vectorConfig = createVectorConfig();

    const client = new EdClient(args.edToken, "eu", vectorConfig);
    return await client.getUserCourses();
  },
});

// Public action to start sync for all courses
export const syncAllActiveCourses = action({
  args: {
    syncType: v.union(v.literal("full"), v.literal("delta")),
    forceFullSync: v.optional(v.boolean()),
    edToken: v.string(),
  },
  handler: async (ctx, args): Promise<{
    totalCourses: number;
    startedSyncs: number;
    workflowIds: string[];
  }> => {
    // Validate ED token early to fail fast
    if (!args.edToken || args.edToken.trim() === "") {
      throw new Error("ED token is required and cannot be empty");
    }

    // Get user courses data (this will fail fast if token is invalid)
    let userData: ParsedUserData;
    try {
      userData = await ctx.runAction(internal.sync.getUserCoursesData, {
        edToken: args.edToken,
      });
    } catch (error) {
      throw new Error(`Failed to validate ED token: ${error instanceof Error ? error.message : 'Authentication failed'}`);
    }

    const activeCourses = userData.courses.filter(c => c.course.status === 'active');
    const workflowIds: string[] = [];

    for (const courseData of activeCourses) {
      try {
        // Check if there's already a sync running for this course
        const existingState = await ctx.runQuery(api.sync.getCourseSyncState, {
          courseId: courseData.course.id,
        });

        if (existingState && existingState.status === "syncing") {
          console.log(`Sync already in progress for course ${courseData.course.id}, skipping`);
          continue;
        }

        // Start the workflow
        const workflowId = await workflow.start(
          ctx,
          internal.sync.courseSyncWorkflow,
          {
            courseId: courseData.course.id,
            courseName: courseData.course.name,
            courseCode: courseData.course.code,
            syncType: args.syncType,
            forceFullSync: args.forceFullSync,
            edToken: args.edToken,
          }
        );

        // Update the sync state with workflow ID
        await ctx.runMutation(internal.sync.updateSyncState, {
          courseId: courseData.course.id,
          courseName: courseData.course.name,
          courseCode: courseData.course.code,
          status: "syncing",
          syncType: args.syncType,
          workflowId,
          lastSyncAt: Date.now(),
        });

        workflowIds.push(workflowId);
      } catch (error) {
        console.error(`Failed to start sync for course ${courseData.course.id}:`, error);
      }
    }

    return {
      totalCourses: activeCourses.length,
      startedSyncs: workflowIds.length,
      workflowIds,
    };
  },
});

// Public mutation to start a single course sync
export const startCourseSync = mutation({
  args: {
    courseId: v.number(),
    courseName: v.string(),
    courseCode: v.string(),
    syncType: v.union(v.literal("full"), v.literal("delta")),
    forceFullSync: v.optional(v.boolean()),
    edToken: v.string(),
  },
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    // Check if there's already a sync running for this course
    const existingState = await ctx.db
      .query("courseSyncStates")
      .withIndex("by_course_id", (q) => q.eq("courseId", args.courseId))
      .first();

    if (existingState && existingState.status === "syncing") {
      throw new Error(`Sync already in progress for course ${args.courseId}`);
    }

    // Start the workflow
    const workflowId = await workflow.start(
      ctx,
      internal.sync.courseSyncWorkflow,
      {
        courseId: args.courseId,
        courseName: args.courseName,
        courseCode: args.courseCode,
        syncType: args.syncType,
        forceFullSync: args.forceFullSync,
        edToken: args.edToken,
      }
    );

    // Update the sync state with workflow ID
    await ctx.runMutation(internal.sync.updateSyncState, {
      courseId: args.courseId,
      courseName: args.courseName,
      courseCode: args.courseCode,
      status: "syncing",
      syncType: args.syncType,
      workflowId,
      lastSyncAt: Date.now(),
    });

    return { workflowId };
  },
});