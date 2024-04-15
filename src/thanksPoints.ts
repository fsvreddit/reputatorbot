import {TriggerContext, User} from "@devvit/public-api";
import {CommentSubmit, CommentUpdate} from "@devvit/protos";
import {ThingPrefix, getSubredditName, isModerator, replaceAll} from "./utility.js";
import {addWeeks} from "date-fns";
import {ExistingFlairOverwriteHandling, ReplyOptions, TemplateDefaults, SettingName} from "./settings.js";
import markdownEscape from "markdown-escape";

export const POINTS_STORE_KEY = "thanksPointsStore";

async function replyToUser (context: TriggerContext, replyMode: string, toUserName: string, messageBody: string, commentId: string) {
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
    currentScore: number,
    flairScoreIsNaN: boolean,
}

async function getCurrentScore (user: User, context: TriggerContext): Promise<ScoreResult> {
    const subredditName = await getSubredditName(context);
    const userFlair = await user.getUserFlairBySubreddit(subredditName);

    let scoreFromRedis: number;
    try {
        scoreFromRedis = await context.redis.zScore(POINTS_STORE_KEY, user.username);
    } catch {
        scoreFromRedis = 0;
    }

    let scoreFromFlair: number;
    if (!userFlair || !userFlair.flairText || userFlair.flairText === "-") {
        scoreFromFlair = 0;
    } else {
        scoreFromFlair = parseInt(userFlair.flairText);
    }

    const flairScoreIsNaN = isNaN(scoreFromFlair);

    return {
        currentScore: !flairScoreIsNaN && scoreFromFlair > scoreFromRedis ? scoreFromFlair : scoreFromRedis,
        flairScoreIsNaN,
    };
}

async function getUserIsSuperuser (username: string, context: TriggerContext): Promise<boolean> {
    const settings = await context.settings.getAll();

    const superUserSetting = settings[SettingName.SuperUsers] as string ?? "";
    const superUsers = superUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (superUsers.includes(username.toLowerCase())) {
        return true;
    }

    const autoSuperuserThreshold = settings[SettingName.AutoSuperuserThreshold] as number ?? 0;

    if (autoSuperuserThreshold) {
        const user = await context.reddit.getUserByUsername(username);
        const {currentScore} = await getCurrentScore(user, context);
        return currentScore >= autoSuperuserThreshold;
    } else {
        return false;
    }
}

