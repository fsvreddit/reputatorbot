import { UiResponse } from "@devvit/web/shared";
import type { Context } from "hono";
import { performModCheck } from "./modCheck";

export const handleSubmitLeaderboardPostMenu = async (c: Context) => {
    const modCheckResult = await performModCheck();
    if (modCheckResult) {
        return c.json(modCheckResult);
    }

    return c.json<UiResponse>({
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
    });
};
