import { Request, Response } from "express";
import { backupAllScores } from "../core";
import { performModCheck } from "./modCheck";

export const handleBackupScoresMenu = async (_request: Request, response: Response) => {
    const modCheckResult = await performModCheck();
    if (modCheckResult) {
        return response.json(modCheckResult);
    }

    const uiResponse = await backupAllScores();
    response.json(uiResponse);
};
