import { context, reddit, redis, scheduler, settings, SettingsValues, User } from "@devvit/web/server";
import { isT3, T1, T3 } from "@devvit/shared-types/tid.js";
import { addWeeks } from "date-fns";
import { ExistingFlairOverwriteHandling, ReplyOptions, TemplateDefaults, AppSetting } from "./settings.js";
import { isModerator, POINTS_STORE_KEY } from "./index.js";
import { OnCommentSubmitRequest, OnCommentUpdateRequest } from "@devvit/web/shared";
import markdownEscape from "markdown-escape";
import { setCleanupForUsers } from "../tasks/index.js";

async function replyToUser (replyMode: ReplyOptions | undefined, toUserName: string, messageBody: string, commentId: T1) {
    if (!replyMode || replyMode === ReplyOptions.NoReply) {
        return;
    } else if (replyMode === ReplyOptions.ReplyByPM) {
        try {
            await reddit.sendPrivateMessage({
                subject: `Message from ReputatorBot on ${context.subredditName}`,
                text: messageBody,
                to: toUserName,
            });
            console.log(`${commentId}: PM sent to ${toUserName}.`);
        } catch {
            console.log(`${commentId}: Error sending PM notification to ${toUserName}. User may only allow PMs from whitelisted users.`);
        }
    } else {
        // Reply by comment
        const newComment = await reddit.submitComment({
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

export interface ScoreResult {
    score: number;
    userHasFlair: boolean;
    flairIsPointsFlair: boolean;
    flairIsNumber: boolean;
}

export async function getCurrentScore (user: User, appSettings: SettingsValues): Promise<ScoreResult> {
    const userFlair = await user.getUserFlairBySubreddit(context.subredditName);

    const scoreFromRedis = await redis.zScore(POINTS_STORE_KEY, user.username);
    let scoreFromFlair: number | undefined;
    let flairIsNumber = false;

    if (userFlair?.flairText) {
        const flairTextTemplate = appSettings[AppSetting.FlairTextTemplate] as string | undefined ?? "{{points}}";
        const numberRegex = "(?:\\b|\\D)(\\d+)(?:\\b|\\D)";

        const regex = new RegExp(flairTextTemplate.replace("{{points}}", numberRegex));
        const matches = regex.exec(userFlair.flairText);

        const matchedPoints = matches?.[1];

        scoreFromFlair = matchedPoints ? parseInt(matchedPoints) : undefined;

        if (!scoreFromFlair) {
            // Fallback and see if the user flair includes the number anywhere in the flair
            const fallbackRegex = new RegExp(numberRegex);
            const fallbackMatches = fallbackRegex.exec(userFlair.flairText);
            const matchedPoints = fallbackMatches?.[1];
            scoreFromFlair = matchedPoints ? parseInt(matchedPoints) : undefined;
        }

        flairIsNumber = !isNaN(parseInt(userFlair.flairText));
    }

    return {
        score: scoreFromRedis ?? scoreFromFlair ?? 0,
        userHasFlair: userFlair?.flairText !== undefined,
        flairIsPointsFlair: scoreFromFlair === scoreFromRedis,
        flairIsNumber,
    };
}

async function getUserIsSuperuser (username: string): Promise<boolean> {
    const appSettings = await settings.getAll();

    const superUserSetting = appSettings[AppSetting.SuperUsers] as string | undefined ?? "";
    const superUsers = superUserSetting.split(",").map(user => user.trim().toLowerCase());

    if (superUsers.includes(username.toLowerCase())) {
        return true;
    }

    const autoSuperuserThreshold = appSettings[AppSetting.AutoSuperuserThreshold] as number | undefined ?? 0;

    if (autoSuperuserThreshold) {
        let user: User | undefined;
        try {
            user = await reddit.getUserByUsername(username);
        } catch {
            return false;
        }
        if (!user) {
            return false;
        }
        const { score } = await getCurrentScore(user, appSettings);
        return score >= autoSuperuserThreshold;
    } else {
        return false;
    }
}

export async function handleThanksEvent (event: OnCommentSubmitRequest | OnCommentUpdateRequest) {
    if (!event.comment || !event.post || !event.author || !event.subreddit) {
        return;
    }

    if (isT3(event.comment.parentId)) {
        // Points can't be awarded in a top level comment.
        return;
    }

    if (event.author.name === context.appSlug || event.author.name === "AutoModerator") {
        // Prevent bot account or Automod granting points
        return;
    }

    const appSettings = await settings.getAll();

    const userCommandVal = appSettings[AppSetting.ThanksCommand] as string | undefined;
    const userCommandList = userCommandVal?.split("\n").map(command => command.toLowerCase().trim()) ?? [];
    const modCommand = appSettings[AppSetting.ModThanksCommand] as string | undefined;

    let containsUserCommand: boolean;
    if (appSettings[AppSetting.ThanksCommandUsesRegex]) {
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

    const postFlairTextToIgnoreSetting = appSettings[AppSetting.PostFlairTextToIgnore] as string | undefined ?? "";
    if (postFlairTextToIgnoreSetting && event.post.linkFlair) {
        const postFlairTextToIgnore = postFlairTextToIgnoreSetting.split(",").map(flair => flair.trim().toLowerCase());
        const postFlair = event.post.linkFlair.text.toLowerCase();
        if (postFlairTextToIgnore.includes(postFlair)) {
            console.log(`${event.comment.id}: Cannot award points to post with: '${postFlair}' flair`);
            return;
        }
    }

    const isMod = await isModerator(event.author.name);

    if (containsUserCommand && !containsModCommand && event.author.id !== event.post.authorId) {
        if (!appSettings[AppSetting.AnyoneCanAwardPoints]) {
            console.log(`${event.comment.id}: points attempt made by ${event.author.name} who is not the OP`);
            return;
        }
    } else if (containsModCommand) {
        const userIsSuperuser = await getUserIsSuperuser(event.author.name);

        if (!isMod && !userIsSuperuser) {
            console.log(`${event.comment.id}: mod points attempt by ${event.author.name} who is neither a mod nor a superuser`);
            return;
        }
    }

    const usersWhoCantAwardPointsSetting = appSettings[AppSetting.UsersWhoCannotAwardPoints] as string | undefined ?? "";
    if (usersWhoCantAwardPointsSetting) {
        const usersWhoCantAwardPoints = usersWhoCantAwardPointsSetting.split(",").map(user => user.trim().toLowerCase());
        if (usersWhoCantAwardPoints.includes(event.author.name.toLowerCase())) {
            console.log(`${event.comment.id}: ${event.author.name} is not permitted to award points.`);
            return;
        }
    }

    const parentComment = await reddit.getCommentById(event.comment.parentId as T1);

    if (parentComment.authorName === context.appSlug || parentComment.authorName === "AutoModerator") {
        // Cannot award points to Automod or the app account
        return;
    } else if (parentComment.authorName === event.author.name) {
        console.log(`${event.comment.id}: points attempt by ${event.author.name} on their own comment`);
        const [notifyOnError] = appSettings[AppSetting.NotifyOnError] as ReplyOptions[] | undefined ?? [ReplyOptions.NoReply];
        if (notifyOnError !== ReplyOptions.NoReply) {
            let message = appSettings[AppSetting.NotifyOnErrorTemplate] as string | undefined ?? TemplateDefaults.NotifyOnErrorTemplate;
            message = message.replaceAll("u/{{authorname}}", `u/${event.author.name}`)
                .replaceAll("{{authorname}}", markdownEscape(event.author.name))
                .replaceAll("{{permalink}}", parentComment.permalink);

            await replyToUser(notifyOnError, event.author.name, message, event.comment.id as T1);
        }
        return;
    } else {
        const excludedUsersSetting = appSettings[AppSetting.UsersWhoCannotBeAwardedPoints] as string | undefined ?? "";
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
    const alreadyThanked = await redis.get(redisKey);
    if (alreadyThanked) {
        console.log(`${event.comment.id}: Comment ${parentComment.id} has already been thanked.`);
        return;
    }

    const parentCommentUser = await parentComment.getAuthor();
    if (!parentCommentUser) {
        console.log("Parent comment user is shadowbanned or suspended. Cannot proceed.");
        return;
    }
    const existingScore = await getCurrentScore(parentCommentUser, appSettings);
    const newScore: ScoreResult = {
        score: existingScore.score + 1,
        flairIsPointsFlair: existingScore.flairIsPointsFlair,
        userHasFlair: existingScore.userHasFlair,
        flairIsNumber: existingScore.flairIsNumber,
    };

    console.log(`${event.comment.id}: New score for ${parentComment.authorName} is ${newScore.score}`);
    await setUserScore(parentComment.authorName, newScore, appSettings);

    // Check to see if user has reached the superuser threshold.
    const autoSuperuserThreshold = appSettings[AppSetting.AutoSuperuserThreshold] as number | undefined ?? 0;
    const [notifyOnAutoSuperuser] = appSettings[AppSetting.NotifyOnAutoSuperuser] as ReplyOptions[] | undefined ?? [ReplyOptions.NoReply];
    if (autoSuperuserThreshold && modCommand && newScore.score === autoSuperuserThreshold && notifyOnAutoSuperuser !== ReplyOptions.NoReply) {
        console.log(`${event.comment.id}: ${parentCommentUser.username} has reached the auto superuser threshold. Notifying.`);
        let message = appSettings[AppSetting.NotifyOnAutoSuperuserTemplate] as string | undefined ?? TemplateDefaults.NotifyOnSuperuserTemplate;
        message = message.replaceAll("u/{{authorname}}", `u/${parentCommentUser.username}`)
            .replaceAll("{{authorname}}", markdownEscape(parentCommentUser.username))
            .replaceAll("{{permalink}}", parentComment.permalink)
            .replaceAll("{{threshold}}", autoSuperuserThreshold.toString())
            .replaceAll("{{pointscommand}}", modCommand);

        await replyToUser(notifyOnAutoSuperuser, parentCommentUser.username, message, parentComment.id);
    }

    const shouldSetPostFlair = appSettings[AppSetting.SetPostFlairOnThanks] as boolean | undefined ?? false;
    if (shouldSetPostFlair) {
        let postFlairText = appSettings[AppSetting.SetPostFlairText] as string | undefined;
        let postFlairCSSClass = appSettings[AppSetting.SetPostFlairCSSClass] as string | undefined;
        let postFlairTemplate = appSettings[AppSetting.SetPostFlairTemplate] as string | undefined;

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
            await reddit.setPostFlair({
                postId: event.post.id as T3,
                subredditName: parentComment.subredditName,
                text: postFlairText,
                cssClass: postFlairCSSClass,
                flairTemplateId: postFlairTemplate,
            });

            console.log(`${event.comment.id}: Set post flair.`);
        }
    }

    const now = new Date();
    await redis.set(redisKey, now.getTime().toString(), { expiration: addWeeks(now, 1) });

    const [notifyOnSuccess] = appSettings[AppSetting.NotifyOnSuccess] as ReplyOptions[] | undefined ?? [ReplyOptions.NoReply];
    if (notifyOnSuccess !== ReplyOptions.NoReply) {
        let message = appSettings[AppSetting.NotifyOnSuccessTemplate] as string | undefined ?? TemplateDefaults.NotifyOnSuccessTemplate;
        message = message.replaceAll("u/{{authorname}}", `u/${event.author.name}`)
            .replaceAll("{{authorname}}", markdownEscape(event.author.name))
            .replaceAll("u/{{awardeeusername}}", `u/${parentComment.authorName}`)
            .replaceAll("{{awardeeusername}}", markdownEscape(parentComment.authorName))
            .replaceAll("{{permalink}}", parentComment.permalink)
            .replaceAll("{{score}}", newScore.score.toString());

        await replyToUser(notifyOnSuccess, event.author.name, message, event.comment.id as T1);
    }

    const [notifyAwardedUser] = appSettings[AppSetting.NotifyAwardedUser] as ReplyOptions[] | undefined ?? [ReplyOptions.NoReply];
    if (notifyAwardedUser !== ReplyOptions.NoReply) {
        let message = appSettings[AppSetting.NotifyAwardedUserTemplate] as string | undefined ?? TemplateDefaults.NotifyAwardedUserTemplate;
        message = message.replaceAll("u/{{authorname}}", `u/${event.author.name}`)
            .replaceAll("{{authorname}}", markdownEscape(event.author.name))
            .replaceAll("u/{{awardeeusername}}", `u/${parentComment.authorName}`)
            .replaceAll("{{awardeeusername}}", markdownEscape(parentComment.authorName))
            .replaceAll("{{permalink}}", parentComment.permalink)
            .replaceAll("{{score}}", newScore.score.toString());

        await replyToUser(notifyAwardedUser, event.author.name, message, parentComment.id);
    }
}

export async function setUserScore (username: string, newScore: ScoreResult, appSettings: SettingsValues) {
    // Store the user's new score
    await redis.zAdd(POINTS_STORE_KEY, { member: username, score: newScore.score });
    // Queue user for cleanup checks in 24 hours, overwriting existing value.
    await setCleanupForUsers([username]);

    // Queue a leaderboard update.
    await scheduler.runJob({
        name: "updateLeaderboard",
        runAt: new Date(),
        data: { reason: `Awarded a point to ${username}. New score: ${newScore.score}` },
    });

    const existingFlairOverwriteHandling = (appSettings[AppSetting.ExistingFlairHandling] as ExistingFlairOverwriteHandling | undefined) ?? ExistingFlairOverwriteHandling.OverwriteNumeric;

    let shouldSetUserFlair: boolean;
    if (existingFlairOverwriteHandling === ExistingFlairOverwriteHandling.OverwriteAll) {
        shouldSetUserFlair = true;
    } else if (existingFlairOverwriteHandling === ExistingFlairOverwriteHandling.NeverSet) {
        shouldSetUserFlair = false;
    } else {
        shouldSetUserFlair = !newScore.userHasFlair || newScore.flairIsPointsFlair || newScore.flairIsNumber;
    }

    if (shouldSetUserFlair) {
        console.log(`Setting points flair for ${username}. New score: ${newScore.score}`);

        let cssClass = appSettings[AppSetting.CSSClass] as string | undefined;
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (!cssClass) {
            cssClass = undefined;
        }

        let flairTemplate = appSettings[AppSetting.FlairTemplate] as string | undefined;
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (!flairTemplate) {
            flairTemplate = undefined;
        }

        if (flairTemplate && cssClass) {
            // Prioritise flair templates over CSS classes.
            cssClass = undefined;
        }

        const flairTextTemplate = appSettings[AppSetting.FlairTextTemplate] as string | undefined ?? "{{points}}";

        await reddit.setUserFlair({
            subredditName: context.subredditName,
            username,
            cssClass,
            flairTemplateId: flairTemplate,
            text: flairTextTemplate.replace("{{points}}", newScore.score.toString()),
        });
    } else {
        console.log(`${username}: Flair not set (option disabled or flair in wrong state)`);
    }
}
