import { JSONObject, ScheduledJobEvent, TriggerContext, User, ZMember } from "@devvit/public-api";
import { addDays, addMinutes, addSeconds } from "date-fns";
import { POINTS_STORE_KEY } from "./thanksPoints.js";
import { SchedulerJob } from "./constants.js";

const CLEANUP_LOG_KEY = "cleanupStore";
const DAYS_BETWEEN_CHECKS = 28;

export async function setCleanupForUsers (usernames: string[], context: TriggerContext) {
    if (usernames.length === 0) {
        return;
    }
    await context.redis.zAdd(CLEANUP_LOG_KEY, ...usernames.map(username => ({ member: username, score: addDays(new Date(), DAYS_BETWEEN_CHECKS).getTime() })));
}

async function userActive (username: string, context: TriggerContext): Promise<boolean> {
    let user: User | undefined;
    try {
        user = await context.reddit.getUserByUsername(username);
        return user !== undefined;
    } catch {
        //
    }

    // Fall back to mod note check method
    try {
        await context.reddit.getModNotes({
            subreddit: context.subredditName ?? await context.reddit.getCurrentSubredditName(),
            user: username,
        }).all();
        return true;
    } catch {
        return false;
    }
}

export async function cleanupDeletedAccounts (event: ScheduledJobEvent<JSONObject | undefined>, context: TriggerContext) {
    const recentlyRunKey = "cleanupRecentlyRun";

    const items = await context.redis.zRange(CLEANUP_LOG_KEY, 0, new Date().getTime(), { by: "score" });
    if (items.length === 0) {
        // No user accounts need to be checked.
        await scheduleAdhocCleanup(context);
        await context.redis.del(recentlyRunKey);
        return;
    }

    if (event.data?.fromCron && await context.redis.exists(recentlyRunKey)) {
        // Recently run from cron, skip this run to avoid overlapping runs.
        return;
    }

    await context.redis.set(recentlyRunKey, "", { expiration: addMinutes(new Date(), 1) });

    const runLimit = addSeconds(new Date(), 15);

    // Check platform is up.
    await context.reddit.getAppUser();
    let activeUsers = 0;
    let deletedUsers = 0;

    while (items.length > 0 && new Date() < runLimit) {
        const firstItem = items.shift();
        if (!firstItem) {
            break;
        }

        const username = firstItem.member;
        const isActive = await userActive(username, context);
        if (isActive) {
            // User is active, set next check date.
            await setCleanupForUsers([username], context);
            activeUsers++;
        } else {
            // User is deleted, remove from both logs.
            await context.redis.zRem(POINTS_STORE_KEY, [username]);
            await context.redis.zRem(CLEANUP_LOG_KEY, [username]);
            deletedUsers++;
        }
    }

    if (deletedUsers > 0) {
        // Force an immediate leaderboard update, because some accounts newly cleaned up might have been visible there.
        await context.scheduler.runJob({
            name: "updateLeaderboard",
            runAt: new Date(),
            data: { reason: "One or more deleted accounts removed from database" },
        });
    }

    console.log(`Cleanup: ${deletedUsers}/${activeUsers + deletedUsers} deleted or suspended.`);

    if (items.length > 0) {
        // In a backlog, so force another run.
        await context.scheduler.runJob({
            name: "cleanupDeletedAccounts",
            runAt: new Date(),
        });
    } else {
        await scheduleAdhocCleanup(context);
    }
}

/**
 * Removes cleanup log entries for users without scores, and populates cleanup log entries for users with
 * scores who are not yet in the cleanup log
 */
export async function populateCleanupLogAndScheduleCleanup (context: TriggerContext) {
    const existingScoreUsers = (await context.redis.zRange(POINTS_STORE_KEY, 0, -1)).map(score => score.member);
    const cleanupLogUsers = (await context.redis.zRange(CLEANUP_LOG_KEY, 0, -1)).map(score => score.member);

    const existingScoreUsersWithoutCleanup = existingScoreUsers.filter(username => !cleanupLogUsers.includes(username));

    if (existingScoreUsersWithoutCleanup.length > 0) {
        await context.redis.zAdd(CLEANUP_LOG_KEY, ...existingScoreUsersWithoutCleanup.map(username => ({ member: username, score: addMinutes(new Date(), Math.random() * 60 * 24 * DAYS_BETWEEN_CHECKS).getTime() } as ZMember)));
        console.log(`OnUpgradeCleanupTasks: Stored records of ${existingScoreUsers.length} users for future cleanup.`);
    }

    const cleanupLogUsersWithoutScores = cleanupLogUsers.filter(username => !existingScoreUsers.includes(username));
    if (cleanupLogUsersWithoutScores.length > 0) {
        await context.redis.zRem(CLEANUP_LOG_KEY, cleanupLogUsersWithoutScores);
        console.log(`OnUpgradeCleanupTasks: Removed records of ${existingScoreUsers.length} from cleanup log who don't have scores.`);
    }

    const redisKey = "prevTimeBetweenChecks";
    const prevTimeBetweenChecks = await context.redis.get(redisKey);

    if (JSON.stringify(DAYS_BETWEEN_CHECKS) !== prevTimeBetweenChecks && cleanupLogUsers.length > 0) {
        await context.redis.zAdd(CLEANUP_LOG_KEY, ...cleanupLogUsers.map(username => ({ member: username, score: addMinutes(new Date(), Math.random() * 60 * 24 * DAYS_BETWEEN_CHECKS).getTime() } as ZMember)));
        console.log(`OnUpgradeCleanupTasks: Rescheduled records of ${cleanupLogUsers.length} users for future cleanup.`);

        await context.redis.set(redisKey, JSON.stringify(DAYS_BETWEEN_CHECKS));
    }

    // Cancel any ad-hoc jobs and reschedule.
    await scheduleAdhocCleanup(context);
}

export async function scheduleAdhocCleanup (context: TriggerContext) {
    const nextEntries = await context.redis.zRange(CLEANUP_LOG_KEY, 0, 0, { by: "rank" });

    if (nextEntries.length === 0) {
        return;
    }

    const nextCleanupJobTime = addMinutes(nextEntries[0].score, 1);

    const existingJobs = await context.scheduler.listJobs();
    const cancellableJobs = existingJobs.filter(job => job.name === SchedulerJob.CleanupDeletedAccounts as string && "runAt" in job);
    await Promise.all(cancellableJobs.map(job => context.scheduler.cancelJob(job.id)));

    if (nextCleanupJobTime > addDays(new Date(), 1)) {
        // Next cleanup is more than a day away, no need to schedule an ad-hoc job.
        console.log(`Cleanup: Next ad-hoc cleanup: ${nextCleanupJobTime.toUTCString()}, not scheduling.`);
        return;
    }

    await context.scheduler.runJob({
        name: SchedulerJob.CleanupDeletedAccounts,
        runAt: nextCleanupJobTime < new Date() ? new Date() : nextCleanupJobTime,
    });

    console.log(`Cleanup: Next ad-hoc cleanup: ${nextCleanupJobTime.toUTCString()}`);
}
