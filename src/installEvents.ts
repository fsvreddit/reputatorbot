import {TriggerContext} from "@devvit/public-api";
import {AppInstall, AppUpgrade} from "@devvit/protos";
import {populateCleanupLog} from "./cleanupTasks.js";

export async function onAppFirstInstall (_: AppInstall, context: TriggerContext) {
    await context.redis.set("InstallDate", new Date().getTime().toString());
}

export async function onAppInstallOrUpgrade (_: AppInstall | AppUpgrade, context: TriggerContext) {
    const currentJobs = await context.scheduler.listJobs();
    await Promise.all(currentJobs.map(job => context.scheduler.cancelJob(job.id)));

    await context.scheduler.runJob({
        name: "updateLeaderboard",
        cron: "0 0 * * *",
    });

    // Cleanup job should run every 30 minutes, but not at minute zero, to avoid clashes with leaderboard job.
    const minute = 1 + Math.floor(Math.random() * 29);
    console.log(`Running cleanup job at ${minute} and ${minute + 30} past the hour.`);

    await context.scheduler.runJob({
        name: "cleanupDeletedAccounts",
        cron: `${minute}/${30} * * * *`,
    });

    await populateCleanupLog(context);
}
