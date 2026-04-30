import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleMustSelectCommandValidator = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    if (!validationRequest.value) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "You must enter at least one command for awarding points.",
        });
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
