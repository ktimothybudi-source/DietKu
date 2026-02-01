import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
});

export type AppRouter = typeof appRouter;
