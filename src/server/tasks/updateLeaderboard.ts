import { context, redis, reddit, settings, WikiPage, TaskRequest } from "@devvit/web/server";
import type { Context } from "hono";
import { AppSetting, LeaderboardMode, POINTS_STORE_KEY, UpdateLeaderboardJobData } from "../core";
import markdownEscape from "markdown-escape";
import pluralize from "pluralize";
import { hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";

export const updateLeaderboardJob = async (c: Context) => {
    const jobRequest = await c.req.json<TaskRequest<UpdateLeaderboardJobData>>();
    if (await hasTriggerBeenHandled(`updateLeaderboard:${jobRequest.data.jobGuid}`)) {
        console.warn(`Duplicate leaderboard update job ignored: ${jobRequest.data.jobGuid}`);
        return c.json({ message: "duplicate leaderboard update job ignored" }, 200);
    }

    await updateLeaderboard(jobRequest);

    return c.json({ message: "leaderboard update job completed" }, 200);
};

export async function updateLeaderboard (jobRequest: TaskRequest<UpdateLeaderboardJobData>) {
    const appSettings = await settings.getAll();

    const [leaderboardMode] = appSettings[AppSetting.LeaderboardMode] as LeaderboardMode[] | undefined ?? [LeaderboardMode.Off];
    if (!leaderboardMode || leaderboardMode === LeaderboardMode.Off) {
        return;
    }

    const wikiPageName = appSettings[AppSetting.LeaderboardWikiPage] as string | undefined;
    if (!wikiPageName) {
        return;
    }

    const leaderboardSize = appSettings[AppSetting.LeaderboardSize] as number | undefined ?? 20;

    const highScores = await redis.zRange(POINTS_STORE_KEY, 0, leaderboardSize - 1, { by: "rank", reverse: true });

    let wikiContents = `# ReputatorBot High Scores for ${context.subredditName}\n\nUser | Points Total\n-|-\n`;
    wikiContents += highScores.map(score => `${markdownEscape(score.member)}|${score.score}`).join("\n");

    wikiContents += `\n\nThe leaderboard shows the top ${leaderboardSize} ${pluralize("user", leaderboardSize)} who ${pluralize("has", leaderboardSize)} been awarded at least one point`;

    const installDateTimestamp = await redis.get("InstallDate");
    if (installDateTimestamp) {
        const installDate = new Date(parseInt(installDateTimestamp));
        wikiContents += ` since ${installDate.toUTCString()}`;
    }

    wikiContents += ".";

    const helpPage = appSettings[AppSetting.LeaderboardHelpPage] as string | undefined;
    if (helpPage) {
        wikiContents += `\n\n[How to award points on /r/${context.subredditName}](${helpPage})`;
    }

    let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await reddit.getWikiPage(context.subredditName, wikiPageName);
    } catch {
        //
    }

    const wikiPageOptions = {
        subredditName: context.subredditName,
        page: wikiPageName,
        content: wikiContents,
        reason: jobRequest.data.reason,
    };

    if (wikiPage) {
        if (wikiPage.content !== wikiContents) {
            await reddit.updateWikiPage(wikiPageOptions);
            console.log("Leaderboard: Leaderboard updated.");
        }
    } else {
        wikiPage = await reddit.createWikiPage(wikiPageOptions);
        console.log("Leaderboard: Leaderboard created.");
    }

    // 0 = public, 2 = mod only
    const correctPermissionLevel = leaderboardMode === LeaderboardMode.Public ? 0 : 2;

    const wikiPageSettings = await wikiPage.getSettings();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    if (wikiPageSettings.permLevel as number !== correctPermissionLevel) {
        await reddit.updateWikiPageSettings({
            subredditName: context.subredditName,
            page: wikiPageName,
            listed: true,
            permLevel: correctPermissionLevel,
        });
    }
}
