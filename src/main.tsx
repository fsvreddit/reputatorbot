/* eslint-disable object-curly-spacing */
import {Devvit} from "@devvit/public-api";
import {POINTS_STORE_KEY, handleThanksEvent} from "./thanksPoints.js";
import {AppSetting, appSettings} from "./settings.js";
import {onAppFirstInstall, onAppInstallOrUpgrade} from "./installEvents.js";
import {updateLeaderboard} from "./leaderboard.js";
import {cleanupDeletedAccounts} from "./cleanupTasks.js";
import {backupAllScores, restoreForm, restoreFormHandler, showRestoreForm} from "./backupAndRestore.js";
import leaderboardCustomPost from "./leaderboardCustomPost.js";
import { getSubredditName } from "./utility.js";
import _ from "lodash";

Devvit.addSettings(appSettings);

Devvit.addTrigger({
    events: ["CommentSubmit", "CommentUpdate"],
    onEvent: handleThanksEvent,
});

Devvit.addTrigger({
    event: "AppInstall",
    onEvent: onAppFirstInstall,
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    onEvent: onAppInstallOrUpgrade,
});

Devvit.addSchedulerJob({
    name: "updateLeaderboard",
    onRun: updateLeaderboard,
});

Devvit.addSchedulerJob({
    name: "cleanupDeletedAccounts",
    onRun: cleanupDeletedAccounts,
});

Devvit.addCustomPostType({
    name: "leaderboardCustomPost",
    render: async context => {
        const settings = await context.settings.getAll();

        const leaderboardSize = settings[AppSetting.LeaderboardSize] as number ?? 20;

        const allScores = await context.redis.zRange(POINTS_STORE_KEY, 0, -1, {by: "rank", reverse: true});
        const highScores = allScores.slice(0, leaderboardSize - 1);

        const subredditName = await getSubredditName(context);

        return (
            <vstack>
                <text size="medium">Here are the top {leaderboardSize} scores for /r/{subredditName}.</text>
                <text size="medium">{_.sum(allScores.map(score => score.score))} points have been granted in total, across {allScores.length} users.</text>

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
});

Devvit.addMenuItem({
    label: "Submit Custom Post",
    forUserType: "moderator",
    location: "subreddit",
    onPress: async (event, context) => {
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
    },
});

Devvit.addMenuItem({
    label: "Backup ReputatorBot Scores",
    forUserType: "moderator",
    location: "subreddit",
    onPress: backupAllScores,
});

Devvit.addMenuItem({
    label: "Restore ReputatorBot Scores",
    forUserType: "moderator",
    location: "subreddit",
    onPress: showRestoreForm,
});

export const restoreFormKey = Devvit.createForm(restoreForm, restoreFormHandler);

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
