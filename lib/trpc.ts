import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (envUrl) {
    return envUrl;
  }

  const toolkitUrl = process.env.EXPO_PUBLIC_TOOLKIT_URL;

  if (toolkitUrl) {
    return toolkitUrl;
  }

  const webOrigin =
    typeof window !== "undefined" ? window.location.origin : undefined;

  if (webOrigin) {
    console.warn(
      "[trpc] EXPO_PUBLIC_RORK_API_BASE_URL is missing. Falling back to window.location.origin.",
    );
    return webOrigin;
  }

  const localFallback = "http://localhost:8081";
  console.warn(
    "[trpc] EXPO_PUBLIC_RORK_API_BASE_URL is missing. Falling back to http://localhost:8081.",
  );
  return localFallback;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});
