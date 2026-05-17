import { z } from 'zod';
import type { MealAnalysis } from '@/types/nutrition';
import { enrichMealAnalysisMicros } from '@/utils/nutritionCalculations';

export const MEAL_ANALYSIS_MAX_TOKENS = 2400;
export const MEAL_ANALYSIS_MAX_TOKENS_COMPACT = 1200;

const RANGE_KEYS = [
  'caloriesMin',
  'caloriesMax',
  'proteinMin',
  'proteinMax',
  'carbsMin',
  'carbsMax',
  'fatMin',
  'fatMax',
  'sugarMin',
  'sugarMax',
  'fiberMin',
  'fiberMax',
  'sodiumMin',
  'sodiumMax',
] as const;

export function extractBalancedJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i += 1) {
    const c = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

export function parseModelJsonContent(content: string): unknown {
  const strippedFences = content
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const tryParse = (s: string): unknown | undefined => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };

  const direct = tryParse(strippedFences);
  if (direct !== undefined) return direct;

  const extracted = extractBalancedJsonObject(strippedFences);
  if (extracted) {
    const nested = tryParse(extracted);
    if (nested !== undefined) return nested;
  }

  throw new Error('MEAL_ANALYSIS_PARSE_FAILED');
}

const coerceNonNegNumber = z.coerce.number().refine((n) => Number.isFinite(n) && n >= 0, {
  message: 'non-negative number',
});

export const confidenceSchema = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const s = v.toLowerCase().trim();
  if (s === 'moderate') return 'medium';
  return s;
}, z.enum(['high', 'medium', 'low']));

export const foodItemSchema = z.object({
  name: z.string(),
  portion: z.string(),
  caloriesMin: coerceNonNegNumber,
  caloriesMax: coerceNonNegNumber,
  proteinMin: coerceNonNegNumber,
  proteinMax: coerceNonNegNumber,
  carbsMin: coerceNonNegNumber,
  carbsMax: coerceNonNegNumber,
  fatMin: coerceNonNegNumber,
  fatMax: coerceNonNegNumber,
  sugarMin: coerceNonNegNumber,
  sugarMax: coerceNonNegNumber,
  fiberMin: coerceNonNegNumber,
  fiberMax: coerceNonNegNumber,
  sodiumMin: coerceNonNegNumber,
  sodiumMax: coerceNonNegNumber,
});

export const mealAnalysisSchema = z.object({
  items: z.array(foodItemSchema).min(1),
  totalCaloriesMin: coerceNonNegNumber,
  totalCaloriesMax: coerceNonNegNumber,
  totalProteinMin: coerceNonNegNumber,
  totalProteinMax: coerceNonNegNumber,
  confidence: confidenceSchema,
  tips: z.array(z.string()).optional(),
});

function swapMinMax(record: Record<string, unknown>, minKey: string, maxKey: string) {
  const minVal = Number(record[minKey]);
  const maxVal = Number(record[maxKey]);
  if (Number.isFinite(minVal) && Number.isFinite(maxVal) && minVal > maxVal) {
    record[minKey] = maxVal;
    record[maxKey] = minVal;
  }
}

function normalizeItem(raw: unknown, defaultPortion: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = { ...(raw as Record<string, unknown>) };
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name) return null;
  item.name = name;
  if (typeof item.portion !== 'string' || !item.portion.trim()) {
    item.portion = defaultPortion;
  }
  for (const key of RANGE_KEYS) {
    if (item[key] === undefined || item[key] === null) item[key] = 0;
  }
  for (let i = 0; i < RANGE_KEYS.length; i += 2) {
    swapMinMax(item, RANGE_KEYS[i], RANGE_KEYS[i + 1]);
  }
  return item;
}

function sumItemField(items: Record<string, unknown>[], minKey: string, maxKey: string) {
  let minSum = 0;
  let maxSum = 0;
  for (const item of items) {
    minSum += Number(item[minKey]) || 0;
    maxSum += Number(item[maxKey]) || 0;
  }
  return { min: minSum, max: maxSum };
}