export async function handleThanksEvent (event: CommentSubmit | CommentUpdate, context: TriggerContext) {
    if (!event.comment || !event.post || !event.author || !event.subreddit) {
        console.log("Event is not in the required state");
        return;
    }

    if (event.comment.parentId.startsWith(ThingPrefix.Post)) {
        // Points can't be awarded in a top level comment.
        return;
    }

    if (event.author.id === context.appAccountId || event.author.name === "AutoModerator") {
        // Prevent bot account or Automod granting points
        return;
    }

    const settings = await context.settings.getAll();

    const userCommand = settings[SettingName.ThanksCommand] as string | undefined;
    const modCommand = settings[SettingName.ModThanksCommand] as string | undefined;

    // eslint-disable-next-line no-extra-parens
    const commentContainsCommand = (userCommand && event.comment.body.toLowerCase().includes(userCommand.toLowerCase())) || (modCommand && event.comment.body.toLowerCase().includes(modCommand.toLowerCase()));
    if (!commentContainsCommand) {
        return;
    }

    console.log(`${event.comment.id}: Comment contains a reputation points command.`);

    const isMod = await isModerator(context, event.subreddit.name, event.author.name);

    if (userCommand && event.comment.body.toLowerCase().includes(userCommand.toLowerCase()) && event.author.id !== event.post.authorId) {
        const anyoneCanAwardPoints = settings[SettingName.AnyoneCanAwardPoints] as boolean ?? false;
        if (!anyoneCanAwardPoints) {
            console.log(`${event.comment.id}: points attempt made by ${event.author.name} who is not the OP`);
            return;
        }
    } else if (modCommand && event.comment.body.toLowerCase().includes(modCommand.toLowerCase())) {
        const userIsSuperuser = await getUserIsSuperuser(event.author.name, context);

        if (!isMod && !userIsSuperuser) {
            console.log(`${event.comment.id}: mod points attempt by ${event.author.name} who is neither a mod nor a superuser`);
            return;
        }
    }

    const usersWhoCantAwardPointsSetting = settings[SettingName.UsersWhoCannotAwardPoints] as string ?? "";
    if (usersWhoCantAwardPointsSetting) {
        const usersWhoCantAwardPoints = usersWhoCantAwardPointsSetting.split(",").map(user => user.trim().toLowerCase());
        if (usersWhoCantAwardPoints.includes(event.author.name.toLowerCase())) {
            console.log(`${event.comment.id}: ${event.author.name} is not permitted to award points.`);
            return;
        }
    }

    const parentComment = await context.reddit.getCommentById(event.comment.parentId);

    if (parentComment.authorId === context.appAccountId || parentComment.authorName === "AutoModerator") {
        // Cannot award points to Automod or the app account
        return;
    } else if (parentComment.authorName === event.author.name) {
        console.log(`${event.comment.id}: points attempt by ${event.author.name} on their own comment`);
        const notifyOnError = (settings[SettingName.NotifyOnError] as string[] ?? [ReplyOptions.NoReply])[0];
        if (notifyOnError) {
            let message = settings[SettingName.NotifyOnErrorTemplate] as string ?? TemplateDefaults.NotifyOnErrorTemplate;
            message = replaceAll(message, "{{authorname}}", markdownEscape(event.author.name));
            message = replaceAll(message, "{{permalink}}", parentComment.permalink);
            await replyToUser(context, notifyOnError, event.author.name, message, event.comment.id);
        }
        return;
    } else {
        const excludedUsersSetting = settings[SettingName.UsersWhoCannotBeAwardedPoints] as string ?? "";
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
    const {currentScore, flairScoreIsNaN} = await getCurrentScore(parentCommentUser, context);
    const newScore = currentScore + 1;

    console.log(`${event.comment.id}: New score for ${parentComment.authorName} is ${newScore}`);
    // Store the user's new score
    await context.redis.zAdd(POINTS_STORE_KEY, {member: parentComment.authorName, score: newScore});

    // Check to see if user has reached the superuser threshold.
    const autoSuperuserThreshold = settings[SettingName.AutoSuperuserThreshold] as number ?? 0;
    const notifyOnAutoSuperuser = (settings[SettingName.NotifyOnAutoSuperuser] as string[] ?? [ReplyOptions.NoReply])[0];
    if (autoSuperuserThreshold && modCommand && newScore === autoSuperuserThreshold && notifyOnAutoSuperuser) {
        console.log(`${event.comment.id}: ${parentCommentUser.username} has reached the auto superuser threshold. Notifying.`);
        let message = settings[SettingName.NotifyOnAutoSuperuserTemplate] as string ?? TemplateDefaults.NotifyOnSuperuserTemplate;
        message = replaceAll(message, "{{authorname}}", parentCommentUser.username);
        message = replaceAll(message, "{{permalink}}", parentComment.permalink);
        message = replaceAll(message, "{{threshold}}", autoSuperuserThreshold.toString());
        message = replaceAll(message, "{{pointscommand}}", modCommand);

        await replyToUser(context, notifyOnAutoSuperuser, parentCommentUser.username, message, parentComment.id);
    }

    const existingFlairOverwriteHandling = (settings[SettingName.ExistingFlairHandling] as string[] ?? [ExistingFlairOverwriteHandling.OverwriteNumeric])[0];

    const shouldSetUserFlair = existingFlairOverwriteHandling !== ExistingFlairOverwriteHandling.NeverSet && (!flairScoreIsNaN || existingFlairOverwriteHandling === ExistingFlairOverwriteHandling.OverwriteAll);

    if (shouldSetUserFlair) {
        console.log(`${event.comment.id}: Setting points flair for ${parentCommentUser.username}. New score: ${newScore}`);

        let cssClass = settings[SettingName.CSSClass] as string | undefined;
        if (!cssClass) {
            cssClass = undefined;
        }

        let flairTemplate = settings[SettingName.FlairTemplate] as string | undefined;
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
    } else {
        console.log(`${event.comment.id}: Flair not set (option disabled or flair in wrong state)`);
    }

    const shouldSetPostFlair = settings[SettingName.SetPostFlairOnThanks] as boolean ?? false;
    if (shouldSetPostFlair) {
        let postFlairText = settings[SettingName.SetPostFlairText] as string | undefined;
        let postFlairCSSClass = settings[SettingName.SetPostFlairCSSClass] as string | undefined;
        let postFlairTemplate = settings[SettingName.SetPostFlairTemplate] as string | undefined;

        if (!postFlairText) {
            postFlairText = undefined;
        }

        if (!postFlairCSSClass || postFlairTemplate) {
            postFlairCSSClass = undefined;
        }
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
    await context.redis.set(redisKey, now.getTime().toString(), {expiration: addWeeks(now, 1)});

    const notifyOnSuccess = (settings[SettingName.NotifyOnSuccess] as string[] | [ReplyOptions.NoReply])[0];
    if (notifyOnSuccess) {
        let message = settings[SettingName.NotifyOnSuccessTemplate] as string ?? TemplateDefaults.NotifyOnSuccessTemplate;
        message = replaceAll(message, "{{authorname}}", markdownEscape(event.author.name));
        message = replaceAll(message, "{{awardeeusername}}", markdownEscape(parentComment.authorName));
        message = replaceAll(message, "{{permalink}}", parentComment.permalink);
        message = replaceAll(message, "{{score}}", newScore.toString());
        await replyToUser(context, notifyOnSuccess, event.author.name, message, event.comment.id);
    }
}
