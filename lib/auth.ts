import { convexAdapter } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import type { GenericCtx } from "../convex/_generated/server";
import { betterAuthComponent } from "../convex/auth";

// Get environment variables with fallbacks
const siteUrl = process.env.SITE_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

console.log("Better Auth Config:", {
  siteUrl,
  hasClientId: !!googleClientId,
  hasClientSecret: !!googleClientSecret,
  clientIdLength: googleClientId?.length,
});

export const createAuth = (ctx: GenericCtx) =>
  // Configure your Better Auth instance here
  betterAuth({
    // All auth requests will be proxied through your next.js server
    baseURL: siteUrl,
    database: convexAdapter(ctx, betterAuthComponent),

    // Add trusted origins for localhost and Convex
    trustedOrigins: [
      "http://localhost:3000",
      "https://neighborly-bass-443.convex.site",
      "https://perceptive-gerbil-897.convex.site",
      siteUrl,
    ],

    // Disable email/password auth to only use Google
    emailAndPassword: {
      enabled: false,
    },

    // Configure Google OAuth provider
    socialProviders: {
      google: {
        clientId: googleClientId!,
        clientSecret: googleClientSecret!,
        redirectURI: `${siteUrl}/api/auth/callback/google`,
      },
    },

    plugins: [
      // The Convex plugin is required
      convex(),
    ],
  });