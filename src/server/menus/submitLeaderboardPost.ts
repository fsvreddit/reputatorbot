import { UiResponse } from "@devvit/web/shared";
import { Request, Response } from "express";
import { performModCheck } from "./modCheck";

export const handleSubmitLeaderboardPostMenu = async (_request: Request, response: Response) => {
    const modCheckResult = await performModCheck();
    if (modCheckResult) {
        return response.json(modCheckResult);
    }

    const uiResponse: UiResponse = {
        showForm: {
            name: "submitLeaderboardPostForm",
            form: {
                fields: [
                    {
                        label: "Post Title",
                        name: "postTitle",
                        type: "string",
                        defaultValue: "ReputatorBot High Scores",
                        required: true,
                    },
                    {
                        label: "Sticky post",
                        name: "stickyPost",
                        type: "boolean",
                        defaultValue: true,
                    },
                    {
                        label: "Remove previous leaderboard post",
                        name: "removeExisting",
                        type: "boolean",
                        defaultValue: true,
                    },
                ],
            },
        },
    };

    return response.json(uiResponse);
};
