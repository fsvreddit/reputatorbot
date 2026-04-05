import { reddit, settings, User } from "@devvit/web/server";
import { T1, UiResponse } from "@devvit/web/shared";
import type { Context } from "hono";
import { getCurrentScore, ScoreResult, setUserScore } from "../core/thanksPoints";

interface SetScoreManuallyFormValues {
    newScore: number;
    commentId: T1;
}

export const handleSetScoreManuallyForm = async (c: Context) => {
    const { newScore, commentId } = await c.req.json<SetScoreManuallyFormValues>();

    const comment = await reddit.getCommentById(commentId);

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
