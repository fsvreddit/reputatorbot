import { context, reddit, settings, User } from "@devvit/web/server";
import { MenuItemRequest, UiResponse, T1 } from "@devvit/web/shared";
import { Request, Response } from "express";
import { getCurrentScore } from "../core/thanksPoints";
import { isModerator } from "../core";

export const handleSetScoreManuallyMenu = async (request: Request, response: Response) => {
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

    const menuRequest = request.body as MenuItemRequest;

    const comment = await reddit.getCommentById(menuRequest.targetId as T1);
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
    const currentScore = await getCurrentScore(user, appSettings);

    const json: UiResponse = {
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
                        label: "Comment ID",
                        disabled: true,
                        defaultValue: menuRequest.targetId,
                    },
                ],
            },
        },
    };

    return response.json(json);
};
