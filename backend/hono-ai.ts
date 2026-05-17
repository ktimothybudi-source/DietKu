import { Hono } from "hono";
import { z } from "zod";
import { analyzeMealImageWithOpenAI } from "./lib/meal-analysis-service";
import { buildLegacyOpenAIChatResponse } from "../utils/mealAnalysisCore";
import { checkRateLimit } from "./lib/rate-limit";
import { supabase } from "./lib/supabase";

const OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions";
const MAX_IMAGE_BASE64_LENGTH = 2_000_000; // ~2MB payload ceiling

const mealAnalysisInputSchema = z.object({
  base64Image: z.string().min(1),
  userId: z.string().uuid().optional(),
  language: z.enum(['id', 'en']).optional(),
});

const exerciseEstimateInputSchema = z.object({
  description: z.string().min(1).max(500),
  userId: z.string().uuid().optional(),
});

const translateInputSchema = z.object({
  query: z.string().min(1).max(200),
});

const rankInputSchema = z.object({
  query: z.string().min(1).max(200),
  options: z.array(z.string().min(1)).min(1).max(25),
});

const mealQuotaInputSchema = z.object({
  userId: z.string().uuid().optional(),
  consume: z.boolean().optional(),
});

const subscriptionSyncInputSchema = z.object({
  userId: z.string().uuid(),
  isPremium: z.boolean(),
  source: z.string().max(50).optional(),
  accessToken: z.string().min(20),
});

const app = new Hono();

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY");
  return key;
}

function openAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function getRequesterId(c: any, userId?: string): string {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("cf-connecting-ip") ||
    "unknown-ip";
  return userId || `ip:${ip}`;
}

const DAILY_SCAN_LIMIT = 3;
const DAILY_SCAN_WINDOW = "24 hours";

type QuotaResult = {
  allowed: boolean;
  remaining: number;
  resetInSec: number;
  unlimited: boolean;
};

async function isMealScanDailyUnlimitedUser(userId: string | undefined): Promise<boolean> {
  if (!userId?.trim()) return false;

  const { data, error } = await supabase.rpc("is_ai_scan_quota_bypass", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`Failed to check scan bypass: ${error.message}`);
  }

  return Boolean(data);
}

