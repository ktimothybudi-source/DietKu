import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";
import { communityRouter } from "./routes/community";
import { exerciseRouter } from "./routes/exercise";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  community: communityRouter,
  exercise: exerciseRouter,
});

export type AppRouter = typeof appRouter;
