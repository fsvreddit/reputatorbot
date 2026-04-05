import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Request, Response } from "express";

export const handleFlairTextTemplateIncludesPlaceholderValidator = (request: Request, response: Response) => {
    const validationRequest = request.body as SettingsValidationRequest<string>;

    const regex = /{{points}}/g;
    const matches = validationRequest.value?.match(regex);
    if (!matches || matches.length > 1) {
        return response.json({
            success: false,
            error: "You must provide a flair text template that includes exactly one placeholder {{points}}",
        } as SettingsValidationResponse);
    }

    return response.status(200).json({ success: true, message: "Validation successful." } as SettingsValidationResponse);
};
