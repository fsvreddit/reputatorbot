import {TriggerContext} from "@devvit/public-api";
import {AppInstall, AppUpgrade} from "@devvit/protos";

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

    await context.scheduler.runJob({
        name: "updateLeaderboard",
        runAt: new Date(),
    });
}
