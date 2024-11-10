import { JobContext, JSONObject, ScheduledJobEvent, WikiPage, WikiPagePermissionLevel } from "@devvit/public-api";
import { getSubredditName } from "./utility.js";
import { LeaderboardMode, AppSetting } from "./settings.js";
import { POINTS_STORE_KEY } from "./thanksPoints.js";
import markdownEscape from "markdown-escape";
import pluralize from "pluralize";

export async function updateLeaderboard (event: ScheduledJobEvent<JSONObject | undefined>, context: JobContext) {
    const settings = await context.settings.getAll();

    const leaderboardMode = settings[AppSetting.LeaderboardMode] as string[] | undefined;
    if (!leaderboardMode || leaderboardMode.length === 0 || leaderboardMode[0] as LeaderboardMode === LeaderboardMode.Off) {
        return;
    }

    const wikiPageName = settings[AppSetting.LeaderboardWikiPage] as string | undefined;
    if (!wikiPageName) {
        return;
    }

    const leaderboardSize = settings[AppSetting.LeaderboardSize] as number | undefined ?? 20;

    const highScores = await context.redis.zRange(POINTS_STORE_KEY, 0, leaderboardSize - 1, { by: "rank", reverse: true });

    const subredditName = await getSubredditName(context);

    let wikiContents = `# ReputatorBot High Scores for ${subredditName}\n\nUser | Points Total\n-|-\n`;
    wikiContents += highScores.map(score => `${markdownEscape(score.member)}|${score.score}`).join("\n");

    wikiContents += `\n\nThe leaderboard shows the top ${leaderboardSize} ${pluralize("user", leaderboardSize)} who ${pluralize("has", leaderboardSize)} been awarded at least one point`;

    const installDateTimestamp = await context.redis.get("InstallDate");
    if (installDateTimestamp) {
        const installDate = new Date(parseInt(installDateTimestamp));
        wikiContents += ` since ${installDate.toUTCString()}`;
    }

    wikiContents += ".";

    const helpPage = settings[AppSetting.LeaderboardHelpPage] as string | undefined;
    if (helpPage) {
        wikiContents += `\n\n[How to award points on /r/${subredditName}](${helpPage})`;
    }

    let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subredditName, wikiPageName);
    } catch {
        //
    }

    const wikiPageOptions = {
        subredditName,
        page: wikiPageName,
        content: wikiContents,
        reason: event.data?.reason as string | undefined,
    };

    if (wikiPage) {
        if (wikiPage.content !== wikiContents) {
            await context.reddit.updateWikiPage(wikiPageOptions);
            console.log("Leaderboard: Leaderboard updated.");
        }
    } else {
        wikiPage = await context.reddit.createWikiPage(wikiPageOptions);
        console.log("Leaderboard: Leaderboard created.");
    }

    const correctPermissionLevel = leaderboardMode[0] as LeaderboardMode === LeaderboardMode.Public ? WikiPagePermissionLevel.SUBREDDIT_PERMISSIONS : WikiPagePermissionLevel.MODS_ONLY;

    const wikiPageSettings = await wikiPage.getSettings();
    if (wikiPageSettings.permLevel !== correctPermissionLevel) {
        await context.reddit.updateWikiPageSettings({
            subredditName,
            page: wikiPageName,
            listed: true,
            permLevel: correctPermissionLevel,
        });
    }
}
