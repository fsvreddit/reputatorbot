import {Devvit} from "@devvit/public-api";
import {handleThanksEvent} from "./thanksPoints.js";
import {appSettings} from "./settings.js";
import {onAppFirstInstall, onAppInstallOrUpgrade} from "./installEvents.js";
import {updateLeaderboard} from "./leaderboard.js";

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

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
