import { reddit, settings, User } from "@devvit/web/server";
import { MenuItemRequest, UiResponse, T1 } from "@devvit/web/shared";
import type { Context } from "hono";
import { getCurrentScore } from "../core/thanksPoints";
import { performModCheck } from "./modCheck";

export const handleSetScoreManuallyMenu = async (c: Context) => {
    const modCheckResult = await performModCheck();
    if (modCheckResult) {
        return c.json(modCheckResult);
    }

    const menuRequest = await c.req.json<MenuItemRequest>();

    const comment = await reddit.getCommentById(menuRequest.targetId as T1);
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
    const currentScore = await getCurrentScore(user, appSettings);

    return c.json<UiResponse>({
        showForm: {
            name: "manualSetPointsForm",
            form: {
                title: `Manually set points for ${comment.authorName}`,
                fields: [
                    {
                        name: "newScore",
                        type: "number",
                        defaultValue: currentScore.score,
                        label: `Enter a new score for ${comment.authorName}`,
                        helpText: "Warning: This will overwrite the score that currently exists",
                        required: true,
                    },
                    {
                        name: "commentId",
                        type: "string",
                        label: "Comment ID (for internal use)",
                        disabled: true,
                        defaultValue: menuRequest.targetId,
                    },
                ],
            },
        },
    });
};
