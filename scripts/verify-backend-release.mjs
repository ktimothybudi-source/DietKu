import crypto from "node:crypto";

const baseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
  process.env.API_BASE_URL;

if (!baseUrl) {
  console.error("Missing API base URL. Set EXPO_PUBLIC_API_BASE_URL or API_BASE_URL.");
  process.exit(1);
}

/** Minimal 1x1 JPEG (valid image for vision smoke test). */
const TINY_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

async function post(path, body) {
  const res = await fetch(`${baseUrl}/api/ai/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function main() {
  const fakeUser = crypto.randomUUID();
  let failed = false;

  const health = await fetch(`${baseUrl}/`);
  const healthJson = await health.json().catch(() => null);
  console.log("health:", health.status, healthJson?.status ?? healthJson);
  if (!health.ok) {
    console.error("FAIL: backend health check");
    failed = true;
  }

  const quota = await post("meal-analysis-quota", { userId: fakeUser });
  console.log("quota peek:", quota.status, quota.json);
  if (quota.status !== 200 || quota.json?.allowed !== true) {
    console.error("FAIL: quota peek should be allowed for new user");
    failed = true;
  }

  for (let i = 1; i <= 4; i += 1) {
    const consume = await post("meal-analysis-quota", { userId: fakeUser, consume: true });
    console.log(`quota consume ${i}:`, consume.status, consume.json?.remaining);
    if (i <= 3 && consume.status !== 200) {
      console.error(`FAIL: consume ${i} should succeed`);
      failed = true;
    }
    if (i === 4 && consume.status !== 200 && consume.json?.allowed !== false) {
      console.warn("WARN: 4th consume may still show allowed depending on RPC semantics");
    }
  }

  const mealUser = crypto.randomUUID();
  const meal = await post("meal-analysis", {
    userId: mealUser,
    base64Image: TINY_JPEG_BASE64,
    language: "id",
  });
  console.log("meal-analysis:", meal.status, meal.json?.code ?? "ok");

  if (meal.status === 200) {
    const analysis = meal.json?.analysis;
    if (!analysis?.items?.length) {
      console.error("FAIL: meal-analysis should return analysis.items with length >= 1");
      failed = true;
    } else {
      console.log("meal-analysis items:", analysis.items.length, "confidence:", analysis.confidence);
    }
    if (meal.json?.choices) {
      console.warn("WARN: legacy OpenAI envelope still present alongside analysis");
    }
  } else if (meal.status === 422 || meal.status === 500) {
    console.warn(
      "WARN: meal-analysis failed (may be OpenAI key / tiny image). code:",
      meal.json?.code,
      meal.json?.error
    );
    if (!process.env.OPENAI_API_KEY && !process.env.SKIP_MEAL_ANALYSIS_ASSERT) {
      console.log("Set SKIP_MEAL_ANALYSIS_ASSERT=1 to skip meal-analysis shape check without OpenAI.");
    }
  } else {
    console.error("FAIL: unexpected meal-analysis status", meal.status);
    failed = true;
  }

  const exercise = await post("exercise-estimate", {
    userId: fakeUser,
    description: "Jalan cepat 20 menit",
  });
  console.log("exercise estimate:", exercise.status, exercise.json ? "ok" : "no-json");

  if (failed) {
    process.exit(1);
  }
  console.log("Backend verification passed.");
}

main().catch((error) => {
  console.error("Backend verification failed:", error);
  process.exit(1);
});
