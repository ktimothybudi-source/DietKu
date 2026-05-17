function getApiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
    "https://dietku.onrender.com"
  );
}

export class AIProxyError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Warm TLS + serverless instance before the user captures a photo (fire-and-forget). */
export function warmAiProxy(): void {
  const baseUrl = getApiBaseUrl();
  void fetch(`${baseUrl}/`, { method: "GET" }).catch(() => {});
}

async function fetchAIProxyOnce(
  targetUrl: string,
  payload: Record<string, unknown>
): Promise<Response> {
  return fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function callAIProxy<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const targetUrl = `${baseUrl}/api/ai/${path}`;

  let lastNetworkError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      await sleep(1000);
    }

    let response: Response;
    try {
      response = await fetchAIProxyOnce(targetUrl, payload);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      lastNetworkError = new Error(`Network request failed to ${targetUrl}. ${detail}`);
      continue;
    }

    if (!response.ok) {
      let errorData: unknown = null;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }

      if (attempt === 0 && RETRYABLE_STATUSES.has(response.status)) {
        continue;
      }

      throw new AIProxyError(`AI proxy failed (${response.status})`, response.status, errorData);
    }

    return response.json() as Promise<T>;
  }

  throw lastNetworkError ?? new Error(`Network request failed to ${targetUrl}`);
}
