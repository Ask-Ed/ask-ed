// Environment configuration utility
export const env = {
  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  
  // App environment (can be different from NODE_ENV)
  appEnv: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development',
  
  // Convex configuration
  convex: {
    deployment: process.env.CONVEX_DEPLOYMENT,
    url: process.env.NEXT_PUBLIC_CONVEX_URL,
    siteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  },
  
  // Better Auth configuration
  auth: {
    secret: process.env.BETTER_AUTH_SECRET,
    url: process.env.BETTER_AUTH_URL,
    siteUrl: process.env.SITE_URL,
  },
  
  // Google OAuth configuration
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
} as const;

// Environment validation
export function validateEnvironment() {
  const missing: string[] = [];
  
  // Required environment variables
  const required = [
    'CONVEX_DEPLOYMENT',
    'NEXT_PUBLIC_CONVEX_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'SITE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ];
  
  required.forEach(key => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });
  
  if (missing.length > 0) {
    console.warn('⚠️ Missing environment variables:', missing);
    return false;
  }
  
  console.log('✅ Environment validation passed');
  return true;
}

// Environment info logging
export function logEnvironmentInfo() {
  console.log('🔧 Environment Configuration:');
  console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`  App Environment: ${env.appEnv}`);
  console.log(`  Convex Deployment: ${env.convex.deployment}`);
  console.log(`  Site URL: ${env.auth.siteUrl}`);
  console.log(`  Better Auth URL: ${env.auth.url}`);
}