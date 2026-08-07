import * as Linking from 'expo-linking';

/** HTTPS smart-link page (opens app or App/Play Store). Hosted on Vercel affiliate site. */
export const GROUP_INVITE_WEB_BASE =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_GROUP_INVITE_WEB_BASE?.replace(/\/$/, '')) ||
  'https://dietku-affiliate.vercel.app';

export function normalizeGroupInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Custom scheme for production builds.
 * Keep this path in sync with affiliate-platform /join page + +native-intent.
 */
export function buildGroupInviteAppLink(inviteCode: string): string {
  const code = normalizeGroupInviteCode(inviteCode);
  // Prefer stable production deep link (not Expo Go exp://) so web invites open the store app.
  if (code) {
    return `rork-app://browse-groups?code=${encodeURIComponent(code)}`;
  }
  return Linking.createURL('browse-groups');
}

/**
 * Shareable invite URL for WhatsApp etc.
 * Lands on the web page that opens the app or store.
 */
export function buildGroupInviteLink(inviteCode: string): string {
  const code = normalizeGroupInviteCode(inviteCode);
  if (!code) return `${GROUP_INVITE_WEB_BASE}/join`;
  return `${GROUP_INVITE_WEB_BASE}/join?code=${encodeURIComponent(code)}`;
}

/** Pull invite code from a deep-link path (native-intent / system URL). */
export function extractGroupInviteCodeFromPath(path: string): string | null {
  if (!path) return null;

  try {
    const hasScheme = path.includes('://');
    const url = new URL(hasScheme ? path : `rork-app://${path.replace(/^\//, '')}`);
    const host = (url.hostname || '').toLowerCase();
    const pathname = (url.pathname || '').toLowerCase();
    const isBrowseGroups =
      host === 'browse-groups' ||
      pathname === '/browse-groups' ||
      pathname.endsWith('/browse-groups') ||
      path.toLowerCase().includes('browse-groups');

    // HTTPS smart links: /join?code=
    const isJoinHost =
      pathname === '/join' ||
      pathname.endsWith('/join') ||
      path.toLowerCase().includes('/join');

    if (isBrowseGroups || isJoinHost) {
      const fromQuery = url.searchParams.get('code');
      if (fromQuery) {
        const code = normalizeGroupInviteCode(fromQuery);
        return code || null;
      }
    }
  } catch {
    // fall through to regex
  }

  const match = path.match(/[?&]code=([A-Za-z0-9]+)/i);
  if (!match?.[1]) return null;
  // Only accept if path looks like an invite route
  const lower = path.toLowerCase();
  if (!lower.includes('browse-groups') && !lower.includes('/join')) return null;
  return normalizeGroupInviteCode(match[1]) || null;
}
