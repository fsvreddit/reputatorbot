import {ScheduledJobEvent, TriggerContext, WikiPage, WikiPagePermissionLevel} from "@devvit/public-api";
import {CommentSubmit, CommentUpdate} from "@devvit/protos";
import {ThingPrefix, getSubredditName, isModerator, replaceAll} from "./utility.js";
import {addWeeks} from "date-fns";
import {LeaderboardMode, TemplateDefaults, ThanksPointsSettingName} from "./settings.js";

const POINTS_STORE_KEY = "thanksPointsStore";

export async function handleThanksEvent (event: CommentSubmit | CommentUpdate, context: TriggerContext) {
    if (!event.comment || !event.post || !event.author || !event.subreddit) {
        console.log("Event is not in the required state");
        return;
    }

    if (event.comment.parentId.startsWith(ThingPrefix.Post)) {
        // Points can't be awarded in a top level comment.
        return;
    }

    const [userCommand, modCommand] = await Promise.all([
        context.settings.get<string>(ThanksPointsSettingName.ThanksCommand),
        context.settings.get<string>(ThanksPointsSettingName.ModThanksCommand),
    ]);

    // eslint-disable-next-line no-extra-parens
    const commentContainsCommand = (userCommand && event.comment.body.toLowerCase().includes(userCommand.toLowerCase())) || (modCommand && event.comment.body.toLowerCase().includes(modCommand.toLowerCase()));
    if (!commentContainsCommand) {
        return;
    }

    if (userCommand && event.comment.body.toLowerCase().includes(userCommand.toLowerCase()) && event.author.id !== event.post.authorId) {
        console.log(`${event.comment.id}: points attempt made by ${event.author.name} who is not the OP`);
        return;
    }

    if (modCommand && event.comment.body.toLowerCase().includes(modCommand.toLowerCase())) {
        const isMod = await isModerator(context, event.subreddit.name, event.author.name);
        if (!isMod) {
            console.log(`${event.comment.id}: mod points attempt by non-mod ${event.author.name}`);
            return;
        }
    }

    const parentComment = await context.reddit.getCommentById(event.comment.parentId);

    if (parentComment.authorName === event.author.name) {
        console.log(`${event.comment.id}: points attempt by ${event.author.name} on their own comment`);
        const notifyOnError = await context.settings.get<boolean>(ThanksPointsSettingName.NotifyOnError);
        if (notifyOnError) {
            let message = await context.settings.get<string>(ThanksPointsSettingName.NotifyOnErrorTemplate) ?? TemplateDefaults.NotifyOnErrorTemplate;
            message = replaceAll(message, "{{authorname}}", event.author.name);
            const newComment = await context.reddit.submitComment({
                id: event.comment.id,
                text: message,
            });
            await Promise.all([
                newComment.distinguish(),
                newComment.lock(),
            ]);
        }
        return;
    }

    const redisKey = `thanks-${parentComment.id}`;

    // Check to see if the given comment has already been thanked.
    const alreadyThanked = await context.redis.get(redisKey);
    if (alreadyThanked) {
        console.log(`${event.comment.id}: Comment ${parentComment.id} has already been thanked.`);
        return;
    }

    let newScore: number | undefined;

    const parentCommentUser = await parentComment.getAuthor();
    const userFlair = await parentCommentUser.getUserFlairBySubreddit(parentComment.subredditName);

    if (!userFlair || !userFlair.flairText || userFlair.flairText === "-") {
        newScore = 1;
    } else {
        const currentScore = parseInt(userFlair.flairText);
        if (isNaN(currentScore)) {
            console.log(`${event.comment.id}: Existing flair for ${parentCommentUser.username} isn't a number. Can't award points.`);
            return;
        }
        newScore = currentScore + 1;
    }

    console.log(`${event.comment.id}: Setting points flair for ${parentCommentUser.username}. New score: ${newScore}`);

    let cssClass = await context.settings.get<string>(ThanksPointsSettingName.CSSClass);
    if (!cssClass) {
        cssClass = undefined;
    }

    let flairTemplate = await context.settings.get<string>(ThanksPointsSettingName.FlairTemplate);
    if (!flairTemplate) {
        flairTemplate = undefined;
    }

    if (flairTemplate && cssClass) {
        // Prioritise flair templates over CSS classes.
        cssClass = undefined;
    }

    await context.reddit.setUserFlair({
        subredditName: parentComment.subredditName,
        username: parentCommentUser.username,
        cssClass,
        flairTemplateId: flairTemplate,
        text: newScore.toString(),
    });

    const now = new Date();
    await context.redis.set(redisKey, now.getTime().toString(), {expiration: addWeeks(now, 1)});

    // Store the user's new score
    await context.redis.zAdd(POINTS_STORE_KEY, {member: parentComment.authorName, score: newScore});

    const notifyOnSuccess = await context.settings.get<boolean>(ThanksPointsSettingName.NotifyOnSuccess);
    if (notifyOnSuccess) {
        let message = await context.settings.get<string>(ThanksPointsSettingName.NotifyOnSuccessTemplate) ?? TemplateDefaults.NotifyOnSuccessTemplate;
        message = replaceAll(message, "{{authorname}}", event.author.name);
        message = replaceAll(message, "{{awardeeusername}}", parentComment.authorName);
        const newComment = await context.reddit.submitComment({
            id: event.comment.id,
            text: message,
        });
        await Promise.all([
            newComment.distinguish(),
            newComment.lock(),
        ]);
    }
}

export async function updateLeaderboard (_: ScheduledJobEvent, context: TriggerContext) {
    const leaderboardMode = await context.settings.get<string[]>(ThanksPointsSettingName.LeaderboardMode);
    if (!leaderboardMode || leaderboardMode.length === 0 || leaderboardMode[0] === LeaderboardMode.Off) {
        return;
    }

    const wikiPageName = await context.settings.get<string>(ThanksPointsSettingName.LeaderboardWikiPage);
    if (!wikiPageName) {
        return;
    }

    const highScores = await context.redis.zRange(POINTS_STORE_KEY, 0, 20, {by: "rank", reverse: true});

    const subredditName = await getSubredditName(context);

    let wikiContents = `# ReputatorBot High Scores for ${subredditName}\n\nUser | Points Total\n-|-\n`;
    wikiContents += highScores.map(score => `${score.member}|${score.score}`).join("\n");

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
