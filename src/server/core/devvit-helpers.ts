import { context, reddit } from "@devvit/web/server";

export async function isModerator (username: string, subredditName?: string): Promise<boolean> {
    const modList = await reddit.getModerators({
        subredditName: subredditName ?? context.subredditName,
        username,
    }).all();

    return modList.length > 0;
}