async function getDailyScanQuota(
  requestId: string,
  userId: string | undefined,
  consume: boolean
): Promise<QuotaResult> {
  const unlimited = await isMealScanDailyUnlimitedUser(userId);
  if (unlimited) {
    return {
      allowed: true,
      remaining: 999_999,
      resetInSec: 0,
      unlimited: true,
    };
  }

  const rpcName = consume ? "consume_ai_scan_quota" : "peek_ai_scan_quota";
  const { data, error } = await supabase.rpc(rpcName, {
    p_requester_id: requestId,
    p_user_id: userId ?? null,
    p_limit: DAILY_SCAN_LIMIT,
    p_window: DAILY_SCAN_WINDOW,
  });

  if (error) {
    throw new Error(`Failed to read scan quota: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Failed to read scan quota: empty response");
  }

  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining ?? 0),
    resetInSec: Number(row.reset_in_sec ?? 0),
    unlimited: false,
  };
}

async function callOpenAI(payload: unknown) {
  const apiKey = getOpenAIKey();
  const response = await fetch(OPENAI_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }
  return response.json();
}

app.post("/meal-analysis", async (c) => {
  try {
    if (!openAIConfigured()) {
      return c.json(
        {
          error: "Server misconfiguration: OPENAI_API_KEY is not set on the host (e.g. Render environment variables).",
          code: "OPENAI_NOT_CONFIGURED",
        },
        503
      );
    }

    const input = mealAnalysisInputSchema.parse(await c.req.json());
    const requestId = getRequesterId(c, input.userId);

    const hourly = checkRateLimit({
      key: `meal-hour:${requestId}`,
      maxRequests: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!hourly.allowed) {
      c.header("Retry-After", `${hourly.retryAfterSec}`);
      return c.json({ error: "Rate limit exceeded (hourly)" }, 429);
    }

    const burst = checkRateLimit({
      key: `meal-burst:${requestId}`,
      maxRequests: 5,
      windowMs: 60 * 1000,
    });
    if (!burst.allowed) {
      c.header("Retry-After", `${burst.retryAfterSec}`);
      return c.json({ error: "Rate limit exceeded (burst)" }, 429);
    }

    const peek = await getDailyScanQuota(requestId, input.userId, false);

    if (!peek.allowed) {
      c.header("Retry-After", `${Math.max(1, peek.resetInSec)}`);
      return c.json(
        {
          error: "Daily scan limit reached",
          code: "DAILY_SCAN_LIMIT",
          quota: {
            unlimited: false,
            limit: DAILY_SCAN_LIMIT,
            remaining: 0,
            resetInSec: peek.resetInSec,
          },
        },
        429
      );
    }

    const sanitized = input.base64Image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    if (sanitized.length > MAX_IMAGE_BASE64_LENGTH) {
      return c.json({ error: "Image payload too large", code: "IMAGE_TOO_LARGE" }, 413);
    }
    const dataUrl = `data:image/jpeg;base64,${sanitized}`;

    const language = input.language === "en" ? "en" : "id";
    const apiKey = getOpenAIKey();

    const { analysis, rawContent, logs } = await analyzeMealImageWithOpenAI({
      apiKey,
      dataUrl,
      language,
    });

    const lastLog = logs[logs.length - 1];
    console.info(
      `[meal-analysis] ok items=${analysis.items.length} attempt=${lastLog?.attempt ?? "?"} finish=${lastLog?.finishReason ?? "?"} len=${lastLog?.contentLength ?? 0}`
    );

    const daily = await getDailyScanQuota(requestId, input.userId, true);
    const legacy = buildLegacyOpenAIChatResponse(rawContent);

    return c.json({
      ...legacy,
      analysis,
      quota: {
        unlimited: daily.unlimited,
        limit: DAILY_SCAN_LIMIT,
        remaining: daily.remaining,
        resetInSec: daily.resetInSec,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const logs = (error as Error & { logs?: unknown }).logs;
    if (logs) {
      console.error("[meal-analysis] failed", message, JSON.stringify(logs));
    } else {
      console.error("[meal-analysis]", message);
    }

    const code =
      message === "MEAL_ANALYSIS_PARSE_FAILED" ||
      message === "MEAL_ANALYSIS_VALIDATION_FAILED" ||
      message === "MEAL_ANALYSIS_TRUNCATED"
        ? message
        : "MEAL_ANALYSIS_FAILED";

    const status = code === "MEAL_ANALYSIS_FAILED" ? 500 : 422;
    return c.json({ error: message, code }, status);
  }
});

app.post("/meal-analysis-quota", async (c) => {
  try {
    const input = mealQuotaInputSchema.parse(await c.req.json());
    const requestId = getRequesterId(c, input.userId);
    const result = await getDailyScanQuota(requestId, input.userId, Boolean(input.consume));
    return c.json({
      allowed: result.allowed,
      unlimited: result.unlimited,
      limit: DAILY_SCAN_LIMIT,
      remaining: result.remaining,
      resetInSec: result.resetInSec,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

app.post("/subscription-sync", async (c) => {
  try {
    const input = subscriptionSyncInputSchema.parse(await c.req.json());
    const { data: userData, error: userError } = await supabase.auth.getUser(input.accessToken);
    if (userError || !userData.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (userData.user.id !== input.userId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const note = input.isPremium
      ? `premium:${input.source ?? "unknown"}`
      : "premium_disabled";

    const { error } = await supabase.from("ai_scan_quota_bypass").upsert(
      {
        user_id: input.userId,
        is_active: input.isPremium,
        note,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      throw new Error(`Failed to sync subscription: ${error.message}`);
    }

    // Affiliate commissions: use RevenueCat webhook only (avoids marking paid on free trial).
    return c.json({ ok: true, unlimited: input.isPremium });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

app.post("/exercise-estimate", async (c) => {
  try {
    const input = exerciseEstimateInputSchema.parse(await c.req.json());
    const requestId = getRequesterId(c, input.userId);

    const limit = checkRateLimit({
      key: `exercise-hour:${requestId}`,
      maxRequests: 60,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.allowed) {
      c.header("Retry-After", `${limit.retryAfterSec}`);
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    const openAIData = await callOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            'You estimate calories burned from exercise descriptions. Return ONLY a JSON object with "calories" (number) and "name" (short exercise name in Indonesian).',
        },
        { role: "user", content: `Estimate calories burned: "${input.description.trim()}"` },
      ],
      max_tokens: 100,
    });

    return c.json(openAIData);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

app.post("/translate", async (c) => {
  try {
    const input = translateInputSchema.parse(await c.req.json());
    const openAIData = await callOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are a food translator. Translate Indonesian food names to English. Only return the English translation, nothing else.",
        },
        { role: "user", content: input.query },
      ],
      max_tokens: 40,
    });
    return c.json(openAIData);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function inferAffiliatePlanAndAmount(productId?: string, price?: number) {
  const id = (productId ?? "").toLowerCase();
  const isMonthly = id.includes("month") || id.includes("bulanan");
  const plan = isMonthly ? "bulanan" : "tahunan";
  const amount = price != null && price > 0 ? price : isMonthly ? 39000 : 129000;
  return { plan, amount };
}

app.post("/webhooks/revenuecat", async (c) => {
  try {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();
    if (secret) {
      const auth = c.req.header("authorization") ?? "";
      if (auth !== `Bearer ${secret}`) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }

    const body = (await c.req.json()) as { event?: Record<string, unknown> };
    const event = body?.event;
    if (!event || typeof event !== "object") {
      return c.json({ error: "Invalid payload" }, 400);
    }

    const type = String(event.type ?? "");
    const appUserId = String(event.app_user_id ?? "");
    if (!appUserId) {
      return c.json({ ok: true, skipped: "no_app_user_id" });
    }

    const productId = String(event.product_id ?? "");
    const periodType = String(event.period_type ?? "").toUpperCase();
    const price = Number(event.price_in_purchased_currency ?? event.price ?? 0);

    if (type === "EXPIRATION" || type === "CANCELLATION") {
      if (periodType === "TRIAL" || price === 0) {
        await supabase.rpc("mark_affiliate_referral_expired", {
          p_redeemer_user_id: appUserId,
        });
      }
      return c.json({ ok: true, handled: type });
    }

    // Trial start: INITIAL_PURCHASE + TRIAL → skip (affiliate already has trial_active from app redeem).
    if (type === "INITIAL_PURCHASE" && periodType === "TRIAL") {
      return c.json({ ok: true, skipped: "trial_start" });
    }

    const isPaidEvent =
      type === "RENEWAL" ||
      (type === "INITIAL_PURCHASE" && price > 0) ||
      type === "NON_RENEWING_PURCHASE";

    if (isPaidEvent) {
      const { plan, amount } = inferAffiliatePlanAndAmount(productId, price);
      const { data, error } = await supabase.rpc("mark_affiliate_referral_paid", {
        p_redeemer_user_id: appUserId,
        p_subscription_plan: plan,
        p_amount_idr: amount,
      });
      if (error) {
        console.warn("[revenuecat-webhook] mark paid:", error.message);
      }
      return c.json({ ok: true, affiliate: data });
    }

    return c.json({ ok: true, skipped: type });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

app.post("/rank-usda", async (c) => {
  try {
    const input = rankInputSchema.parse(await c.req.json());
    const list = input.options.map((item, index) => `${index + 1}. ${item}`).join("\n");
    const openAIData = await callOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            'Given a food query and candidate foods, rank by relevance. Return ONLY comma-separated indices like "3,1,2".',
        },
        {
          role: "user",
          content: `Query: "${input.query}"\nFoods:\n${list}\nReturn ranking indices only.`,
        },
      ],
      max_tokens: 40,
    });
    return c.json(openAIData);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

export default app;
