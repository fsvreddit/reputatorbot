import { reddit, settings, User } from "@devvit/web/server";
import { T1, UiResponse } from "@devvit/web/shared";
import { Request, Response } from "express";
import { getCurrentScore, ScoreResult, setUserScore } from "../core/thanksPoints";

interface SetScoreManuallyFormValues {
    newScore: number;
    commentId: T1;
}

export const handleSetScoreManuallyForm = async (request: Request, response: Response) => {
    const { newScore, commentId } = request.body as SetScoreManuallyFormValues;

    const comment = await reddit.getCommentById(commentId);

    let user: User | undefined;
    try {
        user = await reddit.getUserByUsername(comment.authorName);
    } catch {
        //
    }

    if (!user) {
        const json: UiResponse = {
            showToast: "Cannot set points. User may be shadowbanned.",
        };
        return response.json(json);
    }

    const appSettings = await settings.getAll();

    const existingScore = await getCurrentScore(user, appSettings);
    const newScoreSetting: ScoreResult = {
        score: newScore,
        userHasFlair: existingScore.userHasFlair,
        flairIsPointsFlair: existingScore.flairIsPointsFlair,
        flairIsNumber: existingScore.flairIsNumber,
    };
    await setUserScore(comment.authorName, newScoreSetting, appSettings);

    const json: UiResponse = {
        showToast: `New score for ${comment.authorName} is ${newScore}`,
    };

    return response.status(200).json(json);
};
