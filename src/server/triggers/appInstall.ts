import { redis } from "@devvit/web/server";
import { Request, Response } from "express";

export const onAppInstall = async (_: Request, response: Response) => {
    await redis.set("InstallDate", new Date().getTime().toString());

    return response.status(200).json({ message: "app installed" });
};
