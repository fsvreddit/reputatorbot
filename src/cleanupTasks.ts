import { TriggerContext, User, ZMember } from "@devvit/public-api";
import { addDays, addMinutes, subMinutes } from "date-fns";
import { POINTS_STORE_KEY } from "./thanksPoints.js";
import { parseExpression } from "cron-parser";
import { ADHOC_CLEANUP_JOB, CLEANUP_JOB_CRON } from "./constants.js";

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
    } catch {
        return false;
    }
    return user !== undefined;
}

interface UserActive {
    username: string;
    isActive: boolean;
}

export async function cleanupDeletedAccounts (_: unknown, context: TriggerContext) {
    console.log("Cleanup: Starting cleanup job");
    const items = await context.redis.zRange(CLEANUP_LOG_KEY, 0, new Date().getTime(), { by: "score" });
    if (items.length === 0) {
        // No user accounts need to be checked.
        await scheduleAdhocCleanup(context);
        return;
    }

    // Check platform is up.
    await context.reddit.getAppUser();

    const itemsToCheck = 50;

    // Get the first N accounts that are due a check.
    const usersToCheck = items.slice(0, itemsToCheck).map(item => item.member);
    const userStatuses: UserActive[] = [];

    for (const username of usersToCheck) {
        const isActive = await userActive(username, context);
        userStatuses.push(({ username, isActive } as UserActive));
    }

    const activeUsers = userStatuses.filter(user => user.isActive).map(user => user.username);
    const deletedUsers = userStatuses.filter(user => !user.isActive).map(user => user.username);

    // For active users, set their next check date to be one day from now.
    if (activeUsers.length > 0) {
        await setCleanupForUsers(activeUsers, context);
        await context.redis.zAdd(CLEANUP_LOG_KEY, ...activeUsers.map(user => ({ member: user, score: addDays(new Date(), DAYS_BETWEEN_CHECKS).getTime() } as ZMember)));
    }

    // For deleted users, remove them from both the cleanup log and the points score.
    if (deletedUsers.length > 0) {
        await context.redis.zRem(POINTS_STORE_KEY, deletedUsers);
        await context.redis.zRem(CLEANUP_LOG_KEY, deletedUsers);

        // Force an immediate leaderboard update, because some accounts newly cleaned up might have been visible there.
        await context.scheduler.runJob({
            name: "updateLeaderboard",
            runAt: new Date(),
            data: { reason: "One or more deleted accounts removed from database" },
        });
    }

    console.log(`Cleanup: ${deletedUsers.length}/${userStatuses.length} deleted or suspended.`);

    if (items.length > itemsToCheck) {
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

    if (JSON.stringify(DAYS_BETWEEN_CHECKS) === prevTimeBetweenChecks) {
        return;
    }

    await context.redis.set(redisKey, JSON.stringify(DAYS_BETWEEN_CHECKS));

    if (cleanupLogUsers.length > 0) {
        await context.redis.zAdd(CLEANUP_LOG_KEY, ...cleanupLogUsers.map(username => ({ member: username, score: addMinutes(new Date(), Math.random() * 60 * 24 * DAYS_BETWEEN_CHECKS).getTime() } as ZMember)));
        console.log(`OnUpgradeCleanupTasks: Rescheduled records of ${cleanupLogUsers.length} users for future cleanup.`);
    }

    // Cancel any ad-hoc jobs and reschedule.
    const existingJobs = await context.scheduler.listJobs();
    await Promise.all(existingJobs.filter(job => job.name === ADHOC_CLEANUP_JOB).map(job => context.scheduler.cancelJob(job.id)));
    await scheduleAdhocCleanup(context);
}

export async function scheduleAdhocCleanup (context: TriggerContext) {
    const nextEntries = await context.redis.zRange(CLEANUP_LOG_KEY, 0, 0, { by: "rank" });

    if (nextEntries.length === 0) {
        return;
    }

    const nextCleanupTime = new Date(nextEntries[0].score);
    const nextCleanupJobTime = addMinutes(nextCleanupTime, 5);
    const nextScheduledTime = parseExpression(CLEANUP_JOB_CRON).next().toDate();

    if (nextCleanupJobTime < subMinutes(nextScheduledTime, 5)) {
        // It's worth running an ad-hoc job.
        console.log(`Cleanup: Next ad-hoc cleanup: ${nextCleanupJobTime.toUTCString()}`);
        await context.scheduler.runJob({
            name: ADHOC_CLEANUP_JOB,
            runAt: nextCleanupJobTime,
        });
    } else {
        console.log(`Cleanup: Next entry in cleanup log is after next scheduled run (${nextCleanupTime.toUTCString()}).`);
        console.log(`Cleanup: Next cleanup job: ${nextScheduledTime.toUTCString()}`);
    }
}
