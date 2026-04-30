import { context, reddit, redis, ScheduledCronJob, scheduler, User } from "@devvit/web/server";
import type { Context } from "hono";
import { addDays, addMinutes, addSeconds } from "date-fns";
import { POINTS_STORE_KEY } from "../core";

const CLEANUP_LOG_KEY = "cleanupStore";
const CLEANUP_JOB_NAME = "cleanupJob";
const DAYS_BETWEEN_CHECKS = 28;

export const handleCleanupJob = async (c: Context) => {
    const jobRequest = await c.req.json<ScheduledCronJob>();

    await cleanupDeletedAccounts(jobRequest);

    return c.json({ message: "cleanup job completed" }, 200);
};

export async function setCleanupForUsers (usernames: string[]) {
    if (usernames.length === 0) {
        return;
    }
    await redis.zAdd(CLEANUP_LOG_KEY, ...usernames.map(username => ({ member: username, score: addDays(new Date(), DAYS_BETWEEN_CHECKS).getTime() })));
}

async function userActive (username: string): Promise<boolean> {
    let user: User | undefined;
    try {
        user = await reddit.getUserByUsername(username);
        return user !== undefined;
    } catch {
        //
    }

    // Fall back to mod note check method
    try {
        await reddit.getModNotes({
            subreddit: context.subredditName,
            user: username,
        }).all();
        return true;
    } catch {
        return false;
    }
}

export async function cleanupDeletedAccounts (jobRequest: ScheduledCronJob) {
    const recentlyRunKey = "cleanupRecentlyRun";

    const items = await redis.zRange(CLEANUP_LOG_KEY, 0, new Date().getTime(), { by: "score" });
    if (items.length === 0) {
        // No user accounts need to be checked.
        await scheduleAdhocCleanup();
        await redis.del(recentlyRunKey);
        return;
    }

    if (jobRequest.data?.fromCron && await redis.exists(recentlyRunKey)) {
        // Recently run from cron, skip this run to avoid overlapping runs.
        return;
    }

    await redis.set(recentlyRunKey, "", { expiration: addMinutes(new Date(), 1) });

    const runLimit = addSeconds(new Date(), 15);

    // Check platform is up.
    await reddit.getAppUser();
    let activeUsers = 0;
    let deletedUsers = 0;

    while (items.length > 0 && new Date() < runLimit) {
        const firstItem = items.shift();
        if (!firstItem) {
            break;
        }

        const username = firstItem.member;
        const isActive = await userActive(username);
        if (isActive) {
            // User is active, set next check date.
            await setCleanupForUsers([username]);
            activeUsers++;
        } else {
            // User is deleted, remove from both logs.
            await redis.zRem(POINTS_STORE_KEY, [username]);
            await redis.zRem(CLEANUP_LOG_KEY, [username]);
            deletedUsers++;
        }
    }

    if (deletedUsers > 0) {
        // Force an immediate leaderboard update, because some accounts newly cleaned up might have been visible there.
        await scheduler.runJob({
            name: "updateLeaderboard",
            runAt: new Date(),
            data: { reason: "One or more deleted accounts removed from database" },
        });
    }

    console.log(`Cleanup: ${deletedUsers}/${activeUsers + deletedUsers} deleted or suspended.`);

    if (items.length > 0) {
        // In a backlog, so force another run.
        await scheduler.runJob({
            name: CLEANUP_JOB_NAME,
            runAt: new Date(),
        });
    } else {
        await scheduleAdhocCleanup();
    }
}

export async function scheduleAdhocCleanup () {
    const nextEntries = await redis.zRange(CLEANUP_LOG_KEY, 0, 0, { by: "rank" });

    const nextEntry = nextEntries.shift();

    if (!nextEntry) {
        return;
    }

    const nextCleanupJobTime = addMinutes(nextEntry.score, 1);

    const existingJobs = await scheduler.listJobs();
    const cancellableJobs = existingJobs.filter(job => job.name === CLEANUP_JOB_NAME && "runAt" in job);
    await Promise.all(cancellableJobs.map(job => scheduler.cancelJob(job.id)));

    if (nextCleanupJobTime > addDays(new Date(), 1)) {
        // Next cleanup is more than a day away, no need to schedule an ad-hoc job.
        console.log(`Cleanup: Next ad-hoc cleanup: ${nextCleanupJobTime.toUTCString()}, not scheduling.`);
        return;
    }

    await scheduler.runJob({
        name: CLEANUP_JOB_NAME,
        runAt: nextCleanupJobTime < new Date() ? new Date() : nextCleanupJobTime,
    });

    console.log(`Cleanup: Next ad-hoc cleanup: ${nextCleanupJobTime.toUTCString()}`);
}
