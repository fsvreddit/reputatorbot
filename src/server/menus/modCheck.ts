import { context } from "@devvit/web/server";
import { UiResponse } from "@devvit/web/shared";
import { isModerator } from "../core";

export async function performModCheck (): Promise<UiResponse | undefined> {
    if (!context.username) {
        return {
            showToast: "You must be logged in to use this function.",
        };
    }

    const isMod = await isModerator(context.username);
    if (!isMod) {
        return {
            showToast: "You must be a moderator to use this function.",
        };
    }
};
