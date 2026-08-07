import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'dietku_pending_group_invite_code';

export async function stashPendingGroupInviteCode(raw: string): Promise<void> {
  const t = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!t) return;
  await AsyncStorage.setItem(STORAGE_KEY, t);
}

/** Returns stored code and clears it (one-shot after successful join). */
export async function consumePendingGroupInviteCode(): Promise<string | null> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  if (v) await AsyncStorage.removeItem(STORAGE_KEY);
  return v?.trim().toUpperCase() || null;
}

export async function peekPendingGroupInviteCode(): Promise<string | null> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return v?.trim().toUpperCase() || null;
}
