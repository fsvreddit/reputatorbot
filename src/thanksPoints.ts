import {ScheduledJobEvent, SettingsFormField, TriggerContext, WikiPage, WikiPagePermissionLevel} from "@devvit/public-api";
import {CommentSubmit, CommentUpdate} from "@devvit/protos";
import {ThingPrefix, getSubredditName, isModerator, replaceAll} from "./utility.js";
import {addWeeks} from "date-fns";

enum ThanksPointsSettingName {
    ThanksCommand = "thanksCommand",
    ModThanksCommand = "modThanksCommand",
    CSSClass = "thanksCSSClass",
    FlairTemplate = "thanksFlairTemplate",
    NotifyOnError = "notifyOnError",
    NotifyOnErrorTemplate = "notifyOnErrorTemplate",
    NotifyOnSuccess = "notifyOnSuccess",
    NotifyOnSuccessTemplate = "notifyOnSuccessTemplate",
    LeaderboardMode = "leaderboardMode",
    LeaderboardWikiPage = "leaderboardWikiPage",
}

enum LeaderboardMode {
    Off = "off",
    ModOnly = "modonly",
    Public = "public",
}

enum TemplateDefaults {
    NotifyOnErrorTemplate = "Hello {{authorname}},\n\nYou cannot award a point to yourself.\n\nPlease contact the mods if you have any questions.\n\n---\n\n^(I am a bot)",
    NotifyOnSuccessTemplate = "You have awarded 1 point to {{awardeeusername}}.\n\n---\n\n^(I am a bot - please contact the mods with any questions)",
}

const wikiPageNameRegex = /^[\w/]+$/i;

export const settingsForThanksPoints: SettingsFormField[] = [
    {
        name: ThanksPointsSettingName.ThanksCommand,
        type: "string",
        label: "Command for users to award points using",
        defaultValue: "!thanks",
        onValidate: ({value}) => {
            if (!value) {
                return "You must specify a command";
            }
        },
    },
    {
        name: ThanksPointsSettingName.ModThanksCommand,
        type: "string",
        label: "Command for mods to award points using",
        defaultValue: "!modthanks",
    },
    {
        name: ThanksPointsSettingName.CSSClass,
        type: "string",
        label: "CSS class to use for points flairs",
        helpText: "Please choose either a CSS class or flair template, not both.",
    },
    {
        name: ThanksPointsSettingName.FlairTemplate,
        type: "string",
        label: "Flair template ID to use for points flairs",
        helpText: "Please choose either a CSS class or flair template, not both.",
    },
    {
        name: ThanksPointsSettingName.NotifyOnError,
        type: "boolean",
        label: "Notify users by replying to their command if they try to award a point to themselves accidentally",
        defaultValue: false,
    },
    {
        name: ThanksPointsSettingName.NotifyOnErrorTemplate,
        type: "paragraph",
        label: "Template of message sent when a user tries to award themselves a point",
        helpText: "Placeholder supported: {{authorname}}",
        defaultValue: TemplateDefaults.NotifyOnErrorTemplate,
    },
    {
        name: ThanksPointsSettingName.NotifyOnSuccess,
        type: "boolean",
        label: "Notify users by replying to their command if their points command works",
        defaultValue: false,
    },
    {
        name: ThanksPointsSettingName.NotifyOnSuccessTemplate,
        type: "paragraph",
        label: "Template of message sent when a user successfully awards a point",
        helpText: "Placeholders supported: {{authorname}}, {{awardeeusername}}",
        defaultValue: TemplateDefaults.NotifyOnSuccessTemplate,
    },
    {
        name: ThanksPointsSettingName.LeaderboardMode,
        type: "select",
        options: [
            {label: "Off", value: LeaderboardMode.Off},
            {label: "Mod Only", value: LeaderboardMode.ModOnly},
            {label: "Default settings for wiki", value: LeaderboardMode.Public},
        ],
        label: "Leaderboard Mode",
        multiSelect: false,
        defaultValue: [LeaderboardMode.Off],
    },
    {
        name: ThanksPointsSettingName.LeaderboardWikiPage,
        type: "string",
        label: "Leaderboard Wiki Page",
        defaultValue: "reputatorbotleaderboard",
        onValidate: ({value}) => {
            if (value && !wikiPageNameRegex.test(value)) {
                return "Invalid wiki page name. Wiki page name must consist of alphanumeric characters and / characters only.";
            }
        },
    },
];

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
    const commentContainsCommand = (userCommand && event.comment.body.includes(`!${userCommand}`)) || (modCommand && event.comment.body.includes(`!${modCommand}`));
    if (!commentContainsCommand) {
        return;
    }

    if (userCommand && event.comment.body.includes(`!${userCommand}`) && event.author.id !== event.post.authorId) {
        console.log(`${event.comment.id}: points attempt made by ${event.author.name} who is not the OP`);
        return;
    }

    if (modCommand && event.comment.body.includes(`!${modCommand}`)) {
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
