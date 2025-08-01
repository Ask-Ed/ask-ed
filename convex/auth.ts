import {
  BetterAuth,
  type AuthFunctions,
  type PublicAuthFunctions,
} from "@convex-dev/better-auth";
import { api, components, internal } from "./_generated/api";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { DataModel } from "./_generated/dataModel";

// Typesafe way to pass Convex functions defined in this file
const authFunctions: AuthFunctions = internal.auth;
const publicAuthFunctions: PublicAuthFunctions = api.auth;

// Initialize the component
export const betterAuthComponent = new BetterAuth(
  components.betterAuth,
  {
    authFunctions,
    publicAuthFunctions,
  }
);

// These are required named exports
export const {
  createUser,
  updateUser,
  deleteUser,
  createSession,
  isAuthenticated,
} =
  betterAuthComponent.createAuthFunctions<DataModel>({
    // Return the Better Auth user ID (no separate user record needed)
    onCreateUser: async (ctx, user) => {
      // Better Auth manages the user, we just return the user ID
      return user.email;
    },

    // No cleanup needed since we don't store separate user records
    onDeleteUser: async (ctx, userId) => {
      // Could clean up user-related documents here if needed
      // For now, we'll leave documents as they are
    },
  });

// Function for getting the current user (from Better Auth only)
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    // Get user data from Better Auth - email, name, image, etc.
    const userMetadata = await betterAuthComponent.getAuthUser(ctx);
    if (!userMetadata) {
      return null;
    }

    // Return the Better Auth user data directly
    return userMetadata;
  },
});

// Note: User profile updates are handled client-side through Better Auth
// No server-side mutation needed since Better Auth manages user data directly