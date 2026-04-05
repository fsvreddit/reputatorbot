import { Request, Response } from "express";
import { restoreFormHandler, RestoreScoresFormValues } from "../core";

export const handleRestoreScoresForm = async (request: Request, response: Response) => {
    const restoreScoresFormValues = request.body as RestoreScoresFormValues;
    const uiResponse = await restoreFormHandler(restoreScoresFormValues);
    response.json(uiResponse);
};
