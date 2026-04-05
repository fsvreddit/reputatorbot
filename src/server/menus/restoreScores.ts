import { Request, Response } from "express";
import { showRestoreForm } from "../core";
import { performModCheck } from "./modCheck";

export const handleRestoreScoresMenu = async (_request: Request, response: Response) => {
    const modCheckResult = await performModCheck();
    if (modCheckResult) {
        return response.json(modCheckResult);
    }

    const uiResponse = await showRestoreForm();
    return response.json(uiResponse);
};
