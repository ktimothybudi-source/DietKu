/**
 * When true, all paid gates are off: no post-onboarding paywall, full feature access.
 * Flip to false when re-enabling RevenueCat subscriptions.
 *
 * Override at build time: EXPO_PUBLIC_FREE_FOR_NOW=false
 */
const envOverride = process.env.EXPO_PUBLIC_FREE_FOR_NOW?.trim().toLowerCase();

export const FREE_FOR_NOW =
  envOverride === 'false' || envOverride === '0'
    ? false
    : envOverride === 'true' || envOverride === '1'
      ? true
      : true; // default: free for all users
