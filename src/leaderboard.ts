import {ScheduledJobEvent, TriggerContext, WikiPage, WikiPagePermissionLevel} from "@devvit/public-api";
import {getSubredditName} from "./utility.js";
import {LeaderboardMode, SettingName} from "./settings.js";
import {POINTS_STORE_KEY} from "./thanksPoints.js";
import markdownEscape from "markdown-escape";

export async function updateLeaderboard (_: ScheduledJobEvent, context: TriggerContext) {
    const settings = await context.settings.getAll();

    const leaderboardMode = settings[SettingName.LeaderboardMode] as string[] | undefined;
    if (!leaderboardMode || leaderboardMode.length === 0 || leaderboardMode[0] === LeaderboardMode.Off) {
        return;
    }

    const wikiPageName = settings[SettingName.LeaderboardWikiPage] as string | undefined;
    if (!wikiPageName) {
        return;
    }

    const highScores = await context.redis.zRange(POINTS_STORE_KEY, 0, 19, {by: "rank", reverse: true});

    const subredditName = await getSubredditName(context);

    let wikiContents = `# ReputatorBot High Scores for ${subredditName}\n\nUser | Points Total\n-|-\n`;
    wikiContents += highScores.map(score => `${markdownEscape(score.member)}|${score.score}`).join("\n");

    wikiContents += "\n\nThe leaderboard shows the top 20 users who have been awarded at least one point";

    const installDateTimestamp = await context.redis.get("InstallDate");
    if (installDateTimestamp) {
        const installDate = new Date(parseInt(installDateTimestamp));
        wikiContents += ` since ${installDate.toUTCString()}`;
    }

    wikiContents += ". This page is updated once a day.";

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
    };

    if (wikiPage) {
        await context.reddit.updateWikiPage(wikiPageOptions);
    } else {
        wikiPage = await context.reddit.createWikiPage(wikiPageOptions);
    }

    const correctPermissionLevel = leaderboardMode[0] === LeaderboardMode.Public ? WikiPagePermissionLevel.SUBREDDIT_PERMISSIONS : WikiPagePermissionLevel.MODS_ONLY;

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
