import {Devvit} from "@devvit/public-api";
import {handleThanksEvent, settingsForThanksPoints, updateLeaderboard} from "./thanksPoints.js";

Devvit.addSettings(settingsForThanksPoints);

Devvit.addTrigger({
    events: ["CommentSubmit", "CommentUpdate"],
    onEvent: handleThanksEvent,
});

Devvit.addTrigger({
    event: "AppInstall",
    onEvent: async (_, context) => {
        await context.redis.set("InstallDate", new Date().getTime().toString());
    },
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    onEvent: async (_, context) => {
        const currentJobs = await context.scheduler.listJobs();
        await Promise.all(currentJobs.map(job => context.scheduler.cancelJob(job.id)));

        await context.scheduler.runJob({
            name: "updateLeaderboard",
            cron: "0 0 * * *",
        });

        await context.scheduler.runJob({
            name: "updateLeaderboard",
            runAt: new Date(),
        });
    },
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
