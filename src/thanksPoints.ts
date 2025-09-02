import { Context, FormOnSubmitEvent, JSONObject, MenuItemOnPressEvent, SettingsValues, TriggerContext, User } from "@devvit/public-api";
import { CommentSubmit, CommentUpdate } from "@devvit/protos";
import { getSubredditName, isModerator, replaceAll } from "./utility.js";
import { addWeeks } from "date-fns";
import { ExistingFlairOverwriteHandling, ReplyOptions, TemplateDefaults, AppSetting } from "./settings.js";
import markdownEscape from "markdown-escape";
import { setCleanupForUsers } from "./cleanupTasks.js";
import { isLinkId } from "@devvit/public-api/types/tid.js";
import { manualSetPointsForm } from "./main.js";

export const POINTS_STORE_KEY = "thanksPointsStore";

async function replyToUser (context: TriggerContext, replyMode: ReplyOptions, toUserName: string, messageBody: string, commentId: string) {
    if (replyMode === ReplyOptions.NoReply) {
        return;
    } else if (replyMode === ReplyOptions.ReplyByPM) {
        const subredditName = await getSubredditName(context);
        try {
            await context.reddit.sendPrivateMessage({
                subject: `Message from ReputatorBot on ${subredditName}`,
                text: messageBody,
                to: toUserName,
            });
            console.log(`${commentId}: PM sent to ${toUserName}.`);
        } catch {
            console.log(`${commentId}: Error sending PM notification to ${toUserName}. User may only allow PMs from whitelisted users.`);
        }
    } else {
        // Reply by comment
        const newComment = await context.reddit.submitComment({
            id: commentId,
            text: messageBody,
        });
        await Promise.all([
            newComment.distinguish(),
            newComment.lock(),
        ]);
        console.log(`${commentId}: Public comment reply left in reply to ${toUserName}`);
    }
}

interface ScoreResult {
    currentScore: number;
    flairScoreIsNaN: boolean;
}

async function getCurrentScore (user: User, context: TriggerContext, settings: SettingsValues): Promise<ScoreResult> {
    const subredditName = await getSubredditName(context);
    const userFlair = await user.getUserFlairBySubreddit(subredditName);

    let scoreFromRedis: number | undefined;
    try {
        scoreFromRedis = await context.redis.zScore(POINTS_STORE_KEY, user.username) ?? 0;
    } catch {
        scoreFromRedis = 0;
    }

    let scoreFromFlair: number;
    const numberRegex = /^\d+$/;

    if (!userFlair?.flairText || userFlair.flairText === "-") {
        scoreFromFlair = 0;
    } else if (!numberRegex.test(userFlair.flairText)) {
        scoreFromFlair = NaN;
    } else {
        scoreFromFlair = parseInt(userFlair.flairText);
    }

    const flairScoreIsNaN = isNaN(scoreFromFlair);

    if (settings[AppSetting.PrioritiseScoreFromFlair] && !flairScoreIsNaN) {
        return {
            currentScore: scoreFromFlair,
            flairScoreIsNaN,
        };
    }

    return {
        currentScore: !flairScoreIsNaN && scoreFromFlair > scoreFromRedis ? scoreFromFlair : scoreFromRedis,
        flairScoreIsNaN,
    };
}

async function getUserIsSuperuser (username: string, context: TriggerContext): Promise<boolean> {
    const settings = await context.settings.getAll();

    const superUserSetting = settings[AppSetting.SuperUsers] as string | undefined ?? "";
    const superUsers = superUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (superUsers.includes(username.toLowerCase())) {
        return true;
    }

    const autoSuperuserThreshold = settings[AppSetting.AutoSuperuserThreshold] as number | undefined ?? 0;

    if (autoSuperuserThreshold) {
        let user: User | undefined;
        try {
            user = await context.reddit.getUserByUsername(username);
        } catch {
            return false;
        }
        if (!user) {
            return false;
        }
        const { currentScore } = await getCurrentScore(user, context, settings);
        return currentScore >= autoSuperuserThreshold;
    } else {
        return false;
    }
}

