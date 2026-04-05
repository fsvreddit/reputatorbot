import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Request, Response } from "express";

export const handleSelectFieldHasOptionChosen = (request: Request, response: Response) => {
    const validationRequest = request.body as SettingsValidationRequest<string[]>;

    if (validationRequest.value?.length !== 1) {
        return response.json({
            success: false,
            error: "You must select an option.",
        } as SettingsValidationResponse);
    }

    return response.status(200).json({ success: true, message: "Validation successful." } as SettingsValidationResponse);
};
