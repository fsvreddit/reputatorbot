import type { Context } from "hono";
import { backupAllScores } from "../core";
import { performModCheck } from "./modCheck";

export const handleBackupScoresMenu = async (c: Context) => {
    const modCheckResult = await performModCheck();
    if (modCheckResult) {
        return c.json(modCheckResult);
    }

    const uiResponse = await backupAllScores();
    return c.json(uiResponse);
};
