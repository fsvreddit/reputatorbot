import { TriggerContext } from "@devvit/public-api";

export function replaceAll (input: string, pattern: string, replacement: string): string {
    return input.split(pattern).join(replacement);
}

export async function isModerator (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const filteredModeratorList = await context.reddit.getModerators({ subredditName, username }).all();
    return filteredModeratorList.length > 0;
}
