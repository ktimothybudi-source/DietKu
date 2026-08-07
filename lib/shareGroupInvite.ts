import { Platform, Share } from 'react-native';
import {
  buildGroupInviteLink,
  normalizeGroupInviteCode,
} from '@/lib/groupInviteLink';

type ShareCopy = {
  message: string;
  copiedTitle: string;
  copiedBody: string;
  fallbackTitle: string;
};

export function buildGroupInviteShareCopy(
  groupName: string,
  inviteCode: string,
  l: (idText: string, enText: string) => string
): ShareCopy {
  const code = normalizeGroupInviteCode(inviteCode);
  const link = buildGroupInviteLink(code);
  const message = l(
    `Gabung ke grup "${groupName}" di DietKu!\n\n${link}\n\nKalau belum punya app, link akan buka App Store / Play Store. Kode: ${code}`,
    `Join the group "${groupName}" on DietKu!\n\n${link}\n\nIf you don't have the app, the link opens the App Store / Play Store. Code: ${code}`
  );
  return {
    message,
    copiedTitle: l('Link Disalin!', 'Link Copied!'),
    copiedBody: l(
      'Link undangan sudah disalin. Teman bisa tap untuk buka app atau unduh DietKu, lalu gabung grup.',
      'Invite link copied. Friends can tap it to open the app or install DietKu, then join the group.'
    ),
    fallbackTitle: l('Undangan Grup', 'Group Invite'),
  };
}

export async function shareGroupInvite(params: {
  groupName: string;
  inviteCode: string;
  l: (idText: string, enText: string) => string;
  copyToClipboard?: (text: string) => Promise<boolean>;
}): Promise<'shared' | 'copied' | 'cancelled'> {
  const code = normalizeGroupInviteCode(params.inviteCode);
  const link = buildGroupInviteLink(code);
  const copy = buildGroupInviteShareCopy(params.groupName, code, params.l);

  if (Platform.OS === 'web') {
    if (params.copyToClipboard) {
      const ok = await params.copyToClipboard(copy.message);
      if (ok) return 'copied';
    }
    throw new Error(copy.message);
  }

  try {
    // Message-only is more reliable for WhatsApp (keeps the https link tappable).
    const result = await Share.share({
      message: copy.message,
      url: Platform.OS === 'ios' ? link : undefined,
    });
    if (result.action === Share.sharedAction) return 'shared';
    return 'cancelled';
  } catch {
    return 'cancelled';
  }
}