export async function handleThanksEvent (event: CommentSubmit | CommentUpdate, context: TriggerContext) {
    if (!event.comment || !event.post || !event.author || !event.subreddit) {
        return;
    }

    if (isLinkId(event.comment.parentId)) {
        // Points can't be awarded in a top level comment.
        return;
    }

    if (event.author.name === context.appName || event.author.name === "AutoModerator") {
        // Prevent bot account or Automod granting points
        return;
    }

    const settings = await context.settings.getAll();

    const userCommandVal = settings[AppSetting.ThanksCommand] as string | undefined;
    const userCommandList = userCommandVal?.split("\n").map(command => command.toLowerCase().trim()) ?? [];
    const modCommand = settings[AppSetting.ModThanksCommand] as string | undefined;

    let containsUserCommand: boolean;
    if (settings[AppSetting.ThanksCommandUsesRegex]) {
        const regexes = userCommandList.map(command => new RegExp(command, "i"));
        containsUserCommand = regexes.some(regex => event.comment && regex.test(event.comment.body));
    } else {
        containsUserCommand = userCommandList.some(command => event.comment?.body.toLowerCase().includes(command));
    }

    const containsModCommand = modCommand && event.comment.body.toLowerCase().includes(modCommand.toLowerCase().trim());

    if (!containsUserCommand && !containsModCommand) {
        return;
    }

    console.log(`${event.comment.id}: Comment from ${event.author.name} contains a reputation points command.`);

    const postFlairTextToIgnoreSetting = settings[AppSetting.PostFlairTextToIgnore] as string | undefined ?? "";
    if (postFlairTextToIgnoreSetting && event.post.linkFlair) {
        const postFlairTextToIgnore = postFlairTextToIgnoreSetting.split(",").map(flair => flair.trim().toLowerCase());
        const postFlair = event.post.linkFlair.text.toLowerCase();
        if (postFlairTextToIgnore.includes(postFlair)) {
            console.log(`${event.comment.id}: Cannot award points to post with: '${postFlair}' flair`);
            return;
        }
    }

    const isMod = await isModerator(context, event.subreddit.name, event.author.name);

    if (containsUserCommand && event.author.id !== event.post.authorId) {
        if (!settings[AppSetting.AnyoneCanAwardPoints]) {
            console.log(`${event.comment.id}: points attempt made by ${event.author.name} who is not the OP`);
            return;
        }
    } else if (containsModCommand) {
        const userIsSuperuser = await getUserIsSuperuser(event.author.name, context);

        if (!isMod && !userIsSuperuser) {
            console.log(`${event.comment.id}: mod points attempt by ${event.author.name} who is neither a mod nor a superuser`);
            return;
        }
    }

    const usersWhoCantAwardPointsSetting = settings[AppSetting.UsersWhoCannotAwardPoints] as string | undefined ?? "";
    if (usersWhoCantAwardPointsSetting) {
        const usersWhoCantAwardPoints = usersWhoCantAwardPointsSetting.split(",").map(user => user.trim().toLowerCase());
        if (usersWhoCantAwardPoints.includes(event.author.name.toLowerCase())) {
            console.log(`${event.comment.id}: ${event.author.name} is not permitted to award points.`);
            return;
        }
    }

    const parentComment = await context.reddit.getCommentById(event.comment.parentId);

    if (parentComment.authorName === context.appName || parentComment.authorName === "AutoModerator") {
        // Cannot award points to Automod or the app account
        return;
    } else if (parentComment.authorName === event.author.name) {
        console.log(`${event.comment.id}: points attempt by ${event.author.name} on their own comment`);
        const notifyOnError = (settings[AppSetting.NotifyOnError] as string[] | undefined ?? [ReplyOptions.NoReply])[0] as ReplyOptions;
        if (notifyOnError !== ReplyOptions.NoReply) {
            let message = settings[AppSetting.NotifyOnErrorTemplate] as string | undefined ?? TemplateDefaults.NotifyOnErrorTemplate;
            message = replaceAll(message, "{{authorname}}", markdownEscape(event.author.name));
            message = replaceAll(message, "{{permalink}}", parentComment.permalink);
            await replyToUser(context, notifyOnError, event.author.name, message, event.comment.id);
        }
        return;
    } else {
        const excludedUsersSetting = settings[AppSetting.UsersWhoCannotBeAwardedPoints] as string | undefined ?? "";
        if (excludedUsersSetting) {
            const excludedUsers = excludedUsersSetting.split(",").map(userName => userName.trim().toLowerCase());
            if (excludedUsers.includes(parentComment.authorName.toLowerCase())) {
                console.log(`${event.post.id}: User ${parentComment.authorName} is on the exclusion list.`);
                return;
            }
        }
    }

    const redisKey = `thanks-${parentComment.id}-${event.author.name}`;

    // Check to see if the given comment has already been thanked.
    const alreadyThanked = await context.redis.get(redisKey);
    if (alreadyThanked) {
        console.log(`${event.comment.id}: Comment ${parentComment.id} has already been thanked.`);
        return;
    }

    const parentCommentUser = await parentComment.getAuthor();
    if (!parentCommentUser) {
        console.log("Parent comment user is shadowbanned or suspended. Cannot proceed.");
        return;
    }
    const { currentScore, flairScoreIsNaN } = await getCurrentScore(parentCommentUser, context, settings);
    const newScore = currentScore + 1;

    console.log(`${event.comment.id}: New score for ${parentComment.authorName} is ${newScore}`);
    await setUserScore(parentComment.authorName, newScore, flairScoreIsNaN, context, settings);

    // Check to see if user has reached the superuser threshold.
    const autoSuperuserThreshold = settings[AppSetting.AutoSuperuserThreshold] as number | undefined ?? 0;
    const notifyOnAutoSuperuser = (settings[AppSetting.NotifyOnAutoSuperuser] as string[] | undefined ?? [ReplyOptions.NoReply])[0] as ReplyOptions;
    if (autoSuperuserThreshold && modCommand && newScore === autoSuperuserThreshold && notifyOnAutoSuperuser !== ReplyOptions.NoReply) {
        console.log(`${event.comment.id}: ${parentCommentUser.username} has reached the auto superuser threshold. Notifying.`);
        let message = settings[AppSetting.NotifyOnAutoSuperuserTemplate] as string | undefined ?? TemplateDefaults.NotifyOnSuperuserTemplate;
        message = replaceAll(message, "{{authorname}}", parentCommentUser.username);
        message = replaceAll(message, "{{permalink}}", parentComment.permalink);
        message = replaceAll(message, "{{threshold}}", autoSuperuserThreshold.toString());
        message = replaceAll(message, "{{pointscommand}}", modCommand);

        await replyToUser(context, notifyOnAutoSuperuser, parentCommentUser.username, message, parentComment.id);
    }

    const shouldSetPostFlair = settings[AppSetting.SetPostFlairOnThanks] as boolean | undefined ?? false;
    if (shouldSetPostFlair) {
        let postFlairText = settings[AppSetting.SetPostFlairText] as string | undefined;
        let postFlairCSSClass = settings[AppSetting.SetPostFlairCSSClass] as string | undefined;
        let postFlairTemplate = settings[AppSetting.SetPostFlairTemplate] as string | undefined;

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (!postFlairText) {
            postFlairText = undefined;
        }

        if (!postFlairCSSClass || postFlairTemplate) {
            postFlairCSSClass = undefined;
        }
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (!postFlairTemplate) {
            postFlairTemplate = undefined;
        }

        if (postFlairText || postFlairTemplate) {
            await context.reddit.setPostFlair({
                postId: event.post.id,
                subredditName: parentComment.subredditName,
                text: postFlairText,
                cssClass: postFlairCSSClass,
                flairTemplateId: postFlairTemplate,
            });

            console.log(`${event.comment.id}: Set post flair.`);
        }
    }

    const now = new Date();
    await context.redis.set(redisKey, now.getTime().toString(), { expiration: addWeeks(now, 1) });

    const notifyOnSuccess = (settings[AppSetting.NotifyOnSuccess] as string[] | [ReplyOptions.NoReply])[0] as ReplyOptions;
    if (notifyOnSuccess !== ReplyOptions.NoReply) {
        let message = settings[AppSetting.NotifyOnSuccessTemplate] as string | undefined ?? TemplateDefaults.NotifyOnSuccessTemplate;
        message = replaceAll(message, "{{authorname}}", markdownEscape(event.author.name));
        message = replaceAll(message, "{{awardeeusername}}", markdownEscape(parentComment.authorName));
        message = replaceAll(message, "{{permalink}}", parentComment.permalink);
        message = replaceAll(message, "{{score}}", newScore.toString());
        await replyToUser(context, notifyOnSuccess, event.author.name, message, event.comment.id);
    }

    const notifyAwardedUser = (settings[AppSetting.NotifyAwardedUser] as string[] | [ReplyOptions.NoReply])[0] as ReplyOptions;
    if (notifyAwardedUser !== ReplyOptions.NoReply) {
        let message = settings[AppSetting.NotifyAwardedUserTemplate] as string | undefined ?? TemplateDefaults.NotifyAwardedUserTemplate;
        message = replaceAll(message, "{{authorname}}", markdownEscape(event.author.name));
        message = replaceAll(message, "{{awardeeusername}}", markdownEscape(parentComment.authorName));
        message = replaceAll(message, "{{permalink}}", parentComment.permalink);
        message = replaceAll(message, "{{score}}", newScore.toString());
        await replyToUser(context, notifyAwardedUser, event.author.name, message, parentComment.id);
    }
}

