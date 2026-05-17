import { z } from 'zod';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  MEAL_SCAN_JPEG_QUALITY,
  MEAL_SCAN_MAX_BASE64_CHARS,
  MEAL_SCAN_MAX_WIDTH,
} from '@/constants/mealScanImage';
import { MealAnalysis } from '@/types/nutrition';
import {
  extractOpenAIContent,
  mealAnalysisSchema,
  parseModelJsonContent,
  validateMealAnalysisFromContent,
} from '@/utils/mealAnalysisCore';
import { AIProxyError, callAIProxy } from '@/utils/aiProxy';
import { mapScanErrorToUserMessage, type ScanLanguage } from '@/utils/scanErrorMessages';

function stripDataUrlPrefix(b64: string): string {
  return b64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
}

async function ensureMealImageUnderLimit(rawBase64: string): Promise<string> {
  let sanitized = stripDataUrlPrefix(rawBase64);
  if (sanitized.length <= MEAL_SCAN_MAX_BASE64_CHARS) {
    return sanitized;
  }

  let width = MEAL_SCAN_MAX_WIDTH;
  let quality = MEAL_SCAN_JPEG_QUALITY;
  let dataUri = `data:image/jpeg;base64,${sanitized}`;

  for (let attempt = 0; attempt < 5 && sanitized.length > MEAL_SCAN_MAX_BASE64_CHARS; attempt += 1) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        dataUri,
        [{ resize: { width } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!result.base64) {
        throw new Error('Could not compress meal image');
      }
      sanitized = result.base64;
      dataUri = `data:image/jpeg;base64,${sanitized}`;
    } catch (compressionError) {
      console.warn('Meal image compression failed:', compressionError);
      break;
    }
    width = Math.round(width * 0.72);
    quality = Math.max(0.4, quality - 0.08);
  }

  if (sanitized.length > MEAL_SCAN_MAX_BASE64_CHARS) {
    throw new Error('IMAGE_TOO_LARGE');
  }

  return sanitized;
}

type MealAnalysisApiResponse = {
  analysis?: MealAnalysis;
  choices?: unknown[];
  error?: string;
  code?: string;
};

function extractProxyError(err: unknown): { message: string; code?: string } {
  if (err instanceof AIProxyError && err.data && typeof err.data === 'object' && err.data !== null) {
    const data = err.data as { error?: unknown; code?: unknown };
    const message = data.error != null ? String(data.error) : err.message;
    const code = data.code != null ? String(data.code) : undefined;
    return { message, code };
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: 'Unknown error' };
}

function parseLegacyOpenAIEnvelope(json: MealAnalysisApiResponse, language: ScanLanguage): MealAnalysis {
  const { content, refusal, finishReason } = extractOpenAIContent(json as Parameters<typeof extractOpenAIContent>[0]);
  if (refusal) {
    throw new Error(mapScanErrorToUserMessage(refusal, language));
  }
  if (!content?.trim()) {
    const code = finishReason === 'length' ? 'MEAL_ANALYSIS_TRUNCATED' : 'MEAL_ANALYSIS_PARSE_FAILED';
    throw new Error(mapScanErrorToUserMessage(code, language));
  }
  const validated = validateMealAnalysisFromContent(content, language);
  if (!validated.ok) {
    throw new Error(mapScanErrorToUserMessage(validated.error, language));
  }
  return validated.analysis;
}

function parseMealAnalysisResponse(json: MealAnalysisApiResponse, language: ScanLanguage): MealAnalysis {
  if (json.analysis && typeof json.analysis === 'object') {
    const parsed = mealAnalysisSchema.safeParse(json.analysis);
    if (parsed.success) {
      return parsed.data;
    }
    throw new Error(mapScanErrorToUserMessage('MEAL_ANALYSIS_VALIDATION_FAILED', language));
  }

  if (json.choices) {
    return parseLegacyOpenAIEnvelope(json, language);
  }

  throw new Error(mapScanErrorToUserMessage('MEAL_ANALYSIS_PARSE_FAILED', language));
}

export type AnalyzeMealPhotoOptions = {
  userId?: string | null;
  language?: ScanLanguage;
};

export async function analyzeMealPhoto(
  base64Image: string,
  options?: AnalyzeMealPhotoOptions
): Promise<MealAnalysis> {
  const language: ScanLanguage = options?.language === 'en' ? 'en' : 'id';
  const base64ForApi = await ensureMealImageUnderLimit(base64Image);
  const payload: Record<string, unknown> = { base64Image: base64ForApi };
  if (options?.userId) {
    payload.userId = options.userId;
  }
  payload.language = language;

  const runOnce = async (): Promise<MealAnalysis> => {
    let json: MealAnalysisApiResponse;
    try {
      json = await callAIProxy<MealAnalysisApiResponse>('meal-analysis', payload);
    } catch (err) {
      const { message, code } = extractProxyError(err);
      throw new Error(mapScanErrorToUserMessage(code ?? message, language));
    }
    return parseMealAnalysisResponse(json, language);
  };

  try {
    return await runOnce();
  } catch (firstError) {
    const msg = firstError instanceof Error ? firstError.message : '';
    const retryable =
      msg.includes('Koneksi gagal') ||
      msg.includes('Connection failed') ||
      msg.includes('terpotong') ||
      msg.includes('cut off') ||
      msg.includes('Gagal membaca') ||
      msg.includes('Could not read');

    if (!retryable) {
      throw firstError;
    }

    await new Promise((r) => setTimeout(r, 800));
    return runOnce();
  }
}
