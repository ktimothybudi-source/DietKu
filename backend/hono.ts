import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import aiApp from "./hono-ai";
import accountApp from "./hono-account";
import notificationsApp from "./hono-notifications";

const app = new Hono();

app.use("*", cors());
app.route("/api/ai", aiApp);
app.route("/api/account", accountApp);
app.route("/api/notifications", notificationsApp);

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  }),
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

export default app;
