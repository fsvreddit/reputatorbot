import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleFlairTextTemplateIncludesPlaceholderValidator = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    const regex = /{{points}}/g;
    const matches = validationRequest.value?.match(regex);
    if (!matches || matches.length > 1) {
        return c.json({
            success: false,
            error: "You must provide a flair text template that includes exactly one placeholder {{points}}",
        } as SettingsValidationResponse);
    }

    return c.json({ success: true, message: "Validation successful." } as SettingsValidationResponse, 200);
};
