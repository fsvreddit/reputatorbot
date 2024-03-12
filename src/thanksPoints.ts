import {TriggerContext} from "@devvit/public-api";
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
            console.log(`Error sending PM notification to ${toUserName}. User may only allow PMs from whitelisted users.`);
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

    const [userCommand, modCommand] = await Promise.all([
        context.settings.get<string>(SettingName.ThanksCommand),
        context.settings.get<string>(SettingName.ModThanksCommand),
    ]);

    // eslint-disable-next-line no-extra-parens
    const commentContainsCommand = (userCommand && event.comment.body.toLowerCase().includes(userCommand.toLowerCase())) || (modCommand && event.comment.body.toLowerCase().includes(modCommand.toLowerCase()));
    if (!commentContainsCommand) {
        return;
    }

    console.log(`${event.comment.id}: Comment contains a reputation points command.`);

    const isMod = await isModerator(context, event.subreddit.name, event.author.name);

    if (userCommand && event.comment.body.toLowerCase().includes(userCommand.toLowerCase()) && event.author.id !== event.post.authorId) {
        if (!isMod) {
            const anyoneCanAwardPoints = await context.settings.get<boolean>(SettingName.AnyoneCanAwardPoints);
            if (!anyoneCanAwardPoints) {
                console.log(`${event.comment.id}: points attempt made by ${event.author.name} who is not the OP`);
                const superUserSetting = await context.settings.get<string>(SettingName.SuperUsers);
                if (!superUserSetting) {
                    return;
                }

                const superUsers = superUserSetting.split(",").map(user => user.trim().toLowerCase());
                if (!superUsers.includes(event.author.name.toLowerCase())) {
                    console.log(`${event.comment.id}: Additionally, user is not a superuser`);
                    return;
                }
            }
        }
    } else if (modCommand && event.comment.body.toLowerCase().includes(modCommand.toLowerCase())) {
        if (!isMod) {
            console.log(`${event.comment.id}: mod points attempt by non-mod ${event.author.name}`);
            return;
        }
    }

    const parentComment = await context.reddit.getCommentById(event.comment.parentId);

    if (parentComment.authorId === context.appAccountId || parentComment.authorName === "AutoModerator") {
        // Cannot award points to Automod or the app account
        return;
    } else if (parentComment.authorName === event.author.name) {
        console.log(`${event.comment.id}: points attempt by ${event.author.name} on their own comment`);
        const notifyOnError = await context.settings.get<string[]>(SettingName.NotifyOnError);
        if (notifyOnError) {
            let message = await context.settings.get<string>(SettingName.NotifyOnErrorTemplate) ?? TemplateDefaults.NotifyOnErrorTemplate;
            message = replaceAll(message, "{{authorname}}", markdownEscape(event.author.name));
            await replyToUser(context, notifyOnError[0], event.author.name, message, event.comment.id);
        }
        return;
    } else {
        const excludedUsersSetting = await context.settings.get<string>(SettingName.ExcludedUsers);
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

    let newScore: number | undefined;

    const parentCommentUser = await parentComment.getAuthor();
    const userFlair = await parentCommentUser.getUserFlairBySubreddit(parentComment.subredditName);

    let currentScore = 0;
    if (!userFlair || !userFlair.flairText || userFlair.flairText === "-") {
        newScore = 1;
    } else {
        currentScore = parseInt(userFlair.flairText);
        if (isNaN(currentScore)) {
            console.log(`${event.comment.id}: Existing flair for ${parentCommentUser.username} isn't a number. Can't award points.`);
            newScore = 1;
        } else {
            newScore = currentScore + 1;
        }
    }

    const existingFlairOverwriteHandling = await context.settings.get<string[]>(SettingName.ExistingFlairHandling);

    const shouldSetUserFlair = !isNaN(currentScore) || existingFlairOverwriteHandling && existingFlairOverwriteHandling[0] === ExistingFlairOverwriteHandling.OverwriteAll;

    if (shouldSetUserFlair) {
        console.log(`${event.comment.id}: Setting points flair for ${parentCommentUser.username}. New score: ${newScore}`);

        let cssClass = await context.settings.get<string>(SettingName.CSSClass);
        if (!cssClass) {
            cssClass = undefined;
        }

        let flairTemplate = await context.settings.get<string>(SettingName.FlairTemplate);
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
    }

    const shouldSetPostFlair = await context.settings.get<boolean>(SettingName.SetPostFlairOnThanks);
    if (shouldSetPostFlair) {
        let [postFlairText, postFlairCSSClass, postFlairTemplate] = await Promise.all([
            context.settings.get<string>(SettingName.SetPostFlairText),
            context.settings.get<string>(SettingName.SetPostFlairCSSClass),
            context.settings.get<string>(SettingName.SetPostFlairTemplate),
        ]);

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

    // Store the user's new score
    await context.redis.zAdd(POINTS_STORE_KEY, {member: parentComment.authorName, score: newScore});

    const notifyOnSuccess = await context.settings.get<string[]>(SettingName.NotifyOnSuccess);
    if (notifyOnSuccess) {
        let message = await context.settings.get<string>(SettingName.NotifyOnSuccessTemplate) ?? TemplateDefaults.NotifyOnSuccessTemplate;
        message = replaceAll(message, "{{authorname}}", markdownEscape(event.author.name));
        message = replaceAll(message, "{{awardeeusername}}", markdownEscape(parentComment.authorName));
        await replyToUser(context, notifyOnSuccess[0], event.author.name, message, event.comment.id);
    }
}
