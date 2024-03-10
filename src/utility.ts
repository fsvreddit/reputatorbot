import {TriggerContext} from "@devvit/public-api";
import {addWeeks} from "date-fns";

export enum ThingPrefix {
    Comment = "t1_",
    Account = "t2_",
    Post = "t3_",
    Message = "t4_",
    Subreddit = "t5_",
    Award = "t6_"
}

export function replaceAll (input: string, pattern: string, replacement: string): string {
    return input.split(pattern).join(replacement);
}

export async function isModerator (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const filteredModeratorList = await context.reddit.getModerators({subredditName, username}).all();
    return filteredModeratorList.length > 0;
}

export async function getSubredditName (context: TriggerContext): Promise<string> {
    const subredditName = await context.redis.get("subredditname");
    if (subredditName) {
        return subredditName;
    }

    const subreddit = await context.reddit.getCurrentSubreddit();
    await context.redis.set("subredditname", subreddit.name, {expiration: addWeeks(new Date(), 1)});
    return subreddit.name;
}
