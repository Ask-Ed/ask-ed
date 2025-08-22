import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    // Fields are optional
  }),
  courseSyncStates: defineTable({
    courseId: v.number(),
    courseName: v.string(),
    courseCode: v.string(),
    status: v.union(
      v.literal("idle"),
      v.literal("syncing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    lastSyncAt: v.optional(v.number()),
    lastSuccessfulSyncAt: v.optional(v.number()),
    nextScheduledSync: v.optional(v.number()),
    totalThreads: v.optional(v.number()),
    syncedThreads: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    syncType: v.union(v.literal("full"), v.literal("delta")),
    workflowId: v.optional(v.string()),
  }).index("by_course_id", ["courseId"]),
});