/** Coerce messy model JSON into a shape Zod can validate. */
export function normalizeMealAnalysisRaw(raw: unknown, language: 'id' | 'en'): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  const defaultPortion = language === 'en' ? '1 serving' : '1 porsi';

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items = rawItems
    .map((item) => normalizeItem(item, defaultPortion))
    .filter((item): item is Record<string, unknown> => item !== null)
    .slice(0, 10);

  if (items.length === 0) return obj;

  obj.items = items;

  const cal = sumItemField(items, 'caloriesMin', 'caloriesMax');
  const pro = sumItemField(items, 'proteinMin', 'proteinMax');

  if (obj.totalCaloriesMin === undefined || obj.totalCaloriesMin === null) obj.totalCaloriesMin = cal.min;
  if (obj.totalCaloriesMax === undefined || obj.totalCaloriesMax === null) obj.totalCaloriesMax = cal.max;
  if (obj.totalProteinMin === undefined || obj.totalProteinMin === null) obj.totalProteinMin = pro.min;
  if (obj.totalProteinMax === undefined || obj.totalProteinMax === null) obj.totalProteinMax = pro.max;

  swapMinMax(obj, 'totalCaloriesMin', 'totalCaloriesMax');
  swapMinMax(obj, 'totalProteinMin', 'totalProteinMax');

  if (typeof obj.confidence !== 'string') obj.confidence = 'medium';

  return obj;
}

export type ValidateMealResult =
  | { ok: true; analysis: MealAnalysis }
  | { ok: false; error: string; zodError?: z.ZodError };

export function validateMealAnalysisFromContent(
  content: string,
  language: 'id' | 'en'
): ValidateMealResult {
  let parsed: unknown;
  try {
    parsed = parseModelJsonContent(content);
  } catch {
    return { ok: false, error: 'MEAL_ANALYSIS_PARSE_FAILED' };
  }

  const normalized = normalizeMealAnalysisRaw(parsed, language);
  const result = mealAnalysisSchema.safeParse(normalized);
  if (!result.success) {
    return { ok: false, error: 'MEAL_ANALYSIS_VALIDATION_FAILED', zodError: result.error };
  }

  return { ok: true, analysis: enrichMealAnalysisMicros(result.data) };
}

export function buildMealAnalysisPrompt(language: 'id' | 'en', compact: boolean): string {
  const itemCap = compact ? 4 : 8;
  const lines = [
    'Analyze this meal photo. Identify visible food items and estimate nutrition.',
    language === 'en'
      ? 'All text (names, portion, tips) in English. Use common English food names.'
      : 'Semua teks (nama, porsi, tips) dalam Bahasa Indonesia. Gunakan nama makanan umum di Indonesia (mis. ayam goreng, nasi).',
    compact
      ? `Return ONLY valid JSON with at most ${itemCap} combined items (merge garnishes/sauces into the nearest item).`
      : `Return ONLY valid JSON with at most ${itemCap} distinct items; merge small garnishes/sauces into the nearest item.`,
    '{ "items":[{ "name", "portion", "caloriesMin", "caloriesMax", "proteinMin", "proteinMax", "carbsMin", "carbsMax", "fatMin", "fatMax", "sugarMin", "sugarMax", "fiberMin", "fiberMax", "sodiumMin", "sodiumMax" }], "totalCaloriesMin", "totalCaloriesMax", "totalProteinMin", "totalProteinMax", "confidence":"high"|"medium"|"low", "tips":string[] }',
    'Non-negative numbers; each field min <= max. Prefer precise estimates (e.g. 487 not 500).',
    'Per item: estimate sugar (g), fiber (g), sodium (mg)—not all zeros unless negligible.',
    'Always include totals and at least one item.',
  ];
  return lines.join('\n');
}

export function systemPromptForMeal(language: 'id' | 'en'): string {
  return language === 'en'
    ? 'You are a nutrition analysis assistant for English users. Return strict JSON only.'
    : 'You are a nutrition analysis assistant for Indonesian users. Return strict JSON only.';
}

export type OpenAIChatResponse = {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index?: number;
    finish_reason?: string;
    message?: { role?: string; content?: string | null; refusal?: string | null };
  }>;
};

export function extractOpenAIContent(data: OpenAIChatResponse): {
  content: string | null;
  refusal: string | null;
  finishReason: string | null;
} {
  const choice = data.choices?.[0];
  const message = choice?.message;
  return {
    content: typeof message?.content === 'string' ? message.content : null,
    refusal: typeof message?.refusal === 'string' ? message.refusal : null,
    finishReason: choice?.finish_reason ?? null,
  };
}

/** Lets pre-1.0.16 app builds keep parsing `choices[0].message.content`. */
export function buildLegacyOpenAIChatResponse(content: string): OpenAIChatResponse {
  return {
    id: 'chatcmpl-meal-analysis-compat',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'gpt-4o-mini',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
  };
}
