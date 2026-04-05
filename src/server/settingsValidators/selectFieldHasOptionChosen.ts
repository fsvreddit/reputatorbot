import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleSelectFieldHasOptionChosen = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string[]>>();

    if (validationRequest.value?.length !== 1) {
        return c.json({
            success: false,
            error: "You must select an option.",
        } as SettingsValidationResponse);
    }

    return c.json({ success: true, message: "Validation successful." } as SettingsValidationResponse, 200);
};
