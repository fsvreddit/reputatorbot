import { redis } from "@devvit/web/server";
import type { Context } from "hono";

export const onAppInstall = async (c: Context) => {
    await redis.set("InstallDate", new Date().getTime().toString());

    await redis.del("cleanupRecentlyRun");

    return c.json({ message: "app installed" }, 200);
};
