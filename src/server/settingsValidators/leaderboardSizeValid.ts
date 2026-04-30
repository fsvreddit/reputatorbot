import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleLeaderboardSizeValidator = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<number>>();

    if (!validationRequest.value || validationRequest.value <= 10 || validationRequest.value > 100) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "Invalid leaderboard size. Leaderboard size must be a number greater than 10 and less than or equal to 100.",
        });
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