async function setUserScore (username: string, newScore: number, flairScoreIsNaN: boolean, context: TriggerContext, settings: SettingsValues) {
    // Store the user's new score
    await context.redis.zAdd(POINTS_STORE_KEY, { member: username, score: newScore });
    // Queue user for cleanup checks in 24 hours, overwriting existing value.
    await setCleanupForUsers([username], context);

    // Queue a leaderboard update.
    await context.scheduler.runJob({
        name: "updateLeaderboard",
        runAt: new Date(),
        data: { reason: `Awarded a point to ${username}. New score: ${newScore}` },
    });

    const existingFlairOverwriteHandling = (settings[AppSetting.ExistingFlairHandling] as string[] | undefined ?? [ExistingFlairOverwriteHandling.OverwriteNumeric])[0] as ExistingFlairOverwriteHandling;

    const shouldSetUserFlair = existingFlairOverwriteHandling !== ExistingFlairOverwriteHandling.NeverSet && (!flairScoreIsNaN || existingFlairOverwriteHandling === ExistingFlairOverwriteHandling.OverwriteAll);

    if (shouldSetUserFlair) {
        console.log(`Setting points flair for ${username}. New score: ${newScore}`);

        let cssClass = settings[AppSetting.CSSClass] as string | undefined;
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (!cssClass) {
            cssClass = undefined;
        }

        let flairTemplate = settings[AppSetting.FlairTemplate] as string | undefined;
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (!flairTemplate) {
            flairTemplate = undefined;
        }

        if (flairTemplate && cssClass) {
            // Prioritise flair templates over CSS classes.
            cssClass = undefined;
        }

        const subredditName = await getSubredditName(context);

        await context.reddit.setUserFlair({
            subredditName,
            username,
            cssClass,
            flairTemplateId: flairTemplate,
            text: newScore.toString(),
        });
    } else {
        console.log(`${username}: Flair not set (option disabled or flair in wrong state)`);
    }
}

