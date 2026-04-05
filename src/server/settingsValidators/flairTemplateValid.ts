import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleFlairTemplateValidator = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    const flairTemplateRegex = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){4}[0-9a-f]{8}$/;
    if (validationRequest.value && !flairTemplateRegex.test(validationRequest.value)) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "Invalid flair template ID",
        });
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
