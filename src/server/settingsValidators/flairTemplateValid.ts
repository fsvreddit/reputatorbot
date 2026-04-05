import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Request, Response } from "express";

export const handleFlairTemplateValidator = (request: Request, response: Response) => {
    const validationRequest = request.body as SettingsValidationRequest<string>;

    const flairTemplateRegex = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){4}[0-9a-f]{8}$/;
    if (validationRequest.value && !flairTemplateRegex.test(validationRequest.value)) {
        return response.json({
            success: false,
            error: "Invalid flair template ID",
        } as SettingsValidationResponse);
    }

    return response.status(200).json({ success: true, message: "Validation successful." } as SettingsValidationResponse);
};
