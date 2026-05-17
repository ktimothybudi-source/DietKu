import * as ImageManipulator from 'expo-image-manipulator';
import { MEAL_SCAN_JPEG_QUALITY, MEAL_SCAN_MAX_WIDTH } from '@/constants/mealScanImage';

type OptimizeOptions = {
  maxWidth: number;
  compress: number;
  includeBase64?: boolean;
};

const DEFAULT_SCAN_OPTIONS: OptimizeOptions = {
  maxWidth: MEAL_SCAN_MAX_WIDTH,
  compress: MEAL_SCAN_JPEG_QUALITY,
  includeBase64: true,
};

const DEFAULT_UPLOAD_OPTIONS: OptimizeOptions = {
  maxWidth: 1280,
  compress: 0.72,
};

const DEFAULT_LOCAL_OPTIONS: OptimizeOptions = {
  maxWidth: 1440,
  compress: 0.78,
};

async function optimizeImageUri(
  uri: string,
  options: OptimizeOptions
): Promise<{ uri: string; base64?: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: options.maxWidth } }],
    {
      compress: options.compress,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: options.includeBase64 === true,
    }
  );

  return {
    uri: result.uri,
    base64: result.base64 || undefined,
  };
}

export async function optimizeImageForScan(
  uri: string
): Promise<{ uri: string; base64: string }> {
  const result = await optimizeImageUri(uri, DEFAULT_SCAN_OPTIONS);
  if (!result.base64) {
    throw new Error('Failed to generate optimized base64 for scan image');
  }
  return { uri: result.uri, base64: result.base64 };
}

export async function optimizeImageForUpload(uri: string): Promise<string> {
  const result = await optimizeImageUri(uri, DEFAULT_UPLOAD_OPTIONS);
  return result.uri;
}

export async function optimizeImageForLocalStorage(uri: string): Promise<string> {
  const result = await optimizeImageUri(uri, DEFAULT_LOCAL_OPTIONS);
  return result.uri;
}
