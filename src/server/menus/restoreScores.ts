import type { Context } from "hono";
import { showRestoreForm } from "../core";
import { performModCheck } from "./modCheck";

export const handleRestoreScoresMenu = async (c: Context) => {
    const modCheckResult = await performModCheck();
    if (modCheckResult) {
        return c.json(modCheckResult);
    }

    const uiResponse = await showRestoreForm();
    return c.json(uiResponse);
};
