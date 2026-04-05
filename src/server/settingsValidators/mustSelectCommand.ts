import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Request, Response } from "express";

export const handleMustSelectCommandValidator = (request: Request, response: Response) => {
    const validationRequest = request.body as SettingsValidationRequest<string>;

    if (!validationRequest.value) {
        return response.json({
            success: false,
            error: "You must enter at least one command for awarding points.",
        } as SettingsValidationResponse);
    }

    return response.status(200).json({ success: true, message: "Validation successful." } as SettingsValidationResponse);
};
