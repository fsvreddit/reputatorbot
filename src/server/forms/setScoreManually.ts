import { context, reddit, settings, User } from "@devvit/web/server";
import { UiResponse } from "@devvit/web/shared";
import type { Context } from "hono";
import { getCurrentScore, ScoreResult, setUserScore } from "../core/thanksPoints";

interface SetScoreManuallyFormValues {
    newScore: number;
}

export const handleSetScoreManuallyForm = async (c: Context) => {
    const { newScore } = await c.req.json<SetScoreManuallyFormValues>();
    if (!context.commentId) {
        return c.json<UiResponse>({
            showToast: "No comment selected.",
        });
    }

    const comment = await reddit.getCommentById(context.commentId);

    let user: User | undefined;
    try {
        user = await reddit.getUserByUsername(comment.authorName);
    } catch {
        //
    }

    if (!user) {
        return c.json<UiResponse>({
            showToast: "Cannot set points. User may be shadowbanned.",
        });
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

    return c.json<UiResponse>({
        showToast: `New score for ${comment.authorName} is ${newScore}`,
    });
};
