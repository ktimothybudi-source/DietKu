import {
  MEAL_ANALYSIS_MAX_TOKENS,
  MEAL_ANALYSIS_MAX_TOKENS_COMPACT,
  buildMealAnalysisPrompt,
  extractOpenAIContent,
  systemPromptForMeal,
  validateMealAnalysisFromContent,
  type OpenAIChatResponse,
} from "../../utils/mealAnalysisCore";
import type { MealAnalysis } from "../../types/nutrition";

const OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions";

export type MealAnalysisAttemptLog = {
  attempt: number;
  compact: boolean;
  finishReason: string | null;
  contentLength: number;
  itemCount?: number;
  ok: boolean;
};

async function callOpenAI(apiKey: string, payload: unknown): Promise<OpenAIChatResponse> {
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
  return response.json() as Promise<OpenAIChatResponse>;
}

export async function analyzeMealImageWithOpenAI(options: {
  apiKey: string;
  dataUrl: string;
  language: "id" | "en";
}): Promise<{ analysis: MealAnalysis; logs: MealAnalysisAttemptLog[] }> {
  const { apiKey, dataUrl, language } = options;
  const attempts: Array<{ compact: boolean; maxTokens: number }> = [
    { compact: false, maxTokens: MEAL_ANALYSIS_MAX_TOKENS },
    { compact: true, maxTokens: MEAL_ANALYSIS_MAX_TOKENS_COMPACT },
  ];

  const logs: MealAnalysisAttemptLog[] = [];
  let lastError = "MEAL_ANALYSIS_PARSE_FAILED";

  for (let i = 0; i < attempts.length; i += 1) {
    const { compact, maxTokens } = attempts[i];
    const prompt = buildMealAnalysisPrompt(language, compact);

    const openAIData = await callOpenAI(apiKey, {
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPromptForMeal(language) },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "low" },
            },
          ],
        },
      ],
    });

    const { content, refusal, finishReason } = extractOpenAIContent(openAIData);

    if (refusal) {
      throw new Error(refusal);
    }

    const log: MealAnalysisAttemptLog = {
      attempt: i + 1,
      compact,
      finishReason,
      contentLength: content?.length ?? 0,
      ok: false,
    };

    if (!content?.trim() || finishReason === "length") {
      lastError = finishReason === "length" ? "MEAL_ANALYSIS_TRUNCATED" : "MEAL_ANALYSIS_PARSE_FAILED";
      logs.push(log);
      continue;
    }

    const validated = validateMealAnalysisFromContent(content, language);
    if (validated.ok) {
      log.ok = true;
      log.itemCount = validated.analysis.items.length;
      logs.push(log);
      return { analysis: validated.analysis, logs };
    }

    lastError = validated.error;
    logs.push(log);
  }

  const err = new Error(lastError);
  (err as Error & { logs?: MealAnalysisAttemptLog[] }).logs = logs;
  throw err;
}
