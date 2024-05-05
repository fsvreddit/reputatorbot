import {Context, CustomPostType, Devvit, MenuItemOnPressEvent} from "@devvit/public-api";
import {AppSetting} from "./settings.js";
import {POINTS_STORE_KEY} from "./thanksPoints.js";
import {getSubredditName} from "./utility.js";

export async function createCustomPost (event: MenuItemOnPressEvent, context: Context) {
    await context.reddit.submitPost({
        subredditName: "fsvsandbox",
        title: "ReputatorBot High Scores",
        preview: (
            <vstack padding="medium" cornerRadius="medium">
                <text style="heading" size="medium">
                    Loading ReputatorBot Leaderboard...
                </text>
            </vstack>
        ),
    });
}

export const leaderboardCustomPost: CustomPostType = {
    name: "leaderboardCustomPost",
    // description: "Post that displays ReputatorBot high scorers",
    // height: "tall",
    render: async context => {
        const settings = await context.settings.getAll();

        const leaderboardSize = settings[AppSetting.LeaderboardSize] as number ?? 20;

        const highScores = await context.redis.zRange(POINTS_STORE_KEY, 0, leaderboardSize - 1, {by: "rank", reverse: true});

        const subredditName = await getSubredditName(context);

        return (
            <vstack>
                <text size="xxlarge">Scores for /r/{subredditName}</text>
                <spacer size="medium" />
                <hstack>
                    <spacer size="small" />
                    <vstack>
                        {highScores.map(score => <text>{score.member}</text>)}
                    </vstack>
                    <spacer size="small" />
                    <vstack>
                        {highScores.map(score => <text>{score.score}</text>)}
                    </vstack>
                </hstack>
            </vstack>
        );
    },
};
