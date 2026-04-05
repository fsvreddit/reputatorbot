import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import { Request, Response } from "express";

export const handleLeaderboardSizeValidator = (request: Request, response: Response) => {
    const validationRequest = request.body as SettingsValidationRequest<number>;

    if (!validationRequest.value || validationRequest.value <= 10 || validationRequest.value > 100) {
        return response.json({
            success: false,
            error: "Invalid leaderboard size. Leaderboard size must be a number greater than 10 and less than or equal to 100.",
        } as SettingsValidationResponse);
    }

    return response.status(200).json({ success: true, message: "Validation successful." } as SettingsValidationResponse);
};
