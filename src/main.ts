import { Devvit, FormField } from "@devvit/public-api";
import { handleManualPointSetting, handleThanksEvent, manualSetPointsFormHandler } from "./thanksPoints.js";
import { appSettings, validateRegexJobHandler } from "./settings.js";
import { onAppFirstInstall, onAppInstallOrUpgrade } from "./installEvents.js";
import { updateLeaderboard } from "./leaderboard.js";
import { cleanupDeletedAccounts } from "./cleanupTasks.js";
import { backupAllScores, restoreForm, restoreFormHandler, showRestoreForm } from "./backupAndRestore.js";
import { leaderboardCustomPost, createCustomPostMenuHandler, customPostForm, createCustomPostFormHandler } from "./customPost/index.js";
import { ADHOC_CLEANUP_JOB, CLEANUP_JOB, UPDATE_LEADERBOARD_JOB, VALIDATE_REGEX_JOB } from "./constants.js";

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
    name: UPDATE_LEADERBOARD_JOB,
    onRun: updateLeaderboard,
});

Devvit.addSchedulerJob({
    name: CLEANUP_JOB,
    onRun: cleanupDeletedAccounts,
});

Devvit.addSchedulerJob({
    name: ADHOC_CLEANUP_JOB,
    onRun: cleanupDeletedAccounts,
});

Devvit.addSchedulerJob({
    name: VALIDATE_REGEX_JOB,
    onRun: validateRegexJobHandler,
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

export const manualSetPointsForm = Devvit.createForm(data => ({ fields: data.fields as FormField[] }), manualSetPointsFormHandler);

Devvit.addMenuItem({
    label: "Set ReputatorBot score manually",
    forUserType: "moderator",
    location: "comment",
    onPress: handleManualPointSetting,
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
