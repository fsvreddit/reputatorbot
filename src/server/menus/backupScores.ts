import { context } from "@devvit/web/server";
import { UiResponse } from "@devvit/web/shared";
import { Request, Response } from "express";
import { backupAllScores, isModerator } from "../core";

export const handleBackupScoresMenu = async (_request: Request, response: Response) => {
    if (!context.username) {
        const json: UiResponse = {
            showToast: "You must be logged in to use this function.",
        };
        return response.json(json);
    }

    const isMod = await isModerator(context.username);
    if (!isMod) {
        const json: UiResponse = {
            showToast: "You must be a moderator to use this function.",
        };
        return response.json(json);
    }

    const uiResponse = await backupAllScores();
    response.json(uiResponse);
};
