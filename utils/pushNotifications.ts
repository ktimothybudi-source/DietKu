/**
 * Client helpers for DietKu push notifications (Expo + backend).
 */

function getApiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
    'https://dietku.onrender.com'
  );
}

export type FoodScannedNotifyPayload = {
  accessToken: string;
  groupId: string;
  foodName: string;
  calories: number;
  displayName: string;
};

/** Tell the server to push “X baru scan makanan” to group members. Fire-and-forget safe. */
export async function notifyGroupFoodScanned(
  payload: FoodScannedNotifyPayload
): Promise<void> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/notifications/food-scanned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.accessToken}`,
      },
      body: JSON.stringify({
        groupId: payload.groupId,
        foodName: payload.foodName,
        calories: payload.calories,
        displayName: payload.displayName,
        accessToken: payload.accessToken,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[notifications] food-scanned failed', res.status, text);
    }
  } catch (error) {
    console.warn('[notifications] food-scanned network error', error);
  }
}
