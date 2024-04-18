import {TriggerContext, ZMember} from "@devvit/public-api";
import {AppInstall, AppUpgrade} from "@devvit/protos";
import {CLEANUP_LOG_KEY, CLEANUP_LOG_POPULATED} from "./cleanupTasks.js";
import {POINTS_STORE_KEY} from "./thanksPoints.js";

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

    // Has the cleanup log been initialised? If not, populate with all users that we currently know of.
    const cleanupLogPopulated = await context.redis.get(CLEANUP_LOG_POPULATED);
    if (!cleanupLogPopulated) {
        const existingScores = await context.redis.zRange(POINTS_STORE_KEY, 0, -1);
        await context.redis.zAdd(CLEANUP_LOG_KEY, ...existingScores.map(existingScore => <ZMember>{member: existingScore.member, score: 0}));
        await context.redis.set(CLEANUP_LOG_POPULATED, new Date().getTime().toString());

        console.log(`OnUpgrade: Stored records of ${existingScores.length} users for future cleanup.`);
    }
}
