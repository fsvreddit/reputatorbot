import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleWikiPageNameValidator = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    const wikiPageNameRegex = /^[\w/]+$/i;
    if (validationRequest.value && !wikiPageNameRegex.test(validationRequest.value)) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "Invalid wiki page name. Wiki page name must consist of alphanumeric characters and / characters only.",
        });
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
