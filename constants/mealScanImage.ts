/**
 * Meal scan images are sized for OpenAI vision `detail: "low"` (~512px short side).
 * 768px JPEG keeps plate-level detail for accuracy while minimizing upload + inference time.
 */
export const MEAL_SCAN_MAX_WIDTH = 768;
export const MEAL_SCAN_JPEG_QUALITY = 0.78;
/** ~390KB raw JPEG — enough headroom after base64 encoding. */
export const MEAL_SCAN_MAX_BASE64_CHARS = 520_000;
