import {ScheduledJobEvent, TriggerContext, ZMember} from "@devvit/public-api";
import {addDays, addMinutes} from "date-fns";
import {POINTS_STORE_KEY} from "./thanksPoints.js";

export const CLEANUP_LOG_KEY = "cleanupStore";

async function userActive (username: string, context: TriggerContext): Promise<boolean> {
    try {
        await context.reddit.getUserByUsername(username);
        return true;
    } catch (error) {
        if (error instanceof Error) {
            if (error.stack && error.stack.includes("404 Not Found")) {
                // Deleted or shadowbanned or suspended
                console.log(`Cleanup: ${username} appears to be deleted or suspended.`);
                return false;
            }
        }
        // Other errors may be platform errors, or indicate suspended (but not deleted) users. In those
        // cases we do not want to remove the scores.
        return true;
    }
}

interface UserActive {
    username: string,
    isActive: boolean,
}

export async function cleanupDeletedAccounts (_: ScheduledJobEvent, context: TriggerContext) {
    console.log("Cleanup: Starting cleanup job");
    const items = await context.redis.zRange(CLEANUP_LOG_KEY, 0, new Date().getTime(), {by: "score"});
    if (items.length === 0) {
        // No user accounts need to be checked.
        console.log("Cleanup: No users are due a check.");
        return;
    }

    const itemsToCheck = 50;

    if (items.length > itemsToCheck) {
        console.log(`Cleanup: ${items.length} accounts are due a check. Checking first ${itemsToCheck} in this run.`);
    } else {
        console.log(`Cleanup: ${items.length} accounts are due a check.`);
    }

    // Get the first N accounts that are due a check.
    const usersToCheck = items.slice(0, itemsToCheck).map(item => item.member);
    const userStatuses: UserActive[] = [];

    for (const username of usersToCheck) {
        // eslint-disable-next-line no-await-in-loop
        const isActive = await userActive(username, context);
        userStatuses.push(<UserActive>{username, isActive});
    }

    const activeUsers = userStatuses.filter(user => user.isActive).map(user => user.username);
    const deletedUsers = userStatuses.filter(user => !user.isActive).map(user => user.username);

    // For active users, set their next check date to be one day from now.
    if (activeUsers.length > 0) {
        console.log(`Cleanup: ${activeUsers.length} users still active out of ${userStatuses.length}. Resetting next check time.`);
        await context.redis.zAdd(CLEANUP_LOG_KEY, ...activeUsers.map(user => <ZMember>{member: user, score: addDays(new Date(), 1).getTime()}));
    }

    // For deleted users, remove them from both the cleanup log and the points score.
    if (deletedUsers.length > 0) {
        console.log(`Cleanup: ${deletedUsers.length} users out of ${userStatuses.length} are deleted or suspended. Removing from data store.`);
        await context.redis.zRem(POINTS_STORE_KEY, deletedUsers);
        await context.redis.zRem(CLEANUP_LOG_KEY, deletedUsers);

        // Force an immediate leaderboard update, because some accounts newly cleaned up might have been visible there.
        await context.scheduler.runJob({
            name: "updateLeaderboard",
            runAt: new Date(),
            data: {reason: "One or more deleted accounts purged"},
        });
    }
}

/**
 * Removes cleanup log entries for users without scores, and populates cleanup log entries for users with
 * scores who are not yet in the cleanup log
 */
export async function populateCleanupLog (context: TriggerContext) {
    const existingScoreUsers = (await context.redis.zRange(POINTS_STORE_KEY, 0, -1)).map(score => score.member);
    const cleanupLogUsers = (await context.redis.zRange(CLEANUP_LOG_KEY, 0, -1)).map(score => score.member);

    const existingScoreUsersWithoutCleanup = existingScoreUsers.filter(username => !cleanupLogUsers.includes(username));

    if (existingScoreUsersWithoutCleanup.length > 0) {
        await context.redis.zAdd(CLEANUP_LOG_KEY, ...existingScoreUsersWithoutCleanup.map(username => <ZMember>{member: username, score: addMinutes(new Date(), Math.random() * 60 * 24).getTime()}));
        console.log(`OnUpgradeCleanupTasks: Stored records of ${existingScoreUsers.length} users for future cleanup.`);
    }

    const cleanupLogUsersWithoutScores = cleanupLogUsers.filter(username => !existingScoreUsers.includes(username));
    if (cleanupLogUsersWithoutScores.length > 0) {
        await context.redis.zRem(CLEANUP_LOG_KEY, cleanupLogUsersWithoutScores);
        console.log(`OnUpgradeCleanupTasks: Removed records of ${existingScoreUsers.length} from cleanup log who don't have scores.`);
    }
}