export async function handleManualPointSetting (event: MenuItemOnPressEvent, context: Context) {
    const comment = await context.reddit.getCommentById(event.targetId);
    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(comment.authorName);
    } catch {
        //
    }

    if (!user) {
        context.ui.showToast("Cannot set points. User may be shadowbanned.");
        return;
    }

    const settings = await context.settings.getAll();
    const { currentScore } = await getCurrentScore(user, context, settings);

    const fields = [
        {
            name: "newScore",
            type: "number",
            defaultValue: currentScore,
            label: `Enter a new score for ${comment.authorName}`,
            helpText: "Warning: This will overwrite the score that currently exists",
            multiSelect: false,
            required: true,
        },
    ];

    context.ui.showForm(manualSetPointsForm, { fields });
}

export async function manualSetPointsFormHandler (event: FormOnSubmitEvent<JSONObject>, context: Context) {
    if (!context.commentId) {
        context.ui.showToast("An error occurred setting the user's score.");
        return;
    }

    const newScore = event.values.newScore as number | undefined;
    if (!newScore) {
        context.ui.showToast("You must enter a new score");
        return;
    }

    const comment = await context.reddit.getCommentById(context.commentId);

    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(comment.authorName);
    } catch {
        //
    }

    if (!user) {
        context.ui.showToast("Cannot set points. User may be shadowbanned.");
        return;
    }

    const settings = await context.settings.getAll();

    const { flairScoreIsNaN } = await getCurrentScore(user, context, settings);
    await setUserScore(comment.authorName, newScore, flairScoreIsNaN, context, settings);

    context.ui.showToast(`Score for ${comment.authorName} is now ${newScore}`);
}
