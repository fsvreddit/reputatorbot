import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Request, Response } from "express";

export const handleWikiPageNameValidator = (request: Request, response: Response) => {
    const validationRequest = request.body as SettingsValidationRequest<string>;

    const wikiPageNameRegex = /^[\w/]+$/i;
    if (validationRequest.value && !wikiPageNameRegex.test(validationRequest.value)) {
        return response.json({
            success: false,
            error: "Invalid wiki page name. Wiki page name must consist of alphanumeric characters and / characters only.",
        } as SettingsValidationResponse);
    }

    return response.status(200).json({ success: true, message: "Validation successful." } as SettingsValidationResponse);
};
