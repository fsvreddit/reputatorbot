import type { Context } from "hono";
import { restoreFormHandler, RestoreScoresFormValues } from "../core";

export const handleRestoreScoresForm = async (c: Context) => {
    const restoreScoresFormValues = await c.req.json<RestoreScoresFormValues>();
    const uiResponse = await restoreFormHandler(restoreScoresFormValues);
    return c.json(uiResponse);
};
