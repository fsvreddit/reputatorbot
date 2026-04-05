import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleWikiPageNameValidator = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    const wikiPageNameRegex = /^[\w/]+$/i;
    if (validationRequest.value && !wikiPageNameRegex.test(validationRequest.value)) {
        return c.json({
            success: false,
            error: "Invalid wiki page name. Wiki page name must consist of alphanumeric characters and / characters only.",
        } as SettingsValidationResponse);
    }

    return c.json({ success: true, message: "Validation successful." } as SettingsValidationResponse, 200);
};
