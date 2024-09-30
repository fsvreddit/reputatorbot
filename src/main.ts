import { Devvit } from "@devvit/public-api";
import { handleThanksEvent } from "./thanksPoints.js";
import { appSettings } from "./settings.js";
import { onAppFirstInstall, onAppInstallOrUpgrade } from "./installEvents.js";
import { updateLeaderboard } from "./leaderboard.js";
import { cleanupDeletedAccounts } from "./cleanupTasks.js";
import { backupAllScores, restoreForm, restoreFormHandler, showRestoreForm } from "./backupAndRestore.js";
import { leaderboardCustomPost, createCustomPostMenuHandler, customPostForm, createCustomPostFormHandler } from "./customPost/index.js";

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

Devvit.addCustomPostType(leaderboardCustomPost);

Devvit.addMenuItem({
    label: "Submit Leaderboard Post",
    forUserType: "moderator",
    location: "subreddit",
    onPress: createCustomPostMenuHandler,
});

export const customPostFormKey = Devvit.createForm(customPostForm, createCustomPostFormHandler);

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
