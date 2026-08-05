/**
 * Push notification delivery for community food-scan activity.
 * Sends Expo push messages to group members when someone logs a meal.
 */

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { formatCommunityScanMessage } from "../constants/notificationMessages";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_KEY?.trim() ||
  "";

const ExpoPushUrl = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

type FoodScannedBody = {
  accessToken?: string;
  groupId?: string;
  foodName?: string;
  calories?: number;
  displayName?: string;
};

const app = new Hono();

function adminClient() {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveUserId(token: string): Promise<string | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);
  if (error || !user?.id) return null;
  return user.id;
}

async function sendExpoPush(
  messages: {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: string;
    channelId?: string;
  }[]
): Promise<{ sent: number; errors: number }> {
  if (messages.length === 0) return { sent: 0, errors: 0 };

  let sent = 0;
  let errors = 0;

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetch(ExpoPushUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        errors += chunk.length;
        console.error("[notifications] Expo push HTTP", res.status, await res.text());
        continue;
      }
      const payload = (await res.json()) as {
        data?: { status?: string; message?: string }[];
      };
      for (const ticket of payload.data || []) {
        if (ticket.status === "ok") sent += 1;
        else {
          errors += 1;
          if (ticket.message) console.warn("[notifications] ticket error:", ticket.message);
        }
      }
    } catch (err) {
      errors += chunk.length;
      console.error("[notifications] Expo push failed:", err);
    }
  }

  return { sent, errors };
}

app.get("/health", (c) =>
  c.json({
    ok: true,
    route: "/api/notifications",
    configured: {
      supabaseUrl: Boolean(supabaseUrl),
      supabaseAnonKey: Boolean(supabaseAnonKey),
      serviceRoleKey: Boolean(serviceKey),
    },
  })
);

/**
 * Notify group mates that the caller just scanned / logged food.
 * Requires SUPABASE_SERVICE_ROLE_KEY to read other users' push tokens.
 */
app.post("/food-scanned", async (c) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return c.json({ error: "Backend not configured", code: "backend_not_configured" }, 503);
  }
  if (!serviceKey) {
    return c.json(
      {
        error: "Push notifications require SUPABASE_SERVICE_ROLE_KEY on the server",
        code: "push_not_configured",
      },
      503
    );
  }

  let body: FoodScannedBody | null = null;
  try {
    body = await c.req.json();
  } catch {
    body = null;
  }

  const authHeader = c.req.header("authorization") || c.req.header("Authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const bodyToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
  const token = bearerToken || bodyToken;

  if (!token) {
    return c.json({ error: "Missing access token", code: "missing_access_token" }, 400);
  }

  const actorUserId = await resolveUserId(token);
  if (!actorUserId) {
    return c.json({ error: "Invalid or expired session", code: "invalid_or_expired_session" }, 401);
  }

  const groupId = typeof body?.groupId === "string" ? body.groupId.trim() : "";
  const foodName =
    typeof body?.foodName === "string" && body.foodName.trim()
      ? body.foodName.trim().slice(0, 120)
      : "makanan";
  const calories =
    typeof body?.calories === "number" && Number.isFinite(body.calories)
      ? Math.max(0, Math.round(body.calories))
      : 0;
  const displayName =
    typeof body?.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim().slice(0, 60)
      : "Teman grup";

  if (!groupId) {
    return c.json({ error: "groupId is required", code: "missing_group_id" }, 400);
  }

  const admin = adminClient();

  // Confirm actor is a member of the group.
  const { data: membership, error: membershipErr } = await admin
    .from("community_group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", actorUserId)
    .maybeSingle();

  if (membershipErr) {
    console.error("[notifications] membership check failed:", membershipErr.message);
    return c.json({ error: "Failed to verify group membership", code: "membership_error" }, 500);
  }
  if (!membership) {
    return c.json({ error: "Not a member of this group", code: "not_a_member" }, 403);
  }

  const { data: members, error: membersErr } = await admin
    .from("community_group_members")
    .select("user_id")
    .eq("group_id", groupId);

  if (membersErr) {
    console.error("[notifications] members fetch failed:", membersErr.message);
    return c.json({ error: "Failed to load group members", code: "members_error" }, 500);
  }

  const recipientIds = (members || [])
    .map((m: { user_id: string }) => m.user_id)
    .filter((id: string) => id && id !== actorUserId);

  if (recipientIds.length === 0) {
    return c.json({ ok: true, sent: 0, skipped: "no_other_members" });
  }

  const { data: tokens, error: tokensErr } = await admin
    .from("user_push_tokens")
    .select("expo_push_token, user_id")
    .in("user_id", recipientIds);

  if (tokensErr) {
    // Table may not exist yet — surface a clear code without crashing the app flow.
    console.error("[notifications] tokens fetch failed:", tokensErr.message);
    return c.json(
      {
        ok: false,
        sent: 0,
        error: tokensErr.message,
        code: tokensErr.message.includes("user_push_tokens")
          ? "push_table_missing"
          : "tokens_error",
      },
      tokensErr.message.includes("user_push_tokens") ? 503 : 500
    );
  }

  const uniqueTokens = Array.from(
    new Set(
      (tokens || [])
        .map((row: { expo_push_token: string }) => row.expo_push_token)
        .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken"))
    )
  );

  if (uniqueTokens.length === 0) {
    return c.json({ ok: true, sent: 0, skipped: "no_tokens" });
  }

  const copy = formatCommunityScanMessage(displayName, foodName, calories);
  const messages = uniqueTokens.map((to) => ({
    to,
    title: copy.title,
    body: copy.body,
    sound: "default" as const,
    channelId: "dietku-reminders",
    data: {
      type: "community_scan",
      groupId,
      actorUserId,
    },
  }));

  const result = await sendExpoPush(messages);
  return c.json({ ok: true, sent: result.sent, errors: result.errors });
});

export default app;
