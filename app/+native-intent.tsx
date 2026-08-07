import { stashPendingGroupInviteCode } from '@/lib/pendingGroupInviteCode';
import { extractGroupInviteCodeFromPath } from '@/lib/groupInviteLink';

/**
 * Rewrite inbound system URLs before Expo Router handles them.
 * Group invite links open the join screen; everything else still lands on entry routing.
 */
export async function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): Promise<string> {
  const code = extractGroupInviteCodeFromPath(path);
  if (code) {
    try {
      await stashPendingGroupInviteCode(code);
    } catch {
      // Non-fatal: query param still carries the code.
    }
    return `/browse-groups?code=${encodeURIComponent(code)}`;
  }

  // Also accept raw Expo paths like "browse-groups?code=ABC" without extra parsing edge cases
  try {
    const trimmed = (path || '').replace(/^\/+/, '');
    if (trimmed.toLowerCase().startsWith('browse-groups')) {
      const qIndex = trimmed.indexOf('?');
      const query = qIndex >= 0 ? trimmed.slice(qIndex + 1) : '';
      const params = new URLSearchParams(query);
      const raw = params.get('code');
      if (raw) {
        const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (c) {
          try {
            await stashPendingGroupInviteCode(c);
          } catch {
            // ignore
          }
          return `/browse-groups?code=${encodeURIComponent(c)}`;
        }
      }
      return '/browse-groups';
    }
  } catch {
    // fall through
  }

  return '/';
}
